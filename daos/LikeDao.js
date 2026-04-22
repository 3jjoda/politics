import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/like');

const queries = {};
fs.readdirSync(queriesPath).forEach(file => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => ({
    count: async (type, targetId) => {
        const { rows } = await db.query(queries.count, [type, targetId]);
        return rows[0].cnt;
    },
    findMy: async (type, targetId, userId) => {
        const { rows } = await db.query(queries.findMy, [type, targetId, userId]);
        return rows[0] || null;
    },
    insert: async (type, targetId, userId) => {
        const { rows } = await db.query(queries.insert, [type, targetId, userId]);
        return rows[0] || null;
    },
    remove: async (type, targetId, userId) => {
        const { rows } = await db.query(queries.delete, [type, targetId, userId]);
        return rows[0] || null;
    }
});
