import express from 'express'; 
import mysql from 'mysql2';
import logger from './utils/logger.js';
import dbConfig from './config/database.js';
import { getContext } from './utils/context.js';
import { contextMiddleware } from './utils/contextMiddleware.js';

const app = express();
const port = process.env.PORT || 3000;

/* 커넥션풀 생성 */
const db = mysql.createPool(dbConfig);

/* 미들웨어 설정 */
app.use(express.json());
app.use(express.static('public'));
app.use(contextMiddleware); // 모든 요청에 대해 컨텍스트 연결

/* db.query 래핑: SQL + 결과 건수 자동 로깅 */
const originalQuery = db.query.bind(db);

db.query = function (sql, values, callback) {
    if (typeof values === 'function') {
        callback = values;
        values = [];
    }

    // request 정보를 가진 context
    const context = getContext();
    const { route, action } = context;

    const requestTag = route && action ? `request:${route}/${action}` : '';
    const allowedKeys = ['method', 'user', 'requestId'];

    const otherTags = Object.entries(context)
                            .filter(([k]) => allowedKeys.includes(k))
                            .map(([k, v]) => `${k}:${v}`)
                            .join(' ');

    const tag = [requestTag, otherTags].filter(Boolean).join(' ');
    const formattedSql = mysql.format(sql, values);
    logger.info(`Executing query: /* ${tag} */\n${formattedSql}`);
    const start = Date.now(); // 시작 시간 기록

    const wrappedCallback = function (err, results, fields) {
        const duration = Date.now() - start; // 실행 시간 계산

        let speedTag = 'FAST';
        if (duration > 800) speedTag = 'CRITICAL';
        else if (duration > 200) speedTag = 'SLOW';

        const timeTag = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`;
        const timeLog = timeTag + ': ' + speedTag;

        if (err) {
            logger.error(`Query error: ${err.message} /* ${timeLog} */`);
        } else if (Array.isArray(results)) {
            logger.info(`Query result: ${results.length}건 조회됨 /* ${timeLog} */`);
        } else if (results && typeof results === 'object' && 'affectedRows' in results) {
            logger.info(`Query result: ${results.affectedRows}건 영향받음 /* ${timeLog} */`);
        } else {
            logger.info(`Query result: 형식 확인 필요 /* ${timeLog} */`);
        }
        callback(err, results, fields);
    };

    return originalQuery(sql, values, wrappedCallback);
};

/* 서버 초기화 함수 */
const startServer = async () => {
    try {
        // 라우터 목록 정의
        const routeModules = [
            { path: '/api', file: './routes/inquiryRoutes.js' }
            // 여기에 추가 가능: { path: '/api/users', file: './routes/userRoutes.js' }
        ];

        // 라우터 불러오기 및 등록
        for (const route of routeModules) {
            const module = await import(route.file);
            app.use(route.path, module.default(db));
        }

        // 에러 핸들링 미들웨어
        app.use((err, req, res, next) => {
            logger.error(`서버 에러 발생: ${err.message}`, { stack: err.stack });
            res.status(500).send('서버에서 에러가 발생했습니다.');
        });

        // 서버 시작
        app.listen(port, () => {
            logger.info(`웹 서버가 실행되었습니다: http://localhost:${port}`);
        });
    } catch (error) {
        logger.error('서버 초기화 중 오류 발생:', { stack: error.stack });
    }
};

startServer();