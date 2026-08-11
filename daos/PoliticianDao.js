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

        /* 의원별 표결 내역 */
        getVotesByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getVotesByMonaCd, [monaCd]);
            return rows;
        },

        /* 의원별 관심분야 TOP5 */
        getTopicsByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getTopicsByMonaCd, [monaCd]);
            return rows;
        },

        /* 의원별 월별 발의 */
        getMonthlyBillsByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getMonthlyBillsByMonaCd, [monaCd]);
            return rows;
        },

        /* 의원별 주요 법안 타임라인 */
        getTimelineByMonaCd: async (monaCd) => {
            const { rows } = await db.query(queries.getTimelineByMonaCd, [monaCd]);
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

        /* 레이더 스케일 기준값 (현역 의원 중 최대치) */
        getRadarScale: async () => {
            const { rows } = await db.query(queries.getRadarScale);
            return rows[0];
        }
    };
};
