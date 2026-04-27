import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/user');

const queries = {};
fs.readdirSync(queriesPath).forEach(file => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => ({
    findById: async (userId) => {
        const { rows } = await db.query(queries.findById, [userId]);
        return rows[0] || null;
    },
    findByProvider: async (provider, providerId) => {
        const { rows } = await db.query(queries.findByProvider, [provider, providerId]);
        return rows[0] || null;
    },
    findByEmail: async (email) => {
        const { rows } = await db.query(queries.findByEmail, [email]);
        return rows[0] || null;
    },
    nicknameExists: async (nickname) => {
        const { rows } = await db.query(queries.nicknameExists, [nickname]);
        return rows.length > 0;
    },
    insertOAuth: async ({ email, nickname, provider, providerId, gender = null, ageGroup = null }) => {
        const { rows } = await db.query(queries.insertOAuth, [
            email, nickname, provider, providerId, gender, ageGroup
        ]);
        return rows[0];
    },
    withdraw: async (userId) => {
        const { rows } = await db.query(queries.withdraw, [userId]);
        return rows[0] || null;
    },
    updateNickname: async (userId, nickname) => {
        const { rows } = await db.query(queries.updateNickname, [userId, nickname]);
        return rows[0] || null;
    }
});
