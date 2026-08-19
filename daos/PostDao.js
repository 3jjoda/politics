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
