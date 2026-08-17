// genBriefingVideo.js — 브리핑 → 유튜브 쇼츠 (1080×1920, 세로) MP4 + 제목/설명
//
// 두 포맷:
//   thread (기본) — 하루 한 영상 = 주제 묶음 **하나**. 첫 장이 곧 내용(what)으로 시작하고 관련 법안 → 그날 맥락 → CTA. 25~40초.
//                  프레임을 HTML 로 직접 그린다 (카드 PNG 안 씀). 재료는 /api/briefing/export 의 video.short (BriefingController.buildShort)
//                  묶음이 없는 날(폴백·활동 없음)은 영상을 만들지 않는다 — "볼 만한 날만" 이 매일 올리는 것보다 낫다
//   full           — 인스타 카드 7장을 통째로 읽는 구 포맷 (--format full). 날짜·집계로 시작하고 주제가 5번 바뀌어 쇼츠에서 안 본다는 결론
//                  (2026-08-17 사용자 피드백). 아카이브용으로 남겨둔다
//
// 🔴 로컬 전용 운영 도구다 (Railway 에 올리지 않는다). 전제:
//   1. 서버가 떠 있어야 한다 (`npm start`) — 나레이션은 /api/briefing/export 가 준다
//   2. ffmpeg (brew install ffmpeg) — 이어붙이기·오디오만 쓴다. 자막은 ffmpeg 가 아니라 **헤드리스 크롬으로 프레임에 직접 그린다**
//      (brew ffmpeg 9 빌드에는 libass·drawtext 가 없다. 그리고 이 편이 폰트·디자인을 우리가 통제한다 — 카드와 같은 서체)
//   3. TTS: **edge-tts** 기본 (pip install edge-tts · MS 뉴럴 ko-KR-SunHiNeural, 무료·키 없음). `say`(맥 Yuna)는 --tts say —
//      2010년대 음성이라 "너무 AI 같다" 는 피드백. edge-tts 는 `edge-tts` CLI 가 PATH 에 없어도 `python3 -m edge_tts` 로 돈다
//   4. 인스타 PNG 가 없으면 genInstaCards 를 먼저 돌린다 (같은 날짜)
//
// 사용:
//   node batch/genBriefingVideo.js                     # 최신 카드
//   node batch/genBriefingVideo.js --date 2026-08-14
//   node batch/genBriefingVideo.js --format full                # 구 포맷 (카드 7장)
//   node batch/genBriefingVideo.js --voice ko-KR-InJoonNeural   # 남성 음성 · --rate +0% (edge) / --tts say --voice Yuna --rate 205
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
const TTS = arg('tts') || 'edge';
const FORMAT = arg('format') || 'thread';
const VOICE = arg('voice') || (TTS === 'say' ? 'Yuna' : 'ko-KR-SunHiNeural');
const RATE = arg('rate') || (TTS === 'say' ? '205' : '+8%');   // say: 분당 단어수 / edge: 상대 속도
const W = 1080, H = 1920;                          // 쇼츠 9:16
const MIN_SLIDE = 3.0, TAIL = 0.45;                 // 슬라이드 최소 길이 · 나레이션 뒤 여백(초)
const BG = '#F7F6F1';                              // 카드 4:5 를 9:16 에 얹을 때 위아래 색 (브랜드 베이지)

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...opts });
const has = (cmd) => { try { sh('which', [cmd]); return true; } catch { return false; } };

function probeDuration(file) {
    const out = sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim();
    return Number(out) || 0;
}

