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
// 방문자 식별: 경량 쿠키 `_v` = **`<랜덤16hex>.<최초방문일 YYYYMMDD>`** (1년 · httpOnly). 세션을 만들지 않는다 —
//    `saveUninitialized:false` 라 비로그인 방문자는 세션이 없고, 방문자마다 세션 행을 만들면 session 테이블만 불어난다.
//    cookie-parser 가 없어 헤더를 직접 파싱한다.
//    ⚠️ 이 쿠키는 개인정보처리방침 6항(쿠키)에 적혀 있다 — **이름·기간뿐 아니라 담는 값이 바뀌어도** 거기를 같이 고칠 것.
//       (2026-08-27 에 날짜를 더하면서 "무작위 값" · "하루 단위 방문자 수를 세는 데만" 문구를 고쳤다)
//
// 🔴 신규/재방문은 **최초 방문일을 쿠키에 담아** 판정한다 (ddl/migrations/2026-08-27-page-views-returning.sql).
//    서버는 그 날짜를 저장하지 않고 오늘과 비교만 한다 → 방문자별 기록 없이 일별 합계만 남는 원칙 유지.
//    운영 초기에 유일하게 의미 있는 지표가 재방문인데, **소급이 안 되므로** 일찍 넣어야 한다.

import crypto from 'crypto';
import { isAdminUser } from './auth.js';
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
    /* ⚠️ 목록형 규칙에 **캡처 그룹을 쓰지 말 것** — 구분자를 잡아 target_id 가 '/' 가 된다.
       그러면 같은 종류가 target '' 와 '/' 두 행으로 갈린다 (실측 balance 11 + 14). 비캡처 (?:…) 로 */
    { kind: 'anomaly_detail',    label: '설명이 필요한 숫자 상세', re: /^\/why\/(\d{4}-\d{2}-\d{2})\/?$/ },
    { kind: 'anomaly',           label: '설명이 필요한 숫자',      re: /^\/why\/?$/ },
    { kind: 'balance',           label: '성향 진단',   re: /^\/balance-game(?:\/|$)/ },
    { kind: 'community',         label: '커뮤니티',    re: /^\/community(?:\/|$)/ },
    { kind: 'glossary',          label: '용어 설명',   re: /^\/guide\/glossary\/?$/ },
    { kind: 'guide',             label: '읽는 법',     re: /^\/guide(?:\/|$)/ },   // 목차 + 글 (glossary 는 위에서 먼저 잡힌다)
    { kind: 'about',             label: '소개',        re: /^\/about\/?$/ },
    { kind: 'other',             label: '기타',        re: /./ },
];
export const KIND_LABEL = Object.fromEntries(PAGE_KINDS.map((k) => [k.kind, k.label]));
KIND_LABEL.site = '전체';

/* 세지 않는 경로 — 세션 의존·기계용·SNS 배포용 중복 렌더 (robots.txt 의 Disallow 와 같은 목록)
   ⚠️ /promo 를 빠뜨리면 운영자가 로그아웃 상태(폰에서 PNG 저장 등)로 열 때 `other` 로 잡혀 비회원 방문이 부푼다 */
const SKIP_PATH = /^\/(api|admin|auth|my|promo|ads\.txt|robots\.txt|sitemap\.xml|xray\/s\/|briefing\/\d+\/(card|threads))(\/|$|\?)|\.[a-z0-9]{2,5}$/i;
const BOT_UA = /bot|crawl|spider|slurp|fetch|curl|wget|python|java\/|httpclient|headless|phantom|lighthouse|pingdom|monitor|preview|facebookexternalhit|whatsapp|telegram|discord|scrapy|go-http|axios|node-fetch|okhttp|apache-http|libwww|dataprovider|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|perplexity|applebot|yandex|baidu|bingpreview|duckduck/i;
/* 🔴 로컬·사설망 접속은 세지 않는다 — 개발하면서 연 페이지가 그대로 지표에 섞인다.
   운영 초기엔 이게 관리자 브라우징만큼 크다 (실측: 하루 전체 뷰의 절반이 로컬 테스트였다).
   ⚠️ 관리자 제외(isAdminUser)로는 못 막는다 — 로컬은 대개 로그아웃 상태로 열기 때문이다.
   ⚠️ req.hostname 은 trust proxy 설정을 따라 X-Forwarded-Host 를 본다 (Railway 뒤에서도 공개 호스트가 잡힌다).
   사설망(10./192.168./172.16~31.)까지 넣은 건 실기기 테스트를 폰에서 LAN 으로 열기 때문이다. */
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[?::1\]?|0\.0\.0\.0|[a-z0-9-]+\.local|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/i;

