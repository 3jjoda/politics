// middlewares/pageViews.js — 방문 통계 수집 (관리자 전용 `/admin/stats` 의 소스)
//
// 무엇을 세나: 사람이 브라우저로 연 HTML 페이지. 일별 × 페이지 종류(× 상세 대상) 로 페이지뷰·유니크.
// 무엇을 안 남기나: IP · UA · 리퍼러 · 쿠키 값. DB 에는 **숫자만** 간다 (ddl/migrations/2026-08-16-page-views.sql).
//
// 🔴 요청마다 DB 를 치지 않는다. 메모리 버퍼 → FLUSH_MS 마다 UPSERT 한 번. 재시작 시 최대 한 주기분 유실은 감수.
// 🔴 봇 필터가 이 지표의 생명선이다. 2026-08-14 크롤러 116,880건이 그대로 세어지면 그래프가 통째로 죽는다.
//    ① UA 봇 패턴 ② `Sec-Fetch-Dest: document` (브라우저 탐색만 — curl·대부분의 크롤러는 안 보낸다)
//    ③ Accept 에 text/html ④ 정적·API·관리자·robots/sitemap 제외 ⑤ 응답 200 + text/html 만.
//    그래도 완벽하지 않다 — 관리자 화면에 "Cloudflare 수치와 같이 볼 것" 각주가 붙는 이유.
// 🔴 유니크는 근사다. 하루 단위 Set 을 메모리에 들고 판정하므로 프로세스가 재시작되면 그날 방문자가 다시 세어진다.
//
// 방문자 식별: 경량 쿠키 `_v` (랜덤 16hex · 1년 · httpOnly). 세션을 만들지 않는다 —
//    `saveUninitialized:false` 라 비로그인 방문자는 세션이 없고, 방문자마다 세션 행을 만들면 session 테이블만 불어난다.
//    cookie-parser 가 없어 헤더를 직접 파싱한다.
//    ⚠️ 이 쿠키는 개인정보처리방침 6항(쿠키)에 적혀 있다 — 이름·기간을 바꾸면 거기도 같이.

import crypto from 'crypto';
import logger from '../utils/logger.js';

export const FLUSH_MS = 60_000;
const COOKIE = '_v';
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 365;

/* 페이지 분류 — 순서대로 첫 매치. 상세는 대상 id 를 같이 잡는다 (어느 법안·의원이 보였는지). */
export const PAGE_KINDS = [
    { kind: 'home',              label: '홈',          re: /^\/$/ },
    { kind: 'briefing_detail',   label: '브리핑 상세', re: /^\/briefing\/(\d+)\/?$/ },
    { kind: 'briefing',          label: '브리핑',      re: /^\/briefing\/?$/ },
    { kind: 'politician_detail', label: '의원 상세',   re: /^\/politician\/([A-Za-z0-9_-]+)\/?$/ },
    { kind: 'politician',        label: '의원 목록',   re: /^\/politician\/?$/ },
    { kind: 'bill_detail',       label: '법안 상세',   re: /^\/bill\/([A-Za-z0-9_-]+)\/?$/ },
    { kind: 'bill',              label: '법안 목록',   re: /^\/bill\/?$/ },
    { kind: 'xray_chart',        label: '차트 만들기', re: /^\/xray\/chart\/?$/ },
    { kind: 'xray',              label: '숫자로 본 국회', re: /^\/xray\/?$/ },
    { kind: 'balance',           label: '성향 진단',   re: /^\/balance-game(\/|$)/ },
    { kind: 'community',         label: '커뮤니티',    re: /^\/community(\/|$)/ },
    { kind: 'glossary',          label: '용어 설명',   re: /^\/glossary\/?$/ },
    { kind: 'about',             label: '소개',        re: /^\/about\/?$/ },
    { kind: 'other',             label: '기타',        re: /./ },
];
export const KIND_LABEL = Object.fromEntries(PAGE_KINDS.map((k) => [k.kind, k.label]));
KIND_LABEL.site = '전체';

/* 세지 않는 경로 — 세션 의존·기계용·SNS 배포용 중복 렌더 (robots.txt 의 Disallow 와 같은 목록) */
const SKIP_PATH = /^\/(api|admin|auth|my|ads\.txt|robots\.txt|sitemap\.xml|xray\/s\/|briefing\/\d+\/(card|threads))(\/|$|\?)|\.[a-z0-9]{2,5}$/i;
const BOT_UA = /bot|crawl|spider|slurp|fetch|curl|wget|python|java\/|httpclient|headless|phantom|lighthouse|pingdom|monitor|preview|facebookexternalhit|whatsapp|telegram|discord|scrapy|go-http|axios|node-fetch|okhttp|apache-http|libwww|dataprovider|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|perplexity|applebot|yandex|baidu|bingpreview|duckduck/i;

