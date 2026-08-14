// genInstaCards.js — 브리핑 → 인스타 캐러셀 PNG + 캡션
//
// `/briefing/:id/card?slide=N` 을 헤드리스 브라우저로 찍어 PNG 로 떨군다.
// 손으로 DevTools 노드 캡처를 N번 하던 걸 없애는 것이 목적 — 그 방식은 며칠이면 안 하게 된다.
//
// 왜 Playwright·Puppeteer 를 안 쓰나:
//   저 둘은 크로미움을 따로 받아(~150MB) 설치한다. 이 스크립트는 **로컬에서만** 도는
//   운영 도구고(Railway 에 올릴 일이 없다), 윈도우에는 Edge 가 항상 깔려 있어
//   이미 있는 브라우저에 인자만 넘기면 끝난다. 의존성 0개.
//
// 전제:
//   1. 서버가 떠 있어야 한다 (`npm start`) — 페이지를 실제로 렌더해서 찍는 방식이라
//   2. Chrome 또는 Edge. 못 찾으면 CHROME_PATH 로 지정
//
// 사용:
//   node batch/genInstaCards.js                 # 최신 카드
//   node batch/genInstaCards.js --id 5
//   node batch/genInstaCards.js --date 2026-08-10
//   node batch/genInstaCards.js --out D:/insta --base http://localhost:3000
//
// 산출물: <out>/<YYYY-MM-DD>/01.png … NN.png + caption.txt

import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';

const W = 1080;
const H = 1350;

const arg = (name, dflt = null) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
        ? process.argv[i + 1] : dflt;
};

