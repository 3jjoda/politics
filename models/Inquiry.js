import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/inquiry');

const queries = {};
fs.readdirSync(queriesPath).forEach(file => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

// 모델은 db 객체를 외부에서 주입받아 사용
export default (db) => {

    const Inquiry = {};

    /* 견적 조회 */
    Inquiry.getList = (callback) => {
        db.query(queries.getList, callback);
    };

    /* 견적 상세 조회 */
    Inquiry.getDetail = (id, callback) => {
        db.query(queries.getDetail, [id], callback);
    };

    /* 견적 저장 */
    Inquiry.insert = (inquiryData, callback) => {
        const values = [inquiryData.name, inquiryData.email, inquiryData.phone, inquiryData.message];
        db.query(queries.insert, values, callback);
    };

    return Inquiry;
};