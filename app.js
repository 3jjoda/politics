import express from 'express';
import pg from 'pg';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import logger from './utils/logger.js';
import dbConfig from './config/database.js';
import setupRoutes from './routes/Index.js';
import setupPassport from './config/passport.js';
import { injectUser } from './middlewares/auth.js';
import { injectBalanceGameStatus } from './middlewares/balanceGame.js';
import { getContext } from './utils/context.js';
import { contextMiddleware } from './utils/contextMiddleware.js';
import { dataFreshnessMiddleware } from './utils/dataFreshness.js';
import expressLayouts from 'express-ejs-layouts';
import { avatarHtml } from './utils/avatar.js';
import { fmtDate, fmtDateTime, timeAgo } from './utils/datetime.js';

const app = express();
const port = process.env.PORT || 3000;

/* 커넥션풀 생성 */
const db = new pg.Pool(dbConfig);

/* EJS 템플릿 엔진 설정 */
app.set('view engine', 'ejs');
app.set('views', './views');

/* 리버스 프록시 (Railway) 뒤에서 secure 쿠키 동작시키기 위해 */
app.set('trust proxy', 1);

/* 미들웨어 설정 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// maxAge 를 안 주면 serve-static 이 'Cache-Control: public, max-age=0' 을 보낸다.
// 그러면 Railway CDN 이 이 헤더를 존중해서 매 요청 origin 에 재검증하러 오고,
// 브라우저도 페이지 이동마다 정적 파일 전부를 304 왕복한다 (CDN 켠 의미가 사라짐).
// 1시간 = 세션 내 페이지 이동에서 재검증을 없애면서, 배포 후 stale 노출은 짧게.
// 자산 파일명에 해시가 없으므로(main.css / interactions.js) 이보다 길게 두려면
// layout.ejs 의 링크에 ?v= 버전 쿼리를 붙이는 작업이 선행돼야 한다.
app.use(express.static('public', { maxAge: '1h' }));
app.use(contextMiddleware);
app.use(expressLayouts);

/* EJS 전역 헬퍼 */
app.locals.avatarHtml = avatarHtml;
// 날짜 표시는 반드시 이 헬퍼들을 쓸 것 — Date 의 getFullYear/getHours 계열은
// 서버 프로세스 타임존(Railway 는 UTC)을 따라가 새벽 시간대가 하루 밀린다.
app.locals.fmtDate = fmtDate;          // 2026.08.05
app.locals.fmtDateTime = fmtDateTime;  // 2026.08.05 01:00
app.locals.timeAgo = timeAgo;          // 3시간 전 (7일 초과 시 날짜)

/* ===== 세션 (PostgreSQL 저장) ===== */
const PgSession = connectPgSimple(session);
app.use(session({
    store: new PgSession({
        pool: db,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'dev-only-secret-please-change',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 14,  // 14일
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

/* ===== Passport ===== */
const passport = setupPassport(db);
app.use(passport.initialize());
app.use(passport.session());

/* 모든 템플릿에 currentUser 주입 */
app.use(injectUser);

/* 모든 템플릿에 법안 데이터 갱신 시각 주입 (10분 캐시) */
app.use(dataFreshnessMiddleware(db));

/* 모든 템플릿에 balanceGameCompleted boolean 주입 — D 레이어 미완료 배지용 */
app.use(injectBalanceGameStatus(db));

/* db.query 래핑: SQL + 결과 건수 자동 로깅 */
const originalQuery = db.query.bind(db);
db.query = async function (sql, values) {
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

/* 서버 초기화 */
const startServer = async () => {
    try {
        setupRoutes(app, db);

        app.use((err, req, res, next) => {
            logger.error(`서버 에러 발생: ${err.message}`, { stack: err.stack });
            res.status(500).send('서버에서 에러가 발생했습니다.');
        });

        app.listen(port, () => {
            logger.info(`웹 서버가 실행되었습니다: http://localhost:${port}`);
        });
    } catch (error) {
        logger.error(`서버 초기화 중 오류 발생: ${error.message}\n${error.stack}`);
    }
};

startServer();
