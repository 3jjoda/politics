import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/comment');

const queries = {};
fs.readdirSync(queriesPath).forEach(file => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => ({
    list: async (type, targetId) => {
        const { rows } = await db.query(queries.list, [type, targetId]);
        return rows;
    },
    findById: async (id) => {
        const { rows } = await db.query(queries.findById, [id]);
        return rows[0] || null;
    },
    insert: async ({ type, targetId, parentId = null, userId, content }) => {
        const { rows } = await db.query(queries.insert, [type, targetId, parentId, userId, content]);
        return rows[0];
    },
    update: async ({ id, userId, content }) => {
        const { rows } = await db.query(queries.update, [content, id, userId]);
        return rows[0] || null;
    },
    softDelete: async ({ id, userId }) => {
        const { rows } = await db.query(queries.softDelete, [id, userId]);
        return rows[0] || null;
    }
});