function kstToday() {
    // 로컬 getter 금지 (프로젝트 규칙) — Asia/Seoul 로 고정
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function readCookie(header, name) {
    if (!header) return null;
    for (const part of header.split(';')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        if (part.slice(0, i).trim() === name) {
            const v = part.slice(i + 1).trim();
            return /^[0-9a-f]{16,32}$/.test(v) ? v : null;   // 형식이 이상하면 새로 발급
        }
    }
    return null;
}

function classify(path) {
    for (const k of PAGE_KINDS) {
        const m = path.match(k.re);
        if (m) return { kind: k.kind, target: (m[1] || '').slice(0, 50) };
    }
    return null;
}

/* ─── 버퍼 (프로세스 단일 · 하루 단위 리셋) ─── */
const state = {
    day: null,
    pages: new Map(),   // key `${kind}|${target}` → { views, uniques }  (flush 때 비운다)
    seen: new Set(),    // `${kind}|${target}|${vid}` — 그날 이미 센 (페이지, 방문자). flush 해도 유지
    users: new Map(),   // user_id → views  (flush 때 비운다)
    flushing: false,
};

function rollDay(today) {
    if (state.day === today) return;
    state.day = today;
    state.pages = new Map();
    state.seen = new Set();
    state.users = new Map();
}

function bump(kind, target, vid) {
    const key = `${kind}|${target}`;
    let e = state.pages.get(key);
    if (!e) { e = { views: 0, uniques: 0 }; state.pages.set(key, e); }
    e.views += 1;
    const sk = `${key}|${vid}`;
    if (!state.seen.has(sk)) { state.seen.add(sk); e.uniques += 1; }
}

export async function flushPageViews(db) {
    if (state.flushing) return;
    const day = state.day;
    if (!day || (state.pages.size === 0 && state.users.size === 0)) return;
    state.flushing = true;
    const pages = state.pages; state.pages = new Map();
    const users = state.users; state.users = new Map();
    try {
        if (pages.size) {
            const rows = [...pages.entries()];
            const values = [];
            const params = [];
            rows.forEach(([key, e], i) => {
                const [kind, target] = key.split('|');
                const b = i * 4;
                values.push(`($1::date, $${b + 2}, $${b + 3}, $${b + 4}::int, $${b + 5}::int)`);
                params.push(kind, target, e.views, e.uniques);
            });
            await db.query(`
                INSERT INTO page_views_daily (view_date, page_kind, target_id, views, uniques)
                VALUES ${values.join(',')}
                ON CONFLICT (view_date, page_kind, target_id)
                DO UPDATE SET views = page_views_daily.views + EXCLUDED.views,
                              uniques = page_views_daily.uniques + EXCLUDED.uniques`,
                [day, ...params]);
        }
        if (users.size) {
            const rows = [...users.entries()];
            const values = rows.map((_, i) => `($1::date, $${i * 2 + 2}::int, $${i * 2 + 3}::int)`);
            const params = rows.flatMap(([uid, v]) => [uid, v]);
            await db.query(`
                INSERT INTO user_visit_days (visit_date, user_id, views)
                VALUES ${values.join(',')}
                ON CONFLICT (user_id, visit_date)
                DO UPDATE SET views = user_visit_days.views + EXCLUDED.views`,
                [day, ...params]);
        }
    } catch (e) {
        // 통계 때문에 서비스가 흔들리면 안 된다 — 로그만 남기고 이번 주기분은 버린다
        logger.error(`[pageViews] flush 실패 (${pages.size}p/${users.size}u 유실): ${e.message}`);
    } finally {
        state.flushing = false;
    }
}

/* 미들웨어. session·passport **뒤에** 등록해야 req.user 가 보인다. */
export function pageViews(db) {
    const timer = setInterval(() => flushPageViews(db), FLUSH_MS);
    timer.unref();
    // Railway 는 배포 시 SIGTERM 을 보낸다 — 마지막 주기분을 남긴다
    const onExit = () => {
        setTimeout(() => process.exit(0), 3000).unref();   // DB 가 안 받아도 3초 안에는 내려간다
        flushPageViews(db).finally(() => process.exit(0));
    };
    process.once('SIGTERM', onExit);
    process.once('SIGINT', onExit);

    return (req, res, next) => {
        if (req.method !== 'GET') return next();
        const path = req.path;
        if (SKIP_PATH.test(path)) return next();
        if (req.get('sec-fetch-dest') !== 'document') return next();          // 브라우저 탐색만
        if (!(req.get('accept') || '').includes('text/html')) return next();
        if (BOT_UA.test(req.get('user-agent') || '')) return next();

        const page = classify(path);
        if (!page) return next();

        let vid = readCookie(req.headers.cookie, COOKIE);
        if (!vid) {
            vid = crypto.randomBytes(8).toString('hex');
            res.cookie(COOKIE, vid, {
                maxAge: COOKIE_MAX_AGE, httpOnly: true, sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
            });
        }
        const userId = req.user?.user_id;

        res.on('finish', () => {
            if (res.statusCode !== 200) return;
            if (!String(res.get('content-type') || '').includes('text/html')) return;
            try {
                rollDay(kstToday());
                bump('site', '', vid);
                bump(page.kind, page.target, vid);
                if (userId) state.users.set(userId, (state.users.get(userId) || 0) + 1);
            } catch (e) {
                logger.error(`[pageViews] 집계 실패: ${e.message}`);
            }
        });
        next();
    };
}
