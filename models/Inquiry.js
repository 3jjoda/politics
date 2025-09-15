const fs = require('fs');
const path = require('path');
const winston = require('winston'); // 로깅을 위해 winston을 불러옴
const logger = winston.createLogger({ /* 로거 설정 */ }); // 로거 객체를 생성 (또는 utils/logger.js에서 불러옴)

const queriesPath = path.join(__dirname, 'queries/inquiry');

const getList = fs.readFileSync(path.join(queriesPath, 'getList.sql'), 'utf8');

// 모델은 db 객체를 외부에서 주입받아 사용
module.exports = (db) => {

    const Inquiry = {};

    /* 견적 조회 */
    Inquiry.getAll = (callback) => {
        // const sql = 'SELECT id, name, email, phone, created_at FROM inquiries ORDER BY created_at DESC';
        //const formattedSql = db.format(getList); // 파라미터가 없으면 쿼리만 포맷

        //logger.info(`Executing query: ${formattedSql}`);
        db.query(getList, callback);
    };

    /* 견적 상세 조회 */
    Inquiry.getById = (id, callback) => {
        const sql = 'SELECT * FROM inquiries WHERE id = ?';
        const formattedSql = db.format(sql, [id]); // id 파라미터와 결합

        logger.info(`Executing query: ${formattedSql}`);
        db.query(sql, [id], callback);
    };

    /* 견적 저장 */
    Inquiry.create = (inquiryData, callback) => {
        const sql = 'INSERT INTO inquiries (name, email, phone, message) VALUES (?, ?, ?, ?)';
        const values = [inquiryData.name, inquiryData.email, inquiryData.phone, inquiryData.message];
        const formattedSql = db.format(sql, values); // 쿼리를 파라미터와 결합

        logger.info(`Executing query: ${formattedSql}`); // 로그에 SQL 출력
        db.query(sql, values, callback);
    };

    return Inquiry;
};