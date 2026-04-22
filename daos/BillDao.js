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
        /* 법안 목록 (검색/필터/페이징) */
        getList: async ({ search = null, status = null, topic = null, limit = 50, offset = 0 } = {}) => {
            const { rows } = await db.query(queries.getList, [search, status, topic, limit, offset]);
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

        /* 홈 - 주목할 법안 */
        getTrending: async () => {
            const { rows } = await db.query(queries.getTrending);
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

        /* 법안 상태별 카운트 */
        getStatusCounts: async () => {
            const { rows } = await db.query(queries.getStatusCounts);
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

        /* 법안 검색 (커뮤니티 첨부용) */
        search: async (q) => {
            const term = String(q || '').trim();
            if (!term) return [];
            const { rows } = await db.query(queries.search, [term]);
            return rows;
        }
    };
};
