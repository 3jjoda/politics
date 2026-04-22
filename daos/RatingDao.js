import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/rating');

const queries = {};
fs.readdirSync(queriesPath).forEach(file => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => ({
    getStats: async (politicianId) => {
        const { rows } = await db.query(queries.getStats, [politicianId]);
        return rows[0];
    },
    getMyScore: async (politicianId, userId) => {
        const { rows } = await db.query(queries.getMyScore, [politicianId, userId]);
        return rows[0] ? rows[0].score : null;
    },
    upsert: async (politicianId, userId, score) => {
        const { rows } = await db.query(queries.upsert, [politicianId, userId, score]);
        return rows[0];
    }
});
