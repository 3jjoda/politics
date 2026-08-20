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
// 산출물: <out>/<YYYY-MM-DD>/01.png … NN.png + caption.txt (캡션 조립은 utils/instaCaption.js — 카드 페이지와 같은 코드)

import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { buildCaption } from '../utils/instaCaption.js';   // 캡션은 카드 페이지와 단일 소스
import { siteUrl } from '../utils/threadsPost.js';          // 대표 도메인 판정 단일 소스 (로컬 BASE_URL 을 걸러낸다)
import { findBrowser, shoot as shootAsync } from '../utils/headlessShot.js';   // 헤드리스 캡처 공용 (맥 크롬 미종료 대응)

const W = 1080;
const H = 1350;          // 피드 캐러셀 (4:5)
const STORY_H = 1920;    // 스토리 (9:16)

const arg = (name, dflt = null) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
        ? process.argv[i + 1] : dflt;
};

const BASE = (arg('base') || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const OUT_ROOT = arg('out') || path.resolve('out/insta');

/* PNG 헤더에서 실제 픽셀 크기를 읽는다.
   ⚠️ 크기 검증을 반드시 할 것 — 배율(devicePixelRatio) 이 끼면 2160×2700 이 나오는데
      인스타가 알아서 줄여주기 때문에 **눈으로는 멀쩡해 보인다.** 조용히 어긋나는 종류의 실패다. */
function pngSize(file) {
    const b = fs.readFileSync(file);
    if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const shoot = (browser, url, outFile, height = H) => shootAsync(browser, url, outFile, { width: W, height });

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
        const check = (file, label, expectH) => {
            const size = pngSize(file);
            if (!size || size.w !== W || size.h !== expectH) {
                bad++;
                logger.warn(`  ${label} ⚠ ${size ? `${size.w}x${size.h}` : '읽기 실패'} — 기대값 ${W}x${expectH}`);
            } else {
                logger.info(`  ${label} ✓ ${size.w}x${size.h} (${Math.round(fs.statSync(file).size / 1024)}KB)`);
            }
        };

        for (let n = 1; n <= count; n++) {
            const file = path.join(dir, `${String(n).padStart(2, '0')}.png`);
            await shoot(browser, `${cardUrl}?slide=${n}`, file);
            check(file, `${n}/${count}`, H);
        }

        // 스토리 1장 — 인스타에서 **탭 한 번에 사이트로 가는 유일한 통로**가 스토리 링크 스티커다.
        // 피드 게시물은 프로필 → 링크로 2단계라 이탈이 크다.
        const storyFile = path.join(dir, 'story.png');
        await shoot(browser, `${cardUrl}?story=1`, storyFile, STORY_H);
        check(storyFile, 'story', STORY_H);

        const capFile = path.join(dir, 'caption.txt');
        fs.writeFileSync(capFile, buildCaption(post), 'utf8');

        // 🔴 스토리 링크 스티커에 넣을 주소 — 홈이 아니라 **그날 브리핑**이다.
        //    스토리 카드가 그날 것이라 홈에 떨어뜨리면 방금 본 것을 다시 찾아야 한다 (거기서 이탈한다).
        //    카드 미리보기 페이지의 「스토리 링크」 블록과 같은 값 (BriefingController 의 storyLink).
        const linkFile = path.join(dir, 'link.txt');
        fs.writeFileSync(linkFile, `${siteUrl()}/briefing/${Number(post.id)}\n`, 'utf8');

        logger.info(`[insta] 완료 → ${dir}`);
        logger.info('         캡션: caption.txt (그대로 복사해 붙이면 됩니다)');
        logger.info('         링크: link.txt (스토리 링크 스티커에 넣을 주소)');
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
