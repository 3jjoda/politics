import logger from './logger.js';
import { GUIDE_ARTICLES } from './guideArticles.js';

/* sitemap.xml — 크롤러에게 "실제로 색인할 URL" 목록을 명시적으로 준다.

   robots.txt 가 필터 쿼리스트링(/bill?… · /politician?…)과 /xray/chart 를 막기 때문에,
   그것만 하면 목록 2페이지 이후의 상세 페이지로 갈 길이 끊긴다. 사이트맵이 그 보완이다.
   목적은 "크롤러를 무한 조합 공간이 아니라 유한한 실제 콘텐츠로 유도" 하는 것.

   ⚠️ 6시간 메모리 캐시 + inflight 공유 필수 — 법안만 18,000행이라 크롤러가 반복 호출하면
      그 자체가 새 부하가 된다. XrayService 의 섹션 캐시와 같은 수법.
   ⚠️ 쿼리 하나가 실패해도 전체를 죽이지 않는다 (allSettled). 사이트맵은 일부라도 있는 게
      아무것도 없는 것보다 낫고, 크롤러는 404 를 받으면 한동안 재시도하지 않는다. */

const TTL_MS = 6 * 60 * 60 * 1000;   // 6시간
const URL_LIMIT = 50000;             // 사이트맵 1개 파일의 규격 상한 (현재 약 19,000)

/* 정적 페이지 — [경로, changefreq, priority].
   ⚠️ 로그인·세션에 따라 내용이 달라지는 페이지(/my·/auth·/balance-game/respond…)는 넣지 않는다.
      robots.txt 에서도 막고 있으므로 여기 넣으면 서로 모순된 신호를 준다. */
const STATIC_PATHS = [
    ['/',             'daily',   '1.0'],
    ['/briefing',     'daily',   '0.9'],
    ['/bill',         'daily',   '0.9'],
    ['/politician',   'weekly',  '0.9'],
    ['/xray',         'weekly',  '0.7'],
    ['/community',    'daily',   '0.6'],
    ['/balance-game', 'monthly', '0.6'],
    ['/balance-game/types', 'monthly', '0.5'],
    ['/guide/glossary', 'monthly', '0.5'],   // 구 /glossary 는 301
    ['/about',        'monthly', '0.3'],
    ['/privacy',      'yearly',  '0.1'],
    ['/terms',        'yearly',  '0.1'],
    /* 「읽는 법」 — 사람이 쓴 해설 글. 목록은 guideArticles.js 가 단일 소스 (2026-08-19) */
    ['/guide',        'monthly', '0.7'],
    ...GUIDE_ARTICLES.map((a) => [`/guide/${a.slug}`, 'monthly', '0.7']),
];

/* 상세 페이지 소스.
   lastmod 는 TO_CHAR 로 문자열화해서 받는다 — DATE 를 JS Date 로 받으면 타임존 해석이 끼어
   하루 밀린다 (프로젝트 공통 규칙). DB 기본 타임존이 KST 라 조회는 명시 변환하지 않는다. */
const SOURCES = [
    {
        /* 🔴 AI 분석이 있는 법안만 (2026-08-19). 전건(18,741)을 싣던 것을 좁혔다.
           AdSense 가 "가치가 별로 없는 콘텐츠" 로 반려 — 사이트맵의 98% 가 법안 상세인데 그 본문은
           국회 원문(bills.summary) 그대로라 검색엔진 입장에선 assembly.go.kr 를 복제한 얇은 페이지 수만 장이었다.
           분석 없는 법안 상세는 컨트롤러가 noindex 를 건다 (BillController.getDetailPage). 두 곳은 같은 조건이어야 한다 */
        key: 'bills',
        prefix: '/bill/',
        changefreq: 'monthly',
        priority: '0.7',
        sql: `SELECT b.bill_id AS slug, TO_CHAR(GREATEST(b.updated_at, a.updated_at), 'YYYY-MM-DD') AS lastmod
                FROM bills b
                JOIN bill_ai_analysis a ON a.bill_id = b.bill_id
               ORDER BY b.propose_dt DESC NULLS LAST`,
    },
    {
        key: 'politicians',
        prefix: '/politician/',
        changefreq: 'weekly',
        priority: '0.8',
        sql: `SELECT mona_cd AS slug, TO_CHAR(updated_at, 'YYYY-MM-DD') AS lastmod
                FROM politicians
               WHERE mona_cd IS NOT NULL`,
    },
    {
        key: 'briefings',
        prefix: '/briefing/',
        changefreq: 'never',        // 카드는 한 번 쓰면 고치지 않는다는 원칙과 일치
        priority: '0.8',
        sql: `SELECT id AS slug, TO_CHAR(briefing_date, 'YYYY-MM-DD') AS lastmod
                FROM briefing_posts
               ORDER BY briefing_date DESC`,
    },
    {
        key: 'posts',
        prefix: '/community/',
        changefreq: 'weekly',
        priority: '0.5',
        sql: `SELECT id AS slug, TO_CHAR(updated_at, 'YYYY-MM-DD') AS lastmod
                FROM posts
               WHERE is_deleted = FALSE
               ORDER BY id DESC`,
    },
];

