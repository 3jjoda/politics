// genQuizVideo.js — 퀴즈형 쇼츠 「예상 vs 데이터」 (1080×1920 MP4)
//
// 브리핑 쇼츠(genBriefingVideo)가 "서술" 이라 재미가 없다는 피드백(2026-08-17)에서 나온 두 번째 포맷.
// 재미의 최소 단위 = 질문 → 공백(카운트다운) → 답. 시청자가 먼저 찍게 만들고 데이터가 예상을 깬다.
// 우리는 평가하지 않는다 — **예상만 깬다.** 그래서 중립 원칙과 충돌하지 않는다 (숫자는 전부 DB 실측, 정당명 없음).
//
// 편(episode)은 아래 EPISODES 에 정의한다. 숫자는 렌더 시 DB 에서 읽는다 (화면에 하드코딩하지 않는다 — 배치가 매일 움직인다).
//   node batch/genQuizVideo.js                       # 첫 편 (own-vs-other)
//   node batch/genQuizVideo.js --ep own-vs-other --voice ko-KR-SunHiNeural
// 산출물: out/video/quiz/<ep>/short.mp4 · title.txt · description.txt · narration.txt
// 🔴 로컬 전용. 크론 아님. 전제: ffmpeg · edge-tts(pip) · Chrome

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { findBrowser } from '../utils/headlessShot.js';
import { W, H, sh, has, esc, probeDuration, ttsConfig, edgeCmd, tts, silence, tick, shootFrame, ts, toSubLines, assemble, FONT_LINK, BASE_CSS, mark, subHtml } from '../utils/shortsKit.js';

const arg = (name, dflt = null) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt;
};
const EP = arg('ep') || 'own-vs-other';
const OUT_ROOT = arg('out') || path.resolve('out/video/quiz');
Object.assign(ttsConfig, { engine: arg('tts') || 'edge', voice: arg('voice') || 'ko-KR-InJoonNeural', rate: arg('rate') || '+8%' });
const TAIL = 0.5, MIN_SCENE = 2.6;
const nf = (n) => Number(n).toLocaleString('ko-KR');

/* ── 편 정의 ──
   data(client) → 숫자 객체 / scenes(d) → 장면 배열
   장면 kind: q(질문+보기) · count(카운트다운 3-2-1, 말 없음) · reveal(정답) · fact(큰 숫자 한 개) · outro
   말은 say, 화면은 kind 별 템플릿. 자막은 say 에서 자동 */
