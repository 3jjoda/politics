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

// 모델은 db 객체를 외부에서 주입받아 사용
export default (db) => {
    return {
        /* 법안 조회 */
        getList: async () => {
            const [rows] = await db.query(queries.getList);
            return rows;
        },

        /* 법안 조회 - 정치인 */
        getListOne: async (id) => {
            const [rows] = await db.query(queries.getListOne, id);
            return rows;
        },

        /* 법안 상세 조회 */
        getDetail: async (id) => {
            const [rows] = await db.query(queries.getDetail, id);
            return rows;
        }
    };
};
