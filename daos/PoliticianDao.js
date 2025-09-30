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
        /* 정치인 조회 */
        getList: async () => {
            const [rows] = await db.promise().query(queries.getList);
            return rows;
        },

        /* 정치인 상세 조회 */
        getDetail: async (id) => {
            const [rows] = await db.promise.query(queries.getDetail, [id], callback);
            return rows;
        }
    };
};
