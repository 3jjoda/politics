import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/bill');

const queries = {};
fs.readdirSync(queriesPath).forEach(file => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => {
    return {
        /* 법안 목록 (검색/필터/정렬/페이징) */
        getList: async ({
            search = null,
            status = null,
            committee = null,
            party = null,
            hasAnalysis = null,        // 'Y' | 'N' | null
            aiCategoryMain = null,     // 'A,B' | null  (v4.1 16종 main)
            sort = 'recent',           // 'recent' | 'ai_priority' | 'requested'
            requestStatus = null,      // 'any' | 'priority' | null
            priorityThreshold = 5,
            billName = null,           // 법안명 완전일치 ("같은 법률 개정안 N건" 계열 필터)
            limit = 50,
            offset = 0
        } = {}) => {
            const { rows } = await db.query(
                queries.getList,
                [search, status, committee, limit, offset, party, hasAnalysis, aiCategoryMain, sort, requestStatus, priorityThreshold, billName]
            );
            return rows;
        },

        /* 특정 의원의 법안 (공동발의 포함) */
        getListOne: async (monaCd) => {
            const { rows } = await db.query(queries.getListOne, [monaCd]);
            return rows;
        },

        /* 법안 상세 */
        getDetail: async (billId) => {
            const { rows } = await db.query(queries.getDetail, [billId]);
            return rows;
        },

        /* 홈 KPI */
        getHomeKpi: async () => {
            const { rows } = await db.query(queries.getHomeKpi);
            return rows[0];
        },

        /* 홈 - 주목할 법안 (sort: 'recent' | 'close' | 'popular' | 'bipartisan') */
        getTrending: async (sort = 'recent') => {
            const { rows } = await db.query(queries.getTrending, [sort]);
            return rows;
        },

        /* 홈 - 최근 표결 */
        getRecentVotes: async () => {
            const { rows } = await db.query(queries.getRecentVotes);
            return rows;
        },

        /* 홈 - 월별 법안 추이 */
        getMonthlyTrend: async () => {
            const { rows } = await db.query(queries.getMonthlyTrend);
            return rows;
        },

        /* 법안 상태별 카운트 (committee/party 필터 지원) */
        getStatusCounts: async (committee = null, party = null, billName = null) => {
            const { rows } = await db.query(queries.getStatusCounts, [committee, party, billName]);
            return rows[0];
        },

        /* 법안 카테고리별 카운트 */
        getTopicCounts: async () => {
            const { rows } = await db.query(queries.getTopicCounts);
            return rows;
        },

        /* 법안 정당별 카운트 */
        getPartyCounts: async () => {
            const { rows } = await db.query(queries.getPartyCounts);
            return rows;
        },

        /* 법안 상세 - 표결한 의원 목록 */
        getBillDetailVotes: async (billId) => {
            const { rows } = await db.query(queries.getBillDetailVotes, [billId]);
            return rows;
        },

        /* 법안 상세 - 공동발의자 목록 */
        getBillCoProposers: async (billId) => {
            const { rows } = await db.query(queries.getBillCoProposers, [billId]);
            return rows;
        },

        /* 법안 상세 - AI 분석 결과 (없으면 null) */
        getAiAnalysis: async (billId) => {
            const { rows } = await db.query(queries.getAiAnalysis, [billId]);
            return rows[0] || null;
        },

        /* 법안 검색 (커뮤니티 첨부용) */
        search: async (q) => {
            const term = String(q || '').trim();
            if (!term) return [];
            const { rows } = await db.query(queries.search, [term]);
            return rows;
        },

        /* AI 분석 - 카테고리 필터 옵션 */
        getAiCategories: async () => {
            const { rows } = await db.query(queries.getAiCategories);
            return rows;
        },

        /* AI 분석 - 진행률 (천천히 변함, 5분 캐시 가치 큼) */
        getAnalysisStats: async () => {
            const { rows } = await db.query(queries.getAnalysisStats);
            return rows[0];
        },

        /* 분석 요청 - any/priority 카운트 (자주 변함, 캐시 X) */
        getRequestStats: async (threshold = 5) => {
            const { rows } = await db.query(queries.getRequestStats, [threshold]);
            return rows[0];
        },

        /* 분석 요청 - 카운트 */
        getAnalysisRequestCount: async (billId) => {
            const { rows } = await db.query(queries.getAnalysisRequestCount, [billId]);
            return rows[0]?.count || 0;
        },

        /* 분석 요청 - 사용자 요청 여부 */
        getUserAnalysisRequest: async (billId, userId) => {
            const { rows } = await db.query(queries.getUserAnalysisRequest, [billId, userId]);
            return rows[0] || null;
        },

        /* 분석 요청 - 생성 (UNIQUE 충돌 시 ON CONFLICT DO NOTHING) */
        createAnalysisRequest: async (billId, userId) => {
            const { rows } = await db.query(queries.createAnalysisRequest, [billId, userId]);
            return rows[0] || null;  // null 이면 이미 존재
        },

        /* 분석 요청 - 내가 요청한 법안 목록 (마이페이지) */
        getMyAnalysisRequests: async (userId) => {
            const { rows } = await db.query(queries.getMyAnalysisRequests, [userId]);
            return rows;
        }
    };
};