const EPISODES = {
    'own-vs-other': {
        title: '국회의원은 상대 당 법안에 몇 % 찬성할까? #국회 #퀴즈',
        async data(c) {
            const { rows: [s] } = await c.query(`
                SELECT COUNT(*)::int AS n
                     , ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY own_rate)::numeric, 1)   AS own_med
                     , ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY other_rate)::numeric, 1) AS other_med
                     , ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap)::numeric, 1)        AS gap_med
                     , COUNT(*) FILTER (WHERE own_rate >= 100)::int   AS own_full
                     , COUNT(*) FILTER (WHERE gap >= 10)::int          AS gap10
                     , ROUND(MAX(gap)::numeric, 1)                     AS gap_max
                  FROM politician_cross_party_vote WHERE in_cohort`);
            const { rows: [v] } = await c.query(`
                SELECT COUNT(*)::int AS total
                     , COUNT(*) FILTER (WHERE vote_result = '반대')::int AS against
                     , ROUND(100.0 * COUNT(*) FILTER (WHERE vote_result = '반대') / NULLIF(COUNT(*), 0), 2) AS against_pct
                  FROM bill_votes`);
            return { ...s, ...v, own_full_pct: Math.round(s.own_full / s.n * 100) };
        },
        scenes: (d) => [
            { kind: 'q', no: 1, say: '국회의원은 자기 당이 낸 법안에 몇 퍼센트나 찬성할까요?',
              q: '국회의원은 <b>자기 당</b>이 낸 법안에<br>몇 % 찬성할까?', opts: ['약 70%', '약 85%', `${Math.floor(d.own_med)}% 이상`] },
            { kind: 'count', no: 1 },
            { kind: 'reveal', no: 1, pick: 2, say: `정답은 C. 의원 절반이 ${d.own_med}퍼센트 이상. 100퍼센트인 의원이 ${d.own_full_pct}퍼센트나 됩니다.`,
              q: '국회의원은 <b>자기 당</b>이 낸 법안에<br>몇 % 찬성할까?', opts: ['약 70%', '약 85%', `${Math.floor(d.own_med)}% 이상`],
              big: `${d.own_med}%`, cap: `의원 중앙값 · ${d.n}명 중 ${d.own_full}명은 100%` },
            { kind: 'q', no: 2, say: '그럼, 상대 당이 낸 법안에는요?',
              q: '그럼 <b>상대 당</b>이 낸 법안에는?', opts: ['약 40%', '약 70%', `약 ${Math.round(d.other_med)}%`] },
            { kind: 'count', no: 2 },
            { kind: 'reveal', no: 2, pick: 2, say: `${d.other_med}퍼센트. 자기 당과 차이는 겨우 ${d.gap_med}퍼센트포인트입니다.`,
              q: '그럼 <b>상대 당</b>이 낸 법안에는?', opts: ['약 40%', '약 70%', `약 ${Math.round(d.other_med)}%`],
              big: `${d.other_med}%`, cap: `의원 중앙값 · 자기 당과 격차 ${d.gap_med}%p`, pair: [`자기 당 ${d.own_med}%`, `상대 당 ${d.other_med}%`] },
            { kind: 'fact', say: `본회의 표결 ${nf(d.total)}건 중 반대는 ${d.against_pct}퍼센트. 본회의에 오를 때쯤이면 이미 여야가 걸러낸 뒤거든요.`,
              kick: '왜 이렇게 높을까', big: `${d.against_pct}%`, lbl: `본회의 표결 ${nf(d.total)}건 중 반대표`, foot: '걸러지는 곳은 본회의가 아니라 <b>위원회</b>' },
            { kind: 'outro', say: `그런데 이 격차가 ${Math.floor(d.gap_max)}퍼센트포인트 넘는 의원도 있습니다. 누굴까요. 의원 이름으로 보는 표결 기록, 당말사. 당 말고 사람.`,
              tease: `격차 <b>${d.gap_max}%p</b>인 의원도 있다`, sub: '누구일까요?', desc: `자기 당 · 상대 당 찬성률을<br>의원 ${d.n}명 이름으로 봅니다` },
        ],
        desc: (d) => [
            `국회의원은 자기 당 법안에 몇 % 찬성할까? 상대 당 법안에는? 의원 ${d.n}명의 본회의 표결 기록에서 나온 숫자.`, '',
            `📊 당을 보나, 법안을 보나 (전체 분포): https://dangmalsa.kr/xray#xr-gapdist`,
            `📊 자당 법안엔 예외가 없다: https://dangmalsa.kr/xray#xr-ratedist`,
            `🧭 나와 가장 가까운 국회의원은? https://dangmalsa.kr/balance-game`, '',
            '당말사 — 당 말고 사람. 국회가 공개한 자료를 그대로 모아 매일 정리합니다.',
            '※ 찬성률은 본회의 표결에서 불참을 뺀 값. 자기 당·상대 당은 대표발의자의 정당 기준. 다수당·소수당은 의사일정 구조가 달라 격차를 그대로 비교하면 오해가 될 수 있습니다.', '',
            '#국회 #법안 #국회의원 #당말사',
        ].join('\n'),
    },
};

