const express = require('express');
const app = express();
const mysql = require('mysql2');
const logger = require('./utils/logger');

/* dotenv 패키지 로드 */
require('dotenv').config();

const port = process.env.PORT || 3000;

/* 데이터베이스 연결 객체 생성 */
let db = null;
try {
    db = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE
    });
} catch (error) {
    logger.error('데이터베이스 연결 객체 생성 중 오류:', { stack: error.stack });
}

/* 미들웨어 설정 */
app.use(express.json());
app.use(express.static('public'));  // 정적 파일 서빙은 DB 연결과 상관없이 항상 가능

/* 데이터베이스 연결 */
db.connect((err) => {
    if (err) {
        logger.error('MySQL 연결 실패:', { stack: err.stack });
        return;
    }
    logger.info('MySQL 연결 성공!');

    /* 데이터베이스 연결 성공 시 이하 모든 설정을 진행 */

    /* 라우터를 불러오고 DB 객체를 전달 */
    const inquiryRoutes = require('./routes/inquiryRoutes')(db);
    /* API 라우터 사용 */
    app.use('/api', inquiryRoutes);

    /* 에러 미들웨어 : 모든 라우터 처리 후, 예상치 못한 에러처리 */
    app.use((err, req, res, next) => {
        logger.error(`서버 에러 발생: ${err.message}`, { stack: err.stack });
        res.status(500).send('서버에서 에러가 발생했습니다.');
    });

    /* 서버 시작 */
    app.listen(port, () => {
        logger.info(`웹 서버가 실행되었습니다: http://localhost:${port}`);
    });
});