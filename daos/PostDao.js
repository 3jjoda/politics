import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/post');

const queries = {};
fs.readdirSync(queriesPath).forEach(file => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => ({
    list: async ({ limit = 20, offset = 0, postType = null } = {}) => {
        const { rows } = await db.query(queries.list, [limit, offset, postType]);
        return rows;
    },
    /* 커뮤니티 통합 피드 — 글 + 댓글 한 줄기 (queries/post/listFeed.sql 머리 주석 참조) */
    listFeed: async ({ filter = 'all', postType = null, limit = 20, offset = 0 } = {}) => {
        const { rows } = await db.query(queries.listFeed, [filter, postType, limit, offset]);
        return rows;
    },

    /* 법안 상세의 「이 법안을 다룬 글」 — 실패해도 법안 페이지는 살아야 하므로 호출부가 catch 한다 */
    listByBillId: async (billId, limit = 5) => {
        const { rows } = await db.query(queries.listByBillId, [billId, limit]);
        return rows;
    },
    countByType: async () => {
        const { rows } = await db.query(queries.countByType);
        return rows;
    },
    getById: async (id) => {
        const { rows } = await db.query(queries.getById, [id]);
        return rows[0] || null;
    },
    insert: async ({ userId, title, content, linkedBillId = null, postType = 'free', isPinned = false }) => {
        const { rows } = await db.query(queries.insert, [userId, title, content, linkedBillId, postType, isPinned]);
        return rows[0];
    },
    update: async ({ id, userId, title, content, linkedBillId = null, postType = 'free', isPinned = false }) => {
        const { rows } = await db.query(queries.update, [title, content, linkedBillId, postType, isPinned, id, userId]);
        return rows[0] || null;
    },
    softDelete: async ({ id, userId }) => {
        const { rows } = await db.query(queries.softDelete, [id, userId]);
        return rows[0] || null;
    },
    incrementViews: async (id) => {
        const { rows } = await db.query(queries.incrementViews, [id]);
        return rows[0] || null;
    }
});