function kstToday() {
    // 로컬 getter 금지 (프로젝트 규칙) — Asia/Seoul 로 고정
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function readCookie(header, name) {
    if (!header) return null;
    for (const part of header.split(';')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
    }
    return null;
}

/* `_v` 파싱 — `<16hex>.<YYYYMMDD>`(현행) 또는 `<16hex>`(2026-08-27 이전).
   ⚠️ 구 형식은 최초 방문일을 모르지만 **쿠키가 있다는 것 자체가 전에 왔다는 뜻**이라 재방문으로 본다.
      대신 오늘 날짜로 다시 발급하므로, 도입 직후 며칠만 재방문이 과소 계상되고 그다음부터 정상이다. */
function parseVid(raw) {
    const m = /^([0-9a-f]{16,32})(?:\.(\d{8}))?$/.exec(raw || '');
    if (!m) return null;                              // 형식이 이상하면 새로 발급
    return { vid: m[1], firstSeen: m[2] || null };    // firstSeen null = 구 형식
}

function setVidCookie(res, vid, today) {
    res.cookie(COOKIE, `${vid}.${today.replace(/-/g, '')}`, {
        maxAge: COOKIE_MAX_AGE, httpOnly: true, sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
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
    seen: new Set(),    // `${kind}|${target}|${vid}` 와 `visitor|${vid}` — 그날 이미 센 것. flush 해도 유지
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

/* ⚠️ 회원 뷰를 **같은 행에 별도 컬럼**으로 센다 (views 는 전체 그대로).
      비회원 = views - member_views. 자세한 이유는 ddl/migrations/2026-08-18-page-views-member-split.sql */
function bump(kind, target, vid, isMember) {
    const key = `${kind}|${target}`;
    let e = state.pages.get(key);
    if (!e) { e = { views: 0, uniques: 0, mViews: 0, mUniques: 0, newV: 0, retV: 0 }; state.pages.set(key, e); }
    e.views += 1;
    if (isMember) e.mViews += 1;
    const sk = `${key}|${vid}`;
    if (!state.seen.has(sk)) { state.seen.add(sk); e.uniques += 1; }
    // ⚠️ 유니크는 로그인 상태별로 따로 센다 — 같은 사람이 하루에 두 상태로 보면 양쪽에 1씩 잡힌다 (근사값)
    const mk = `${key}|${vid}|m`;
    if (isMember && !state.seen.has(mk)) { state.seen.add(mk); e.mUniques += 1; }
}

/* 신규/재방문 — **사이트 단위로 하루 한 번만** 센다 ('site' 행에만 값이 들어간다).
   🔴 페이지마다 세면 한 방문자가 본 페이지 수만큼 중복돼 합계가 방문자 수를 넘는다.
   ⚠️ 회원/비회원으로 나누지 않는다 — 쿠키는 사람을 모른다. */
function bumpVisitor(vid, isNew) {
    const vk = `visitor|${vid}`;
    if (state.seen.has(vk)) return;
    state.seen.add(vk);
    const e = state.pages.get('site|');
    if (!e) return;                       // bump('site', …) 이 먼저 불린다 — 방어
    if (isNew) e.newV += 1; else e.retV += 1;
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
                const b = i * 8;
                values.push(`($1::date, $${b + 2}, $${b + 3}, $${b + 4}::int, $${b + 5}::int, $${b + 6}::int, $${b + 7}::int, $${b + 8}::int, $${b + 9}::int)`);
                params.push(kind, target, e.views, e.uniques, e.mViews, e.mUniques, e.newV, e.retV);
            });
            await db.query(`
                INSERT INTO page_views_daily (view_date, page_kind, target_id, views, uniques, member_views, member_uniques, new_visitors, returning_visitors)
                VALUES ${values.join(',')}
                ON CONFLICT (view_date, page_kind, target_id)
                DO UPDATE SET views = page_views_daily.views + EXCLUDED.views,
                              uniques = page_views_daily.uniques + EXCLUDED.uniques,
                              member_views = page_views_daily.member_views + EXCLUDED.member_views,
                              member_uniques = page_views_daily.member_uniques + EXCLUDED.member_uniques,
                              new_visitors = page_views_daily.new_visitors + EXCLUDED.new_visitors,
                              returning_visitors = page_views_daily.returning_visitors + EXCLUDED.returning_visitors`,
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
        if (LOCAL_HOST.test(req.hostname || '')) return next();   // 로컬·사설망 = 개발 중인 나. 위 LOCAL_HOST 주석 참조
        const path = req.path;
        if (SKIP_PATH.test(path)) return next();
        if (req.get('sec-fetch-dest') !== 'document') return next();          // 브라우저 탐색만
        if (!(req.get('accept') || '').includes('text/html')) return next();
        if (BOT_UA.test(req.get('user-agent') || '')) return next();

        /* 🔴 관리자는 아예 세지 않는다. 운영 초기엔 **본인 브라우징이 통계를 지배한다** —
           실측 2026-08-16 전체 192뷰 중 관리자 1명이 131뷰(68%)였다.
           제외해야 회원 지표도 "진짜 사용자" 를 가리킨다.
           ⚠️ 관리자가 로그아웃 상태로 보면 비회원으로 잡힌다 — 이건 막을 수 없다 (쿠키만으로는 사람을 모른다) */
        if (isAdminUser(req.user)) return next();

        const page = classify(path);
        if (!page) return next();

        const today = kstToday();
        const parsed = parseVid(readCookie(req.headers.cookie, COOKIE));
        let vid, isNewVisitor;
        if (!parsed) {
            vid = crypto.randomBytes(8).toString('hex');
            isNewVisitor = true;
            setVidCookie(res, vid, today);
        } else {
            vid = parsed.vid;
            isNewVisitor = parsed.firstSeen === today;
            if (!parsed.firstSeen) setVidCookie(res, vid, today);   // 구 형식 → 날짜를 붙여 다시 발급 (위 parseVid 주석)
        }
        const userId = req.user?.user_id;
        const isMember = Boolean(userId);

        res.on('finish', () => {
            if (res.statusCode !== 200) return;
            if (!String(res.get('content-type') || '').includes('text/html')) return;
            try {
                rollDay(today);
                bump('site', '', vid, isMember);          // ⚠️ bumpVisitor 가 'site|' 엔트리를 쓰므로 먼저
                bump(page.kind, page.target, vid, isMember);
                bumpVisitor(vid, isNewVisitor);
                if (userId) state.users.set(userId, (state.users.get(userId) || 0) + 1);
            } catch (e) {
                logger.error(`[pageViews] 집계 실패: ${e.message}`);
            }
        });
        next();
    };
}
