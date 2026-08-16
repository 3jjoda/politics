import BillDao from '../daos/BillDao.js';
import logger from '../utils/logger.js';

// 분석 요청 임계값 — 환경변수로 조정 가능 (디폴트 5명)
const REQUEST_THRESHOLD = parseInt(process.env.ANALYSIS_REQUEST_THRESHOLD, 10) || 5;

// 진행률 stats 5분 메모리 캐시 (16,817건 풀카운트는 자주 안 변함)
const STATS_CACHE_TTL_MS = 5 * 60 * 1000;
let _statsCache = null;
let _statsCachedAt = 0;

/* 홈 히어로 결론 숫자 — 🔴 **10분 캐시 + inflight 공유 필수**.
   쿼리가 bills(18,741) + bill_votes(177,260) 전체 집계라 실측 **115ms** 인데,
   홈은 이 사이트에서 가장 많이 열리는 페이지다. 입력은 하루 1회(배치)만 바뀐다.
   ⚠️ inflight 공유가 없으면 캐시가 비었을 때 동시 요청이 전부 같은 집계를 돌린다
      (PoliticianService.getKpiPercentiles · XrayService 와 같은 수법). */
const FACTS_TTL_MS = 10 * 60 * 1000;
let _factsCache = null;
let _factsAt = 0;
let _factsInflight = null;

export default (db) => {
    const billDao = BillDao(db);

    return {
        getList: async (params) => billDao.getList(params),
        getListOne: async (monaCd) => billDao.getListOne(monaCd),
        getDetail: async (billId) => billDao.getDetail(billId),
        getHomeKpi: async () => billDao.getHomeKpi(),

        /* 홈 히어로 결론 숫자 3종.
           ⚠️ 실패해도 **null 을 돌려 홈은 살린다** — 히어로 숫자 때문에 첫 화면이 500 이 되면 안 된다 */
        getHomeFacts: async () => {
            try {
                if (_factsCache && (Date.now() - _factsAt) < FACTS_TTL_MS) return _factsCache;
                if (!_factsInflight) {
                    _factsInflight = billDao.getHomeFacts()
                        .then((row) => { _factsCache = row; _factsAt = Date.now(); return row; })
                        .finally(() => { _factsInflight = null; });
                }
                return await _factsInflight;
            } catch (err) {
                logger.error(`홈 결론 숫자 조회 실패: ${err.message}`);
                return null;
            }
        },
        getTrending: async (sort) => billDao.getTrending(sort),
        getRecentVotes: async () => billDao.getRecentVotes(),
        getMonthlyTrend: async () => billDao.getMonthlyTrend(),
        getStatusCounts: async (committee, party, billName, search) => billDao.getStatusCounts(committee, party, billName, search),
        getTopicCounts: async () => billDao.getTopicCounts(),
        getPartyCounts: async () => billDao.getPartyCounts(),
        getBillDetailVotes: async (billId) => billDao.getBillDetailVotes(billId),
        getBillCoProposers: async (billId) => billDao.getBillCoProposers(billId),
        getAiAnalysis: async (billId) => billDao.getAiAnalysis(billId),
        search: async (q) => billDao.search(q),

        /* AI 분석 - 필터 옵션 */
        getAiCategories: async () => billDao.getAiCategories(),

        /* AI 분석 - 진행률 (전체/완료, 5분 메모리 캐시 - 천천히 변함) */
        getAnalysisStats: async () => {
            const now = Date.now();
            if (_statsCache && (now - _statsCachedAt) < STATS_CACHE_TTL_MS) {
                return _statsCache;
            }
            _statsCache = await billDao.getAnalysisStats();
            _statsCachedAt = now;
            return _statsCache;
        },

        /* 분석 요청 카운트 - 캐시 없이 매번 fresh (가벼움 + 자주 변함) */
        getRequestStats: async () => billDao.getRequestStats(REQUEST_THRESHOLD),

        /* 분석 요청 - 임계값 (UI 노출용) */
        getRequestThreshold: () => REQUEST_THRESHOLD,

        /* 분석 요청 - 카운트 */
        getAnalysisRequestCount: async (billId) => billDao.getAnalysisRequestCount(billId),

        /* 분석 요청 - 사용자 요청 여부 */
        hasUserRequested: async (billId, userId) => {
            if (!userId) return false;
            const r = await billDao.getUserAnalysisRequest(billId, userId);
            return Boolean(r);
        },

        /* 분석 요청 - 생성
           - 이미 분석 있으면 ALREADY_ANALYZED throw
           - 이미 요청했으면 멱등 처리 (count 만 반환)
           - 신규면 INSERT 후 카운트 반환 */
        requestAnalysis: async (billId, userId) => {
            if (!userId) throw new Error('UNAUTHORIZED');

            const analysis = await billDao.getAiAnalysis(billId);
            if (analysis) {
                const err = new Error('ALREADY_ANALYZED');
                err.code = 'ALREADY_ANALYZED';
                throw err;
            }

            const created = await billDao.createAnalysisRequest(billId, userId);
            const count = await billDao.getAnalysisRequestCount(billId);
            const isNew = Boolean(created);
            logger.info(`Analysis request: bill_id=${billId} user_id=${userId} new=${isNew} total=${count}`);
            return { count, isNew, threshold: REQUEST_THRESHOLD };
        },

        /* 분석 요청 - 내가 요청한 법안 (마이페이지) */
        getMyAnalysisRequests: async (userId) => billDao.getMyAnalysisRequests(userId)
    };
};
