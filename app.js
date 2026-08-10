import express from 'express';
import pg from 'pg';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import logger from './utils/logger.js';
import dbConfig from './config/database.js';
import setupRoutes from './routes/Index.js';
import setupPassport from './config/passport.js';
import { injectUser } from './middlewares/auth.js';
import { canonicalHost } from './middlewares/canonicalHost.js';
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

/* 대표 도메인으로 통일 — www·railway.app 로 들어와도 BASE_URL 주소로 301.
   정적 파일까지 몰아주려고 static 보다 앞에 둔다. BASE_URL 이 로컬이면 자동 비활성. */
app.use(canonicalHost());

/* 미들웨어 설정 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// maxAge 를 안 주면 serve-static 이 'Cache-Control: public, max-age=0' 을 보낸다.
// 그러면 Railway CDN 이 이 헤더를 존중해서 매 요청 origin 에 재검증하러 오고,
// 브라우저도 페이지 이동마다 정적 파일 전부를 304 왕복한다 (CDN 켠 의미가 사라짐).
// 자산 파일명에 해시가 없지만(main.css / interactions.js / 브랜드 SVG) 아래 asset() 헬퍼가
// 배포마다 바뀌는 ?v= 를 붙여주므로, 캐시가 길어도 배포 즉시 새 파일을 받는다.
app.use(express.static('public', { maxAge: '1h' }));
app.use(contextMiddleware);
app.use(expressLayouts);

/* 정적 자산 버전 — 캐시 무효화용
   파일명에 해시가 없어서(main.css / interactions.js / 브랜드 SVG 는 이름 고정, 내용만 교체)
   Cache-Control: max-age 동안 브라우저가 옛 파일을 그대로 쓴다.
   실제로 리브랜딩 배포 때 wordmark-nav.svg 가 구브랜드로 남는 문제가 있었음.
   → 링크에 ?v= 를 붙여 배포마다 URL 이 바뀌게 한다.
   Railway 는 RAILWAY_GIT_COMMIT_SHA 를 주입하므로 배포 단위로 값이 바뀌고,
   로컬은 프로세스 기동 시각을 써서 서버 재시작마다 갱신된다. */
const ASSET_VER = (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 8) || Date.now().toString(36);
app.locals.assetVer = ASSET_VER;
// 정적 파일 링크는 반드시 이 헬퍼를 거칠 것 — 안 붙이면 배포 후 stale 자산이 노출된다.
app.locals.asset = (p) => `${p}${p.includes('?') ? '&' : '?'}v=${ASSET_VER}`;

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

        /* 404 캐치올 — 라우트에 안 걸린 URL.
           이게 없으면 Express 기본 'Cannot GET /xxx' 영문 평문 페이지가 노출된다. */
        app.use((req, res) => {
            res.status(404).render('error_pages/404', {
                pageTitle: '페이지를 찾을 수 없습니다',
                pageStyles: 'error',
                currentUrl: req.originalUrl,
                message: '주소가 바뀌었거나 삭제된 페이지입니다.',
                detail: req.originalUrl
            }, (renderErr, html) => {
                if (renderErr) {
                    logger.error(`404 페이지 렌더 실패: ${renderErr.message}`);
                    return res.type('text/plain; charset=utf-8').send('페이지를 찾을 수 없습니다.');
                }
                res.send(html);
            });
        });

        /* 전역 에러 핸들러.
           ⚠️ 렌더 자체가 실패하는 경우까지 감안할 것 — 실제로 error_pages/404 뷰가 없던 시절
              404 분기가 렌더에 실패해 전부 500 으로 떨어지는 문제가 있었다.
              여기서 또 던지면 Express 기본 핸들러로 넘어가 스택트레이스가 노출될 수 있으므로
              반드시 평문 fallback 으로 끝낸다. */
        app.use((err, req, res, next) => {
            logger.error(`서버 에러 발생: ${err.message}`, { stack: err.stack });
            if (res.headersSent) return next(err);   // 응답이 이미 나가는 중이면 손대지 않는다
            res.status(500).render('error_pages/500', {
                pageTitle: '서버 오류',
                pageStyles: 'error',
                currentUrl: req.originalUrl
            }, (renderErr, html) => {
                if (renderErr) {
                    logger.error(`500 페이지 렌더 실패: ${renderErr.message}`);
                    return res.type('text/plain; charset=utf-8').send('서버에서 에러가 발생했습니다.');
                }
                res.send(html);
            });
        });

        app.listen(port, () => {
            logger.info(`웹 서버가 실행되었습니다: http://localhost:${port}`);
        });
    } catch (error) {
        logger.error(`서버 초기화 중 오류 발생: ${error.message}\n${error.stack}`);
    }
};

startServer();
