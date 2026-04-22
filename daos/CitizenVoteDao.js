import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/citizen_vote');

const queries = {};
fs.readdirSync(queriesPath).forEach(file => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => ({
    getStats: async (billId) => {
        const { rows } = await db.query(queries.getStats, [billId]);
        return rows[0];
    },
    getMyVote: async (billId, userId) => {
        const { rows } = await db.query(queries.getMyVote, [billId, userId]);
        return rows[0] ? rows[0].vote : null;
    },
    upsert: async (billId, userId, vote) => {
        const { rows } = await db.query(queries.upsert, [billId, userId, vote]);
        return rows[0];
    }
});
