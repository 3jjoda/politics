// genBriefingVideo.js — 브리핑 → 유튜브 쇼츠 (1080×1920, 세로) MP4 + 제목/설명
//
// 인스타 카드 PNG(genInstaCards) 를 슬라이드쇼로 잇고, 슬라이드별 나레이션(TTS) + 자막을 얹는다.
// 국회가 열리는 한 매일 나오는 영상 — "매일 뜨는 채널" 이 목적이지 조회수 폭발형이 아니다.
//
// 🔴 로컬 전용 운영 도구다 (Railway 에 올리지 않는다). 전제:
//   1. 서버가 떠 있어야 한다 (`npm start`) — 나레이션은 /api/briefing/export 가 준다
//   2. ffmpeg (brew install ffmpeg) — 이어붙이기·오디오만 쓴다. 자막은 ffmpeg 가 아니라 **헤드리스 크롬으로 프레임에 직접 그린다**
//      (brew ffmpeg 9 빌드에는 libass·drawtext 가 없다. 그리고 이 편이 폰트·디자인을 우리가 통제한다 — 카드와 같은 서체)
//   3. TTS: macOS `say`(한국어 Yuna, 추가 설치 없음). 다른 OS 면 `--tts edge` 로 edge-tts(pip) 사용
//   4. 인스타 PNG 가 없으면 genInstaCards 를 먼저 돌린다 (같은 날짜)
//
// 사용:
//   node batch/genBriefingVideo.js                     # 최신 카드
//   node batch/genBriefingVideo.js --date 2026-08-14
//   node batch/genBriefingVideo.js --voice Yuna --rate 190      # 기본 205 — 60초 상한 때문에 빠르다. 넘치면 로그 경고
//
// ⚠️ 60초 상한 — 실측 08-14(7장) 59.0초. 나레이션은 BriefingController.buildNarration 이 만든다 (여기서 자르지 않는다).
//    넘치면 거기서 문장을 줄이거나 --rate 를 올릴 것. 자막 컷은 문장 → 26자 줄바꿈 → 8자 미만 조각은 이웃에 붙임, 길이는 글자 수 비례
// 산출물: out/video/<YYYY-MM-DD>/short.mp4 · title.txt · description.txt · narration.txt · slides/*.png(패딩본)
//   업로드는 일단 수동 (유튜브 스튜디오에 드래그 · title/description 붙여넣기). API 업로드는 다음 단계.

import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import logger from '../utils/logger.js';
import { findBrowser, shoot } from '../utils/headlessShot.js';

const arg = (name, dflt = null) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt;
};
const BASE = (arg('base') || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const KEY = process.env.BRIEFING_EXPORT_KEY || '';
const OUT_ROOT = arg('out') || path.resolve('out/video');
const INSTA_ROOT = arg('insta') || path.resolve('out/insta');
const VOICE = arg('voice') || 'Yuna';
const RATE = Number(arg('rate') || 205);          // say 의 분당 단어수. 쇼츠는 60초 상한이라 빠르게(200) — 뉴스 톤은 175
const TTS = arg('tts') || (process.platform === 'darwin' ? 'say' : 'edge');
const W = 1080, H = 1920;                          // 쇼츠 9:16
const MIN_SLIDE = 3.0, TAIL = 0.45;                 // 슬라이드 최소 길이 · 나레이션 뒤 여백(초)
const BG = '#F7F6F1';                              // 카드 4:5 를 9:16 에 얹을 때 위아래 색 (브랜드 베이지)

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...opts });
const has = (cmd) => { try { sh('which', [cmd]); return true; } catch { return false; } };

function probeDuration(file) {
    const out = sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim();
    return Number(out) || 0;
}

