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

// 모델은 db 객체를 외부에서 주입받아 사용
export default (db) => {
    const dao = {};

    /* 정치인 조회 */
    dao.getList = (callback) => {
        db.query(queries.getList, callback);
    };

    /* 정치인 상세 조회 */
    dao.getDetail = (id, callback) => {
        db.query(queries.getDetail, [id], callback);
    };

    /* 정치인 저장 */
    dao.insert = (politicianData, callback) => {
        const values = [
            politicianData.name, 
            politicianData.party, 
            politicianData.position, 
            politicianData.district, 
            politicianData.phone, 
            politicianData.email, 
            politicianData.biography
        ];
        db.query(queries.insert, values, callback);
    };

    return dao;
};