/* ── 장면 HTML ── */
const CSS = `${FONT_LINK}<style>${BASE_CSS}
.body{position:absolute;left:72px;right:72px;top:330px;bottom:520px;display:flex;flex-direction:column;justify-content:center}
.kick{font:700 30px/1 "JetBrains Mono",monospace;color:#8F5800;letter-spacing:.14em;margin-bottom:34px}
.qno{display:inline-block;font:700 28px/1 "JetBrains Mono",monospace;color:#F7F6F1;background:#B8740C;padding:12px 18px;border-radius:10px;letter-spacing:.1em;margin-bottom:34px;align-self:flex-start}
.q{font-family:"Noto Serif KR",serif;font-weight:900;font-size:84px;line-height:1.22;margin:0 0 60px}
.q b{color:#8F5800}
.opt{display:flex;align-items:center;gap:26px;padding:26px 30px;border:3px solid #C9C5B6;border-radius:20px;margin-bottom:22px;font-size:46px;font-weight:700;background:#fff}
.opt .k{flex:0 0 66px;height:66px;border-radius:50%;border:3px solid #B8740C;color:#8F5800;font:700 32px/60px "JetBrains Mono",monospace;text-align:center}
.opt.pick{border-color:#B8740C;background:#FBF5EA;box-shadow:0 0 0 6px rgba(184,116,12,.18)}
.opt.pick .k{background:#B8740C;color:#fff}
.opt.dim{opacity:.35}
.cnt{position:absolute;left:0;right:0;top:1000px;height:360px;text-align:center;font:700 230px/360px "JetBrains Mono",monospace;color:#B8740C}
.ring{position:absolute;left:50%;top:1000px;width:360px;height:360px;margin-left:-180px;border-radius:50%;border:16px solid #E2DFD4;border-top-color:#B8740C;box-sizing:border-box}
.big{font:700 200px/1 "JetBrains Mono",monospace;color:#8F5800;letter-spacing:-.04em;margin:30px 0 14px}
.big.mid{font-size:150px}
.cap{font-size:36px;color:#4B5362;font-weight:500}
.pair{display:flex;gap:24px;margin-top:40px}
.pair div{flex:1;background:#fff;border:3px solid #E2DFD4;border-radius:20px;padding:26px 24px;font-size:38px;font-weight:700;text-align:center}
.pair div b{display:block;font:700 72px/1.1 "JetBrains Mono",monospace;color:#1A1D24;margin-top:8px}
.lbl{font-size:40px;color:#4B5362;font-weight:500}
.foot{margin-top:70px;font-size:44px;font-weight:700;line-height:1.4}
.foot b{color:#8F5800}
.outro{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 90px 200px}
.outro .tease{font-family:"Noto Serif KR",serif;font-weight:900;font-size:76px;line-height:1.25;margin-bottom:14px}
.outro .tease b{color:#8F5800}
.outro .ask{font-size:52px;font-weight:800;color:#4B5362;margin-bottom:90px}
.outro .nm2{font-family:"Noto Serif KR",serif;font-weight:900;font-size:80px;margin:26px 0 6px}
.outro .tg{font-size:40px;color:#4B5362;font-weight:500}.outro .tg b{color:#8F5800;font-weight:800}
.outro .url{font:700 44px/1 "JetBrains Mono",monospace;color:#8F5800;margin:50px 0 24px}
.outro .desc{font-size:34px;color:#374151;line-height:1.5}
</style>`;
const top = `<div class="top"><div class="brand">${mark(40)}당말사</div><div class="date">국회 퀴즈</div></div>`;
const optsHtml = (opts, pick, dim) => opts.map((o, i) => `<div class="opt${pick === i ? ' pick' : (dim ? ' dim' : '')}"><div class="k">${'ABC'[i]}</div>${esc(o)}</div>`).join('');

function sceneHtml(sc, cut, cuts, line) {
    let body = '';
    if (sc.kind === 'q') {
        const shown = Math.min(sc.opts.length, Math.max(1, Math.round((cut + 1) / cuts * sc.opts.length)));
        body = `<div class="body"><div class="qno">Q${sc.no}</div><h1 class="q">${sc.q}</h1>${sc.opts.slice(0, shown).map((o, i) => `<div class="opt"><div class="k">${'ABC'[i]}</div>${esc(o)}</div>`).join('')}</div>`;
    } else if (sc.kind === 'count') {
        body = `<div class="body" style="justify-content:flex-start;padding-top:40px"><div class="qno">Q${sc.no}</div><h1 class="q" style="font-size:64px;margin-bottom:0">${sc.q}</h1></div><div class="ring"></div><div class="cnt">${sc.n}</div>`;
    } else if (sc.kind === 'reveal') {
        const pair = sc.pair ? `<div class="pair"><div>${esc(sc.pair[0].split(' ')[0] + ' ' + sc.pair[0].split(' ')[1])}<b>${esc(sc.pair[0].split(' ').pop())}</b></div><div>${esc(sc.pair[1].split(' ')[0] + ' ' + sc.pair[1].split(' ')[1])}<b>${esc(sc.pair[1].split(' ').pop())}</b></div></div>` : '';
        body = `<div class="body"><div class="qno">Q${sc.no} 정답</div>${optsHtml(sc.opts, sc.pick, true)}<div class="big${sc.pair ? ' mid' : ''}">${esc(sc.big)}</div><div class="cap">${esc(sc.cap)}</div>${cut > 0 ? pair : ''}</div>`;
    } else if (sc.kind === 'fact') {
        body = `<div class="body"><div class="kick">${esc(sc.kick)}</div><div class="big">${esc(sc.big)}</div><div class="lbl">${esc(sc.lbl)}</div>${cut > 0 ? `<div class="foot">${sc.foot}</div>` : ''}</div>`;
    } else if (sc.kind === 'outro') {
        body = `<div class="outro"><div class="tease">${sc.tease}</div><div class="ask">${esc(sc.sub)}</div>${mark(120)}<div class="nm2">당말사</div><div class="tg">당 말고 <b>사람</b></div><div class="url">dangmalsa.kr</div><div class="desc">${sc.desc}</div></div>`;
        return `<!doctype html><meta charset="utf-8">${CSS}${body}${subHtml(line)}`;
    }
    return `<!doctype html><meta charset="utf-8">${CSS}${top}${body}${sc.kind === 'count' ? '' : subHtml(line)}`;
}