/* TTS — 문장 → wav. macOS `say` 는 aiff 로 뱉으므로 ffmpeg 로 wav 변환. 빈 문장이면 무음 1초 */
function tts(text, outWav) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) { sh('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1', outWav]); return; }
    if (TTS === 'say') {
        const aiff = outWav.replace(/\.wav$/, '.aiff');
        sh('say', ['-v', VOICE, '-r', String(RATE), '-o', aiff, t]);
        sh('ffmpeg', ['-y', '-i', aiff, '-ar', '44100', '-ac', '1', outWav]);
        fs.unlinkSync(aiff);
    } else {
        // edge-tts (pip install edge-tts) — 무료, 키 없음. 한국어 여성 SunHi
        const mp3 = outWav.replace(/\.wav$/, '.mp3');
        sh('edge-tts', ['--voice', 'ko-KR-SunHiNeural', '--rate', '+5%', '--text', t, '--write-media', mp3]);
        sh('ffmpeg', ['-y', '-i', mp3, '-ar', '44100', '-ac', '1', outWav]);
        fs.unlinkSync(mp3);
    }
}

/* 프레임 렌더 — 카드 PNG + 자막 한 줄을 HTML 로 그려 헤드리스 크롬으로 1080×1920 캡처 (utils/headlessShot.js) */
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function frameHtml(cardPngAbs, line, n, count) {
    // 카드(1080×1350)를 y=150 에, 아래 420px 띠에 자막. 서체는 카드와 같은 계열(시스템 한글 산세리프)
    return `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${BG};font-family:"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif}
.card{position:absolute;left:0;top:150px;width:1080px;height:1350px}
.sub{position:absolute;left:60px;right:60px;top:1540px;bottom:120px;display:flex;align-items:center;justify-content:center;text-align:center}
.sub span{display:inline-block;background:rgba(26,29,36,.92);color:#F7F6F1;font-size:44px;font-weight:800;line-height:1.35;padding:18px 30px;border-radius:16px;word-break:keep-all}
.pg{position:absolute;right:60px;top:80px;font:600 26px/1 "JetBrains Mono",monospace;color:#8F5800;letter-spacing:.06em}
</style><img class="card" src="file://${cardPngAbs}"><div class="pg">${n} / ${count}</div>${line ? `<div class="sub"><span>${esc(line)}</span></div>` : ''}`;
}
const shootFrame = (browser, htmlFile, outPng) => shoot(browser, `file://${htmlFile}`, outPng, { width: W, height: H, budgetMs: 1500, extraArgs: ['--allow-file-access-from-files'] });

