// daos/PoliticianDao.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/politician');

const queries = {};
fs.readdirSync(queriesPath).forEach(file => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => {
    return {
        /* 정치인 기본 목록 */
        getList: async () => {
            const { rows } = await db.query(queries.getList);
            return rows;
        },

        /* 정치인 목록 + 발의 건수 집계 */
        getListWithStats: async () => {
            const { rows } = await db.query(queries.getListWithStats);
            return rows;
        },

        /* 정치인 상세 */
        getDetail: async (monaCd) => {
            const { rows } = await db.query(queries.getDetail, [monaCd]);
            return rows;
        },

        /* 의원 소속 위원회 (현재 스냅샷) */
        getCommittees: async (monaCd) => {
            const { rows } = await db.query(queries.getCommittees, [monaCd]);
            return rows;
        },

        /* 의원 특수 직위 (수동 관리 — politician_titles) */
        getTitles: async (monaCd) => {
            const { rows } = await db.query(queries.getTitles, [monaCd]);
            return rows;
        },

        /* 홈 - 활발한 의원 TOP 5 */
        getTopProposers: async () => {
            const { rows } = await db.query(queries.getTopProposers);
            return rows;
        },

        /* 홈 - 최근 정당 이동 내역 */
        getRecentPartyMoves: async (limit = 10) => {
            const { rows } = await db.query(queries.getRecentPartyMoves, [limit]);
            return rows;
        },

        /* 정당별 카운트 */
        getPartyCounts: async () => {
            const { rows } = await db.query(queries.getPartyCounts);
            return rows;
        },

        /* 위원회별 카운트 */
        getCommitteeCounts: async () => {
            const { rows } = await db.query(queries.getCommitteeCounts);
            return rows;
        },

        /* 선출 방식별 카운트 */
        getElectTypeCounts: async () => {
            const { rows } = await db.query(queries.getElectTypeCounts);
            return rows;
        },

        /* 성별 분포 */
        getGenderStats: async () => {
            const { rows } = await db.query(queries.getGenderStats);
            return rows[0];
        },

        /* 연령대 분포 */
        getAgeGroupStats: async () => {
            const { rows } = await db.query(queries.getAgeGroupStats);
            return rows[0];
        },

        /* 의원별 법안 (대표/공동) */
        getBillsByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getBillsByMonaCd, [monaCd]);
            return rows;
        },

        /* 법안 활동 탭 — 한 페이지만. 🔴 전건(getBillsByMonaCd)을 SSR 로 뿌리면 887행 1.1MB 다 */
        getBillsPageByMonaCd: async (monaCd, kind, limit, offset) => {
            const { rows } = await db.query(queries.getBillsPageByMonaCd, [monaCd, kind, limit, offset]);
            return rows;
        },

        /* 법안 활동 탭 — 개수만 (탭 라벨용). 개수 때문에 전건을 들고 오지 않는다 */
        getBillCountsByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getBillCountsByMonaCd, [monaCd]);
            return rows[0] || { total: 0, rep: 0, co: 0 };
        },

        /* 월별 표결 참여 차트의 클릭 패널 — 그 달치만 */
        getVotesByMonthByMonaCd: async (monaCd, ym) => {
            const { rows } = await db.query(queries.getVotesByMonthByMonaCd, [monaCd, ym]);
            return rows;
        },

        /* 의원별 표결 내역 */
        getVotesByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getVotesByMonaCd, [monaCd]);
            return rows;
        },

        /* 표결 내역 탭 한 페이지 (+ 결과별 필터). result 는 서비스가 화이트리스트로 접는다 */
        getVotesPageByMonaCd: async (monaCd, result, limit, offset) => {
            const { rows } = await db.query(queries.getVotesPageByMonaCd, [monaCd, result, limit, offset]);
            return rows;
        },

        /* 「나와의 성향 일치」 — 순위 + 축별 변별력. 왜 %가 아니라 순위인지는 쿼리 주석에 */
        getMatchContext: async (axis, monaCd) => {
            const { rows } = await db.query(queries.getMatchContext,
                [axis.economy, axis.social, axis.institution, monaCd]);   // 3축 — 안보 제외 (utils/axisConfig.js)
            return rows[0] || null;
        },

        /* 홈 — 내 좌표(3축)와 가장 가까운 의원 TOP N.
           ⚠️ 일치도 식은 의원 상세·목록과 **글자 그대로 같아야** 한다 (쿼리 주석 참조) */
        getTopMatches: async (axis, limit = 3) => {
            const { rows } = await db.query(queries.getTopMatches,
                [axis.economy, axis.social, axis.institution, limit]);   // 3축 — 안보 제외 (utils/axisConfig.js)
            return rows;
        },

        /* 성향 진단 「의원과 비교」 — 가장 가까운/먼 N명 + 의원 전체 평균 + 축별 위치 (쿼리 주석 참조) */
        getMatchSpread: async (axis, limit = 3) => {
            const { rows } = await db.query(queries.getMatchSpread,
                [axis.economy, axis.social, axis.institution, limit]);   // 3축 — 안보 제외 (utils/axisConfig.js)
            return rows;
        },

        /* 공유 카드 좌표 지도 — 좌표 있는 의원 전원의 축 값만 (익명) */
        getAxisCloud: async () => {
            const { rows } = await db.query(queries.getAxisCloud);
            return rows;
        },

        /* 홈 히어로 — 무작위 N명 + 축 좌표 + 소속 정당 평균 (쿼리 주석 참조) */
        getAxisSpotlight: async (limit = 3) => {
            const { rows } = await db.query(queries.getAxisSpotlight, [limit]);
            return rows;
        },

        /* 의원별 대표발의 특화 위원회 TOP5 (건수 + 본인비중 + 의원평균비중 + 배수) */
        getTopicsByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getTopicsByMonaCd, [monaCd]);
            return rows;
        },

        /* 의원별 월별 발의 */
        getMonthlyBillsByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getMonthlyBillsByMonaCd, [monaCd]);
            return rows;
        },

        /* 의원별 표결 요약 */
        getVoteSummaryByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getVoteSummaryByMonaCd, [monaCd]);
            return rows[0];
        },

        /* 의원별 교차 표결 성향 (자당 vs 타당 발의 법안 찬성률) */
        getCrossPartyVoteByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getCrossPartyVoteByMonaCd, [monaCd]);
            return rows[0] || null;
        },

        /* 의원별 정당 공동발의 협력 */
        getPartyCoopByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getPartyCoopByMonaCd, [monaCd]);
            return rows;
        },

        /* 내가 **참여한** 법안의 대표발의자 정당 (outbound) — 위와 방향이 반대다.
           의원 상세에서는 이쪽이 **본인의 선택**이라 화면에서도 먼저 온다 (쿼리 주석 참조) */
        getPartyCoopOutByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getPartyCoopOutByMonaCd, [monaCd]);
            return rows;
        },

        /* 의원 발언 요약 (질의석·위원장석 건수 · 발언한 날 · 회의 종류 분포)
           ⚠️ member·chair 만 센다 — 나머지는 이름 매칭 오귀속이 섞인다 (쿼리 주석 참조) */
        getSpeechSummaryByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getSpeechSummaryByMonaCd, [monaCd]);
            return rows[0] || null;
        },

        /* 의원 발언 회의 목록 (클립이 아니라 회의 단위 — 쿼리 주석 참조) */
        getSpeechMeetingsByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getSpeechMeetingsByMonaCd, [monaCd]);
            return rows;
        },

        /* 의원 상임위 발언 참여율 (politician_committee_speech MV + 코호트 평균) */
        getSpeechRatesByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getSpeechRatesByMonaCd, [monaCd]);
            return rows;
        },

        /* KPI 백분위 — **코호트 전체(309행)를 한 번에** 돌려준다. 의원별 인자가 없다.
           서비스가 캐시하고 mona_cd 로 찾아 쓴다 (상세 진입마다 돌리면 안 되는 무게다) */
        getKpiPercentiles: async () => {
            const { rows } = await db.query(queries.getKpiPercentiles);
            return rows;
        }
    };
};