async function main() {
    for (const c of ['ffmpeg', 'ffprobe']) if (!has(c)) { logger.error(`[quiz] ${c} 가 없습니다 → brew install ffmpeg`); process.exit(1); }
    if (ttsConfig.engine === 'edge' && !edgeCmd()) { logger.error('[quiz] edge-tts 가 없습니다 → pip3 install edge-tts'); process.exit(1); }
    const ep = EPISODES[EP];
    if (!ep) { logger.error(`[quiz] 모르는 편: ${EP} (${Object.keys(EPISODES).join(', ')})`); process.exit(1); }
    const browser = findBrowser();
    if (!browser) { logger.error('[quiz] Chrome·Edge 를 못 찾았습니다. CHROME_PATH 로 지정하세요.'); process.exit(1); }

    const pool = new pg.Pool(dbConfig);
    let d;
    try { d = await ep.data(pool); } finally { await pool.end(); }
    logger.info(`[quiz] ${EP} · ${JSON.stringify(d)}`);

    const dir = path.join(OUT_ROOT, EP), work = path.join(dir, 'frames');
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(work, { recursive: true });

    // 카운트다운은 3 장면(3·2·1)으로 펼친다 — 각 1초, 째깍
    const scenes = [];
    for (const sc of ep.scenes(d)) {
        if (sc.kind === 'count') {
            const q = ep.scenes(d).find((x) => x.kind === 'q' && x.no === sc.no);
            for (const n of [3, 2, 1]) scenes.push({ ...sc, q: q.q, n, fixed: 1.0 });
        } else scenes.push(sc);
    }

    const frames = [], wavs = [], srt = [], narr = [];
    let t0 = 0, si = 1, fi = 0;
    for (const sc of scenes) {
        const wav = path.join(work, `s${++fi}.wav`);
        let dur, segs;
        if (sc.fixed) { tick(sc.fixed, wav); dur = sc.fixed; segs = ['']; }
        else { tts(sc.say, wav); dur = Math.max(MIN_SCENE, probeDuration(wav) + TAIL); segs = toSubLines(sc.say); if (!segs.length) segs = ['']; narr.push(sc.say); }
        wavs.push({ wav, dur });
        const wts = segs.map((l) => Math.max(4, [...l].length)), wsum = wts.reduce((a, b) => a + b, 0);
        let tt = t0;
        for (let i = 0; i < segs.length; i++) {
            const line = segs[i], each = dur * wts[i] / wsum;
            const html = path.join(work, `f${fi}_${i}.html`), png = path.join(work, `f${fi}_${i}.png`);
            fs.writeFileSync(html, sceneHtml(sc, i, segs.length, line), 'utf8');
            await shootFrame(browser, html, png, 3500);
            frames.push({ png, dur: each });
            if (line) srt.push(`${si++}\n${ts(tt)} --> ${ts(tt + each - 0.05)}\n${line}\n`);
            tt += each;
        }
        t0 += dur;
        logger.info(`  ${sc.kind.padEnd(6)} ${dur.toFixed(1)}s · ${segs.length}컷  ${(sc.say || `count ${sc.n}`).slice(0, 44)}`);
    }
    const out = assemble(work, frames, wavs, path.join(dir, 'short.mp4'));
    fs.writeFileSync(path.join(dir, 'sub.srt'), srt.join('\n'), 'utf8');
    fs.writeFileSync(path.join(dir, 'title.txt'), ep.title, 'utf8');
    fs.writeFileSync(path.join(dir, 'description.txt'), ep.desc(d), 'utf8');
    fs.writeFileSync(path.join(dir, 'narration.txt'), narr.map((n, i) => `[${i + 1}] ${n}`).join('\n'), 'utf8');
    logger.info(`[quiz] 완료 → ${out}  (${t0.toFixed(1)}초 · ${Math.round(fs.statSync(out).size / 1024)}KB)`);
    if (t0 > 60) logger.warn(`[quiz] ⚠ ${t0.toFixed(0)}초 — 60초 초과`);
}

main().catch((e) => { logger.error(`[quiz] 실패: ${e.message}\n${e.stack}`); process.exit(1); });