/* SRT 시각 포맷 (유튜브 자막 파일용 — 화면엔 굽지 않고 별도 업로드 가능) */
const ts = (sec) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60), ms = Math.round((sec % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};
/* 나레이션을 자막 줄로 — 한 줄 24자 안팎으로 접는다 (세로 화면). 문장 단위 → 길면 공백에서 */
function toSubLines(text) {
    const sents = String(text).split(/(?<=[.!?。])\s+/).filter(Boolean);
    const lines = [];
    for (const s of sents) {
        if ([...s].length <= 26) { lines.push(s); continue; }
        let cur = '';
        for (const w of s.split(' ')) {
            if ([...(cur + ' ' + w)].length > 26 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
        }
        if (cur) lines.push(cur);
    }
    // `2.` · `당 말고 사람.` 같은 짧은 조각은 혼자 한 컷이 되면 어색하다 → 다음 조각 앞에 붙인다 (마지막이면 앞 조각 뒤에)
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if ([...l].length < 8 && i + 1 < lines.length && [...(l + ' ' + lines[i + 1])].length <= 30) { lines[i + 1] = l + ' ' + lines[i + 1]; continue; }
        if ([...l].length < 8 && out.length && [...(out[out.length - 1] + ' ' + l)].length <= 30) { out[out.length - 1] += ' ' + l; continue; }
        out.push(l);
    }
    return out;
}

async function main() {
    for (const c of ['ffmpeg', 'ffprobe']) if (!has(c)) { logger.error(`[video] ${c} 가 없습니다 → brew install ffmpeg`); process.exit(1); }
    if (TTS === 'say' && !has('say')) { logger.error('[video] macOS 가 아닙니다 → --tts edge (pip install edge-tts)'); process.exit(1); }
    if (TTS === 'edge' && !has('edge-tts')) { logger.error('[video] edge-tts 가 없습니다 → pip install edge-tts'); process.exit(1); }

    // 1) 재료 — export API
    const date = arg('date');
    const url = `${BASE}/api/briefing/export${date ? `?date=${date}` : ''}`;
    let ex;
    try {
        const res = await fetch(url, { headers: KEY ? { 'X-Export-Key': KEY } : {} });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        ex = await res.json();
    } catch (e) {
        logger.error(`[video] ${url} 실패 (${e.message}). 서버가 떠 있나요? → npm start`);
        process.exit(1);
    }
    if (!ex.ready) { logger.error('[video] 카드가 없습니다'); process.exit(1); }
    if (!ex.publishable) logger.warn(`[video] ⚠ 이 카드는 ${ex.kind} — 올릴 카드가 아닙니다 (그래도 만든다)`);
    const narr = (ex.video && ex.video.narration) || [];
    const count = ex.instagram.slideCount;
    if (!narr.length || narr.length !== count) { logger.error(`[video] 나레이션 ${narr.length} ≠ 슬라이드 ${count} — 서버 코드가 최신인지 확인`); process.exit(1); }

    // 2) 인스타 PNG — 없으면 genInstaCards 먼저
    const instaDir = path.join(INSTA_ROOT, ex.date);
    const png = (n) => path.join(instaDir, `${String(n).padStart(2, '0')}.png`);
    if (!fs.existsSync(png(count))) {
        logger.info(`[video] 인스타 PNG 없음 → genInstaCards --date ${ex.date}`);
        sh('node', ['batch/genInstaCards.js', '--date', ex.date, '--base', BASE, '--out', INSTA_ROOT], { stdio: 'inherit' });
    }
    for (let n = 1; n <= count; n++) if (!fs.existsSync(png(n))) { logger.error(`[video] ${png(n)} 없음`); process.exit(1); }

    const dir = path.join(OUT_ROOT, ex.date);
    const work = path.join(dir, 'slides');
    fs.mkdirSync(work, { recursive: true });
    logger.info(`[video] ${ex.date} — ${count}장 · TTS ${TTS}${TTS === 'say' ? `/${VOICE}` : ''}`);
    logger.info(`        "${ex.headline}"`);

    const browser = findBrowser();
    if (!browser) { logger.error('[video] Chrome·Edge 를 못 찾았습니다. CHROME_PATH 로 지정하세요.'); process.exit(1); }

    // 3) 슬라이드별: TTS → 길이 → 자막 줄 → 줄마다 프레임(카드+자막) 렌더
    //    자막은 나레이션을 문장 단위로 쪼개 슬라이드 구간을 균등 분할한다 (say 는 단어별 타이밍을 안 주므로 근사)
    const frames = [];      // { png, dur }
    const wavs = [];        // 슬라이드별 (wav, dur)
    let t0 = 0; const srt = []; let si = 1; let fi = 0;
    for (let n = 1; n <= count; n++) {
        const wav = path.join(work, `s${n}.wav`);
        tts(narr[n - 1], wav);
        const dur = Math.max(MIN_SLIDE, probeDuration(wav) + TAIL);
        wavs.push({ wav, dur });
        const lines = toSubLines(narr[n - 1]);
        const segs = lines.length ? lines : [''];
        // 컷 길이는 글자 수 비례 (균등 분할이면 짧은 줄이 오래 머물고 긴 줄이 먼저 넘어간다)
        const wts = segs.map((l) => Math.max(4, [...l].length)), wsum = wts.reduce((a, b) => a + b, 0);
        let tt = t0;
        for (let i = 0; i < segs.length; i++) {
            const line = segs[i], each = dur * wts[i] / wsum;
            const html = path.join(work, `f${++fi}.html`), fpng = path.join(work, `f${fi}.png`);
            fs.writeFileSync(html, frameHtml(png(n), line, n, count), 'utf8');
            await shootFrame(browser, html, fpng);
            frames.push({ png: fpng, dur: each });
            if (line) srt.push(`${si++}\n${ts(tt)} --> ${ts(tt + each - 0.05)}\n${line}\n`);
            tt += each;
        }
        t0 += dur;
        logger.info(`  ${n}/${count} ${dur.toFixed(1)}s · ${segs.length}컷  ${narr[n - 1].slice(0, 40)}${narr[n - 1].length > 40 ? '…' : ''}`);
    }
    fs.writeFileSync(path.join(dir, 'sub.srt'), srt.join('\n'), 'utf8');

    // 4) 영상: 프레임 concat(길이 지정) / 오디오: 슬라이드 wav 를 각 길이로 패딩 후 concat → 먹스
    const vlist = path.join(work, 'v.txt');
    fs.writeFileSync(vlist, frames.map((f) => `file '${f.png}'\nduration ${f.dur.toFixed(3)}`).join('\n') + `\nfile '${frames[frames.length - 1].png}'\n`, 'utf8');
    const vmp4 = path.join(work, 'v.mp4');
    sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', vlist, '-fps_mode', 'vfr', '-pix_fmt', 'yuv420p',
        '-c:v', 'libx264', '-crf', '20', '-tune', 'stillimage', vmp4]);
    const apads = [];
    wavs.forEach((w, i) => {
        const p2 = path.join(work, `a${i + 1}.wav`);
        sh('ffmpeg', ['-y', '-i', w.wav, '-af', `apad,atrim=0:${w.dur.toFixed(3)}`, p2]);
        apads.push(p2);
    });
    const alist = path.join(work, 'a.txt');
    fs.writeFileSync(alist, apads.map((a2) => `file '${a2}'`).join('\n'), 'utf8');
    const awav = path.join(work, 'a.wav');
    sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', alist, '-c', 'copy', awav]);
    const out = path.join(dir, 'short.mp4');
    sh('ffmpeg', ['-y', '-i', vmp4, '-i', awav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out]);
    const parts = wavs;

    // 5) 제목·설명·원고
    const total = parts.reduce((s, p) => s + p.dur, 0);
    const title = (ex.video && ex.video.title) || `${ex.date} 국회 브리핑`;
    const desc = [
        ex.headline, '',
        `📌 이날 브리핑 전문: ${ex.url}`,
        `🧭 나와 가장 가까운 국회의원은? 성향 진단: https://dangmalsa.kr/balance-game`,
        `📊 의원별 발의·표결·발언 기록: https://dangmalsa.kr/politician`, '',
        '당말사 — 당 말고 사람. 국회가 공개한 자료를 그대로 모아 매일 정리합니다.',
        '※ 이 영상의 요약 문장은 AI가 만든 것으로 사실과 다를 수 있습니다. 숫자는 국회 공개 데이터의 집계값입니다.', '',
        '#국회 #법안 #당말사',
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'title.txt'), title, 'utf8');
    fs.writeFileSync(path.join(dir, 'description.txt'), desc, 'utf8');
    fs.writeFileSync(path.join(dir, 'narration.txt'), narr.map((n, i) => `[${i + 1}] ${n}`).join('\n'), 'utf8');

    logger.info(`[video] 완료 → ${out}  (${total.toFixed(1)}초 · ${Math.round(fs.statSync(out).size / 1024)}KB)`);
    logger.info(`        title.txt · description.txt 를 유튜브 스튜디오에 붙여넣으면 됩니다`);
    if (total > 60) logger.warn(`[video] ⚠ ${total.toFixed(0)}초 — 쇼츠는 60초 이하여야 합니다. --rate 를 올리거나 나레이션을 줄이세요`);
}

main().catch((e) => { logger.error(`[video] 실패: ${e.message}`); process.exit(1); });