const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/* lastmod 는 W3C Datetime 이어야 한다. 형식이 어긋나면 넣지 않는 편이 낫다
   (잘못된 lastmod 는 크롤러가 사이트맵 전체를 무시하는 사유가 된다). */
const isYmd = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function urlEntry(base, path, lastmod, changefreq, priority) {
    const parts = [`<loc>${esc(base + path)}</loc>`];
    if (isYmd(lastmod)) parts.push(`<lastmod>${lastmod}</lastmod>`);
    if (changefreq) parts.push(`<changefreq>${changefreq}</changefreq>`);
    if (priority) parts.push(`<priority>${priority}</priority>`);
    return `  <url>${parts.join('')}</url>`;
}

function baseUrl() {
    return (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

async function build(db) {
    const base = baseUrl();
    const entries = STATIC_PATHS.map(([p, cf, pr]) => urlEntry(base, p, null, cf, pr));

    const results = await Promise.allSettled(SOURCES.map((s) => db.query(s.sql)));

    results.forEach((r, i) => {
        const src = SOURCES[i];
        if (r.status !== 'fulfilled') {
            // 한 소스가 죽어도 나머지는 낸다. 조용히 빠지면 색인이 줄어든 이유를 알 수 없으므로 로그를 남긴다.
            logger.error(`sitemap: ${src.key} 조회 실패 — ${r.reason?.message || r.reason}`);
            return;
        }
        for (const row of r.value.rows) {
            if (row.slug == null) continue;
            entries.push(urlEntry(base, src.prefix + row.slug, row.lastmod, src.changefreq, src.priority));
        }
    });

    if (entries.length > URL_LIMIT) {
        // 여기 닿으면 사이트맵 인덱스로 쪼개야 한다. 조용히 자르면 색인 누락을 눈치챌 수 없다.
        logger.error(`sitemap: URL ${entries.length}개로 규격 상한 ${URL_LIMIT} 초과 — 사이트맵 인덱스 분할 필요`);
        entries.length = URL_LIMIT;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n`
         + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
         + entries.join('\n')
         + `\n</urlset>\n`;
}

let cache = null;        // { xml, builtAt }
let inflight = null;     // 동시 요청이 같은 빌드를 공유

export function sitemapHandler(db) {
    return async (req, res) => {
        try {
            if (!cache || Date.now() - cache.builtAt > TTL_MS) {
                if (!inflight) {
                    inflight = build(db)
                        .then((xml) => { cache = { xml, builtAt: Date.now() }; return xml; })
                        .finally(() => { inflight = null; });
                }
                await inflight;
            }
            res.type('application/xml; charset=utf-8')
               .set('Cache-Control', 'public, max-age=21600')   // 엣지·브라우저 6시간
               .send(cache.xml);
        } catch (err) {
            logger.error(`sitemap 생성 실패: ${err.message}`);
            // 낡은 캐시라도 있으면 그걸 낸다 — 빈 사이트맵보다 낫다.
            if (cache) {
                return res.type('application/xml; charset=utf-8').send(cache.xml);
            }
            res.status(503).type('text/plain; charset=utf-8').send('sitemap temporarily unavailable');
        }
    };
}
