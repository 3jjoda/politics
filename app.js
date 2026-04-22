import express from 'express';
import pg from 'pg';
import logger from './utils/logger.js';
import dbConfig from './config/database.js';
import setupRoutes from './routes/Index.js';
import { getContext } from './utils/context.js';
import { contextMiddleware } from './utils/contextMiddleware.js';
import expressLayouts from 'express-ejs-layouts';
import { avatarHtml } from './utils/avatar.js';
// import session from 'express-session'; // 세션 라이브러리
// import { visitorCounter } from './utils/visitorCounter.js'; // 방문자 카운터

const app = express();
const port = process.env.PORT || 3000;

/* 커넥션풀 생성 */
const db = new pg.Pool(dbConfig);

/* EJS 템플릿 엔진 설정 */
app.set('view engine', 'ejs');
app.set('views', './views'); // ejs 파일들이 있는 디렉토리 지정

/* 미들웨어 설정 */
app.use(express.json());
app.use(express.static('public'));
app.use(contextMiddleware); // 모든 요청에 대해 컨텍스트 연결
app.use(expressLayouts);    // 공통 layout 설정

/* EJS 전역 헬퍼 등록 */
app.locals.avatarHtml = avatarHtml;
// app.use(session({
//     secret: 'a_very_secret_key_for_session', // 실제 프로젝트에서는 .env 파일로 관리하세요.
//     resave: false,
//     saveUninitialized: true,
//     cookie: { maxAge: 24 * 60 * 60 * 1000 } // 쿠키 유효기간: 1일 (하루 기준)
// }));

// 방문자 카운터 미들웨어 적용
// app.use(visitorCounter());

/* db.query 래핑: SQL + 결과 건수 자동 로깅 */
const originalQuery = db.query.bind(db);

db.query = async function (sql, values) {
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
    logger.info(`Executing query: /* ${tag} */\n${sql}`);
    const start = Date.now();

    try {
        const result = await originalQuery(sql, values);
        const duration = Date.now() - start;

        let speedTag = 'FAST';
        if (duration > 800) speedTag = 'CRITICAL';
        else if (duration > 200) speedTag = 'SLOW';

        const timeTag = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`;
        const timeLog = timeTag + ': ' + speedTag;

        if (Array.isArray(result.rows)) {
            logger.info(`Query result: ${result.rows.length}건 조회됨 /* ${timeLog} */`);
        } else if (result.rowCount != null) {
            logger.info(`Query result: ${result.rowCount}건 영향받음 /* ${timeLog} */`);
        } else {
            logger.info(`Query result: 형식 확인 필요 /* ${timeLog} */`);
        }

        return result;
    } catch (err) {
        const duration = Date.now() - start;
        const timeTag = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`;
        logger.error(`Query error: ${err.message} /* ${timeTag} */`);
        throw err;
    }
};

/* 서버 초기화 함수 */
const startServer = async () => {
    try {
        // 라우터 목록 정의
        setupRoutes(app, db);

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
        logger.error(`서버 초기화 중 오류 발생: ${error.message}\n${error.stack}`);
    }
};

startServer();