/* TTS — 문장 → wav. edge-tts 는 mp3, `say` 는 aiff 로 뱉으므로 ffmpeg 로 wav 변환. 빈 문장이면 무음 1초 */
let EDGE_CMD = null;   // ['edge-tts'] 또는 ['python3','-m','edge_tts']
function edgeCmd() {
    if (EDGE_CMD) return EDGE_CMD;
    if (has('edge-tts')) return (EDGE_CMD = ['edge-tts']);
    for (const py of ['python3', 'python']) {
        try { sh(py, ['-c', 'import edge_tts']); return (EDGE_CMD = [py, '-m', 'edge_tts']); } catch {}
    }
    return null;
}
function tts(text, outWav) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) { sh('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1', outWav]); return; }
    if (TTS === 'say') {
        const aiff = outWav.replace(/\.wav$/, '.aiff');
        sh('say', ['-v', VOICE, '-r', String(RATE), '-o', aiff, t]);
        sh('ffmpeg', ['-y', '-i', aiff, '-ar', '44100', '-ac', '1', outWav]);
        fs.unlinkSync(aiff);
    } else {
        const mp3 = outWav.replace(/\.wav$/, '.mp3');
        const [cmd, ...pre] = edgeCmd();
        sh(cmd, [...pre, '--voice', VOICE, `--rate=${RATE}`, '--text', t, '--write-media', mp3]);
        // 앞뒤 무음을 잘라 컷 타이밍이 말과 맞게 (edge-tts 는 앞에 0.1~0.3초 여백을 붙인다)
        sh('ffmpeg', ['-y', '-i', mp3, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse', '-ar', '44100', '-ac', '1', outWav]);
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

/* ── 「흐름 하나」 포맷 프레임 — 장면(scene) × 컷(cut) 을 HTML 로 그린다 ──
   컷마다 내용을 조금씩 더 드러낸다 (훅: 주제 → 설명 / 법안: 한 줄씩) — 정지 화면의 연속이라도 움직임이 있어야 손가락이 멈춘다.
   서체는 카드와 같다 (Noto Serif KR 900 헤드라인 · Pretendard 본문 · JetBrains Mono 메타) — 구글 폰트를 프레임마다 받는다
   (--user-data-dir 캐시라 두 번째부터는 빠르다). 정당 없음 · 골드 단색 */
const FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700;900&family=Noto+Sans+KR:wght@400;500;700;800&family=JetBrains+Mono:wght@500;700&display=block" rel="stylesheet">';
const MARK = '<svg viewBox="0 0 64 64" width="{S}" height="{S}"><circle cx="32" cy="32" r="28" fill="none" stroke="#B8740C" stroke-width="5"/><path d="M32 16v32M32 30l12 10" fill="none" stroke="#B8740C" stroke-width="5" stroke-linecap="round"/></svg>';
const mark = (size) => MARK.replace(/\{S\}/g, size);
function sceneHtml(sc, S, cut, cuts, line) {
    const shortName = (n) => String(n).replace(/\s*(일부|전부)?개정법률안$/, ' 일부개정안').replace(/\s*법률안$/, ' 법률안');
    const css = `${FONT_LINK}<style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${BG};color:#1A1D24;font-family:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;word-break:keep-all}
.top{position:absolute;left:72px;right:72px;top:190px;display:flex;justify-content:space-between;align-items:center}
.brand{display:flex;align-items:center;gap:14px;font-weight:800;font-size:34px;color:#1A1D24}
.date{font:700 28px/1 "JetBrains Mono",monospace;color:#8F5800;letter-spacing:.08em}
.body{position:absolute;left:72px;right:72px;top:330px;bottom:520px;display:flex;flex-direction:column;justify-content:center}
.kick{font:700 30px/1 "JetBrains Mono",monospace;color:#8F5800;letter-spacing:.14em;margin-bottom:34px}
.hl{font-family:"Noto Serif KR",serif;font-weight:900;font-size:104px;line-height:1.14;letter-spacing:-.01em;border-left:14px solid #B8740C;padding-left:34px;margin:0}
.hl.s{font-size:88px}
.meta{margin-top:60px;padding-left:48px;font-size:36px;color:#5F6674;font-weight:500;opacity:0}.meta.on{opacity:1}
.h2{font-family:"Noto Serif KR",serif;font-weight:900;font-size:64px;line-height:1.2;margin:0 0 14px}
.h2 b{color:#B8740C}
.lede{font-size:34px;color:#4B5362;margin-bottom:44px}
.row{display:flex;gap:26px;align-items:flex-start;padding:30px 0;border-top:2px solid #E2DFD4;opacity:.12}
.row.on{opacity:1}
.row:last-child{border-bottom:2px solid #E2DFD4}
.no{flex:0 0 58px;height:58px;border-radius:50%;border:3px solid #B8740C;color:#8F5800;font:700 28px/52px "JetBrains Mono",monospace;text-align:center}
.nm{font-size:42px;font-weight:700;line-height:1.35}
.by{font-size:28px;color:#5F6674;margin-top:6px}
.big{font:700 240px/1 "JetBrains Mono",monospace;color:#1A1D24;letter-spacing:-.04em;margin:40px 0 10px}
.big small{font-size:64px;color:#4B5362;font-family:"Noto Sans KR",sans-serif;font-weight:700;margin-left:16px}
.lbl{font-size:40px;color:#4B5362;font-weight:500}
.bar{height:38px;background:#E2DFD4;border-radius:19px;margin:70px 0 22px;overflow:hidden}
.bar i{display:block;height:100%;background:#B8740C;border-radius:19px}
.foot{font-size:36px;color:#1A1D24;font-weight:700}
.foot b{color:#8F5800}
.outro{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 90px 200px}
.outro .nm2{font-family:"Noto Serif KR",serif;font-weight:900;font-size:96px;margin:36px 0 10px}
.outro .tg{font-size:44px;color:#4B5362;font-weight:500}.outro .tg b{color:#8F5800;font-weight:800}
.outro .url{font:700 46px/1 "JetBrains Mono",monospace;color:#8F5800;margin:70px 0 30px;letter-spacing:.02em}
.outro .desc{font-size:36px;color:#374151;line-height:1.5}
.outro .ai{margin-top:80px;font-size:26px;color:#5F6674;line-height:1.5;border-top:2px solid #E2DFD4;padding-top:26px}
.sub{position:absolute;left:60px;right:60px;top:1470px;bottom:230px;display:flex;align-items:flex-end;justify-content:center;text-align:center}
.sub span{display:inline-block;background:rgba(26,29,36,.92);color:#F7F6F1;font-size:46px;font-weight:800;line-height:1.35;padding:18px 32px;border-radius:16px}
</style>`;
    const top = `<div class="top"><div class="brand">${mark(40)}당말사</div><div class="date">${esc(S.dateKo)} 국회</div></div>`;
    const sub = line ? `<div class="sub"><span>${esc(line)}</span></div>` : '';
    let body = '';
    if (sc.kind === 'hook') {
        const long = [...S.theme].length > 11;
        // 설명(what)은 자막이 읽어주므로 화면엔 안 겹친다 — 헤드라인 + (둘째 컷부터) 건수·날짜만
        body = `<div class="body"><div class="kick">이런 법안이 나왔습니다</div><h1 class="hl${long ? ' s' : ''}">${esc(S.theme)}</h1><div class="meta${cut > 0 ? ' on' : ''}">관련 법안 ${S.count}건 · ${esc(S.dateKo)} 발의</div></div>`;
    } else if (sc.kind === 'bills') {
        const shown = Math.min(S.bills.length, Math.max(1, Math.round((cut + 1) / cuts * S.bills.length)));
        const rows = S.bills.map((b, i) => `<div class="row${i < shown ? ' on' : ''}"><div class="no">${i + 1}</div><div><div class="nm">${esc(shortName(b.name))}</div><div class="by">대표발의 ${esc(b.by || '')}</div></div></div>`).join('');
        body = `<div class="body"><h2 class="h2">관련 법안 <b>${S.count}건</b></h2><div class="lede">${esc(S.theme)}</div>${rows}</div>`;
    } else if (sc.kind === 'context') {
        const pct = Math.max(2, Math.min(100, S.count / Math.max(1, S.proposed) * 100));
        body = `<div class="body"><div class="kick">${esc(S.dateKo)} 하루 동안</div><div class="big">${S.proposed}<small>건</small></div><div class="lbl">국회에 발의된 법안</div><div class="bar"><i style="width:${cut > 0 ? pct.toFixed(1) : 0}%"></i></div><div class="foot">그중 <b>${S.count}건</b>이 「${esc(S.theme)}」</div></div>`;
    } else if (sc.kind === 'outro') {
        body = `<div class="outro">${mark(150)}<div class="nm2">당말사</div><div class="tg">당 말고 <b>사람</b></div><div class="url">dangmalsa.kr</div><div class="desc">법안 원문 · 발의한 의원 · 표결 기록을<br>당 이름 없이 사람 이름으로 봅니다</div><div class="ai">주제와 설명 문장은 AI 가 법안 원문을 읽고 정리한 것으로 사실과 다를 수 있습니다.<br>숫자는 국회 공개 데이터 집계값 · 출처 열린국회정보</div></div>`;
        return `<!doctype html><meta charset="utf-8">${css}${body}${sub}`;
    }
    return `<!doctype html><meta charset="utf-8">${css}${top}${body}${sub}`;
}

const shootFrame = (browser, htmlFile, outPng, budgetMs = 1500) => shoot(browser, `file://${htmlFile}`, outPng, { width: W, height: H, budgetMs, extraArgs: ['--allow-file-access-from-files'] });

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
    if (TTS === 'edge' && !edgeCmd()) { logger.error('[video] edge-tts 가 없습니다 → pip3 install edge-tts'); process.exit(1); }

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
    const browser = findBrowser();
    if (!browser) { logger.error('[video] Chrome·Edge 를 못 찾았습니다. CHROME_PATH 로 지정하세요.'); process.exit(1); }
    const dir = path.join(OUT_ROOT, ex.date);
    const work = path.join(dir, 'slides');
    fs.mkdirSync(work, { recursive: true });

    // 장면(또는 슬라이드) 목록 → { say, render(cut, cuts, line) → html }
    let units, title, narrList;
    if (FORMAT === 'thread') {
        const S = ex.video && ex.video.short;
        if (!S) { logger.warn(`[video] ${ex.date} 는 주제 묶음이 없어 영상을 만들지 않습니다 (${ex.kind}). 전체 포맷은 --format full`); process.exit(0); }
        units = S.scenes.map((sc) => ({ say: sc.say, kind: sc.kind, render: (cut, cuts, line) => sceneHtml(sc, S, cut, cuts, line), budget: 4000 }));
        title = S.title;
        narrList = S.scenes.map((sc) => sc.say);
        logger.info(`[video] ${ex.date} 「${S.theme}」 ${S.count}건 · ${units.length}장면 · TTS ${TTS}/${VOICE}${S.otherThreads ? ` (다른 흐름 ${S.otherThreads}개는 안 씀)` : ''}`);
    } else {
        const narr = (ex.video && ex.video.narration) || [];
        const count = ex.instagram.slideCount;
        if (!narr.length || narr.length !== count) { logger.error(`[video] 나레이션 ${narr.length} ≠ 슬라이드 ${count} — 서버 코드가 최신인지 확인`); process.exit(1); }
        const instaDir = path.join(INSTA_ROOT, ex.date);
        const png = (n) => path.join(instaDir, `${String(n).padStart(2, '0')}.png`);
        if (!fs.existsSync(png(count))) {
            logger.info(`[video] 인스타 PNG 없음 → genInstaCards --date ${ex.date}`);
            sh('node', ['batch/genInstaCards.js', '--date', ex.date, '--base', BASE, '--out', INSTA_ROOT], { stdio: 'inherit' });
        }
        for (let n = 1; n <= count; n++) if (!fs.existsSync(png(n))) { logger.error(`[video] ${png(n)} 없음`); process.exit(1); }
        units = narr.map((say, i) => ({ say, kind: `slide${i + 1}`, render: (cut, cuts, line) => frameHtml(png(i + 1), line, i + 1, count), budget: 1500 }));
        title = (ex.video && ex.video.title) || `${ex.date} 국회 브리핑`;
        narrList = narr;
        logger.info(`[video] ${ex.date} — ${count}장 · TTS ${TTS}/${VOICE}`);
        logger.info(`        "${ex.headline}"`);
    }

    // 3) 장면별: TTS → 길이 → 자막 줄 → 줄마다 프레임 렌더
    //    자막은 나레이션을 문장 단위로 쪼개 구간을 글자 수 비례로 나눈다 (TTS 가 단어별 타이밍을 안 주므로 근사)
    const frames = [];      // { png, dur }
    const wavs = [];        // 장면별 (wav, dur)
    let t0 = 0; const srt = []; let si = 1; let fi = 0;
    for (let n = 1; n <= units.length; n++) {
        const u = units[n - 1];
        const wav = path.join(work, `s${n}.wav`);
        tts(u.say, wav);
        const dur = Math.max(MIN_SLIDE, probeDuration(wav) + TAIL);
        wavs.push({ wav, dur });
        const lines = toSubLines(u.say);
        const segs = lines.length ? lines : [''];
        const wts = segs.map((l) => Math.max(4, [...l].length)), wsum = wts.reduce((a, b) => a + b, 0);
        let tt = t0;
        for (let i = 0; i < segs.length; i++) {
            const line = segs[i], each = dur * wts[i] / wsum;
            const html = path.join(work, `f${++fi}.html`), fpng = path.join(work, `f${fi}.png`);
            fs.writeFileSync(html, u.render(i, segs.length, line), 'utf8');
            await shootFrame(browser, html, fpng, u.budget);
            frames.push({ png: fpng, dur: each });
            if (line) srt.push(`${si++}\n${ts(tt)} --> ${ts(tt + each - 0.05)}\n${line}\n`);
            tt += each;
        }
        t0 += dur;
        logger.info(`  ${n}/${units.length} ${u.kind.padEnd(7)} ${dur.toFixed(1)}s · ${segs.length}컷  ${u.say.slice(0, 40)}${u.say.length > 40 ? '…' : ''}`);
    }
    fs.writeFileSync(path.join(dir, 'sub.srt'), srt.join('\n'), 'utf8');

    // 4) 영상: 프레임 concat(길이 지정) / 오디오: 장면 wav 를 각 길이로 패딩 후 concat → 먹스
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
    const narr = narrList;

    // 5) 제목·설명·원고
    const total = parts.reduce((s, p) => s + p.dur, 0);
    const desc = [
        FORMAT === 'thread' ? `${ex.video.short.theme} — ${ex.video.short.what}` : ex.headline, '',
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