const BASE = (arg('base') || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const OUT_ROOT = arg('out') || path.resolve('out/insta');

/* ── 브라우저 찾기 ──
   Edge 는 윈도우 11 에 기본 탑재라 사실상 항상 걸린다 (크로미움 기반이라 인자가 같다). */
function findBrowser() {
    const LA = process.env.LOCALAPPDATA || '';
    const candidates = [
        process.env.CHROME_PATH,
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        LA && path.join(LA, 'Google/Chrome/Application/chrome.exe'),
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    ].filter(Boolean);
    return candidates.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || null;
}

/* PNG 헤더에서 실제 픽셀 크기를 읽는다.
   ⚠️ 크기 검증을 반드시 할 것 — 배율(devicePixelRatio) 이 끼면 2160×2700 이 나오는데
      인스타가 알아서 줄여주기 때문에 **눈으로는 멀쩡해 보인다.** 조용히 어긋나는 종류의 실패다. */
function pngSize(file) {
    const b = fs.readFileSync(file);
    if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function shoot(browser, url, outFile) {
    execFileSync(browser, [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        // 1 로 고정하지 않으면 고DPI 장비에서 2배 크기로 찍힌다
        '--force-device-scale-factor=1',
        `--window-size=${W},${H}`,
        // 웹폰트가 로드되기 전에 찍히는 걸 막는다 (가상 시계를 돌려 로드를 끝낸 뒤 캡처)
        '--virtual-time-budget=6000',
        // 사용자가 크롬을 켜둔 상태여도 프로필 충돌이 없게 별도 프로필
        `--user-data-dir=${path.join(os.tmpdir(), 'dangmalsa-shot')}`,
        `--screenshot=${outFile}`,
        url,
    ], { stdio: 'pipe', timeout: 60000 });
}

/* 인스타 캡션 — 그대로 복사해 캡션 칸에 붙여넣는 텍스트.
 *
 * 🔴 캡션은 **이미지를 반복하는 자리가 아니다.** 카드에 이미 있는 것(날짜·헤드라인·숫자·흐름)을
 *    다시 적으면 자막이 될 뿐이다. 캡션만 할 수 있는 일 세 가지에 집중한다:
 *      ① 검색 유입(해시태그)  ② 프로필 링크 유도  ③ 고지
 *
 * ⚠️ **인스타 캡션의 URL 은 클릭되지 않는다.** `→ dangmalsa.kr` 처럼 링크 모양으로 써두면
 *    눌러도 아무 일이 안 일어나 안 쓴 것만 못하다. 반드시 "프로필 링크" 로 유도할 것.
 * ⚠️ 첫 2줄만 보이고 나머지는 `... 더 보기` 로 접힌다 → 첫 줄은 **헤드라인**이어야 한다.
 *    날짜를 앞에 두면 가장 비싼 자리를 카드 표지(54px 날짜)와 중복시키는 셈이다.
 */
function buildCaption(p) {
    const [, mm, dd] = p.briefing_date.split('-');
    const isAi = p.model && p.model !== 'fallback' && p.model !== 'none';
    const isEmpty = p.model === 'none';
    const st = p.stats || {};

    // ① 첫 2줄 — 더 보기 이전에 노출되는 전부
    const L = [p.headline, `${Number(mm)}월 ${Number(dd)}일 국회 기록입니다.`];

    // ② 숫자 (SQL 집계값)
    const nums = [];
    if (!isEmpty && st.proposed !== undefined) {
        nums.push(`발의 ${st.proposed}건`);
        if (st.proposers) nums.push(`대표발의 ${st.proposers}명`);
        if (st.cosign) nums.push(`공동발의 서명 ${st.cosign}건`);
    }
    if (nums.length) L.push('', nums.join(' · '));

    // ③ 흐름 — AI 가 값을 더한 유일한 지점이라 캡션에도 남긴다
    const threads = Array.isArray(p.threads) ? p.threads : [];
    if (threads.length) {
        L.push('', '이날의 흐름');
        threads.forEach((t) => L.push(`· ${t.theme} (${t.bill_count}건) — ${t.what}`));
    }

    // ④ 프로필 링크 유도 + 소개와 같은 문장 (계정 전체가 같은 말을 반복해야 정체성이 된다)
    L.push('', '법안 원문과 의원별 표결 기록은 프로필 링크에서 볼 수 있습니다.', '직접 보고 판단하세요.');

    // ⑤ 고지 — 카드가 사이트 밖으로 나가므로 이미지와 캡션 양쪽에 있어야 한다
    L.push('');
    if (isAi) {
        L.push('숫자는 국회 공식 데이터 집계입니다. 문장과 주제 묶음은 AI가 법안 원문을 읽고 정리한 것으로 사실과 다를 수 있습니다.');
    } else if (isEmpty) {
        L.push('국회 공식 데이터에 이날 기록된 활동이 없어 자동으로 남긴 기록입니다.');
    } else {
        L.push('AI 없이 국회 공식 데이터 집계만으로 만들었습니다.');
    }
    L.push('출처: 열린국회정보');

    /* ⑥ 해시태그
       ⚠️ `#518민주유공자보훈` 같은 긴 키워드는 **아무도 검색하지 않는다.** 태그는 실제로
          검색되는 말이어야 의미가 있다 → 고정 태그 + 짧은 키워드만 소수.
       ⚠️ `#정치`·`#시사` 는 넣지 않는다. 쓰레드에서 `정치뉴스` 태그가 진영 글을 끌어온 것과
          같은 위험이 있다. 사안 중심 태그(#국회·#법안·#입법·#정책)는 안전하다.
       ⚠️ 정당·인물 태그는 절대 금지 — 그 순간 계정이 편을 든 것이 된다. */
    const BASE = ['국회', '법안', '입법', '정책', '국회의원', '법안발의', '당말사'];
    const extra = (Array.isArray(p.keywords) ? p.keywords : [])
        .map((k) => String(k).replace(/[\s#·]/g, ''))
        // 길이는 거친 대용치다 — `조세특례제한법`(7) 같은 실제 법률명은 살리고
        // `필수항공운송노선`(8) 처럼 AI 가 지어낸 구절은 거른다. 완벽하진 않으니
        // 올리기 전에 caption.txt 를 한 번 훑고 손대도 된다
        .filter((k) => k.length >= 2 && k.length <= 7)
        .slice(0, 3);
    L.push('', [...new Set([...BASE, ...extra])].map((k) => `#${k}`).join(' '));

    return L.join('\n');
}

async function main() {
    const browser = findBrowser();
    if (!browser) {
        logger.error('[insta] Chrome·Edge 를 못 찾았습니다. CHROME_PATH 환경변수로 지정하세요.');
        process.exit(1);
    }

    const pool = new pg.Pool(dbConfig);
    try {
        const id = arg('id');
        const date = arg('date');
        const { rows } = await pool.query(`
            SELECT id, TO_CHAR(briefing_date,'YYYY-MM-DD') AS briefing_date,
                   headline, body, keywords, threads, stats, model
              FROM briefing_posts
             WHERE ($1::bigint IS NULL OR id = $1::bigint)
               AND ($2::date   IS NULL OR briefing_date = $2::date)
             ORDER BY briefing_date DESC
             LIMIT 1`, [id || null, date || null]);

        const post = rows[0];
        if (!post) {
            logger.error(`[insta] 카드를 찾지 못했습니다 (id=${id ?? '-'} date=${date ?? '-'})`);
            process.exit(1);
        }

        // 슬라이드 수는 **페이지가 정한다.** 여기서 다시 계산하면 컨트롤러와 어긋난다
        const cardUrl = `${BASE}/briefing/${post.id}/card`;
        let html;
        try {
            const res = await fetch(cardUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            html = await res.text();
        } catch (e) {
            logger.error(`[insta] ${cardUrl} 을 열지 못했습니다 (${e.message}). 서버가 떠 있나요? → npm start`);
            process.exit(1);
        }
        const count = (html.match(/data-slide="\d+"/g) || []).length;
        if (!count) {
            logger.error('[insta] 슬라이드를 찾지 못했습니다. 카드 페이지 마크업이 바뀌었는지 확인하세요.');
            process.exit(1);
        }

        const dir = path.join(OUT_ROOT, post.briefing_date);
        fs.mkdirSync(dir, { recursive: true });

        logger.info(`[insta] ${post.briefing_date} — ${count}장 · ${path.basename(browser)}`);
        logger.info(`         "${post.headline}"`);

        let bad = 0;
        for (let n = 1; n <= count; n++) {
            const file = path.join(dir, `${String(n).padStart(2, '0')}.png`);
            shoot(browser, `${cardUrl}?slide=${n}`, file);
            const size = pngSize(file);
            if (!size || size.w !== W || size.h !== H) {
                bad++;
                logger.warn(`  ${n}/${count} ⚠ ${size ? `${size.w}x${size.h}` : '읽기 실패'} — 기대값 ${W}x${H}`);
            } else {
                logger.info(`  ${n}/${count} ✓ ${size.w}x${size.h} (${Math.round(fs.statSync(file).size / 1024)}KB)`);
            }
        }

        const capFile = path.join(dir, 'caption.txt');
        fs.writeFileSync(capFile, buildCaption(post), 'utf8');

        logger.info(`[insta] 완료 → ${dir}`);
        logger.info('         캡션: caption.txt (그대로 복사해 붙이면 됩니다)');
        if (bad) {
            logger.warn(`[insta] ⚠ ${bad}장이 ${W}x${H} 가 아닙니다 — 올리기 전에 확인하세요`);
            process.exitCode = 1;
        }
    } finally {
        await pool.end();
    }
}

main().catch((e) => {
    logger.error(`[insta] 실패: ${e.message}`);
    process.exit(1);
});
