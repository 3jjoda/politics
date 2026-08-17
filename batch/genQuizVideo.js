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
import PoliticianService from '../services/PoliticianService.js';
import { loadShortPerson } from '../controllers/BriefingController.js';
import { W, H, sh, has, esc, probeDuration, ttsConfig, edgeCmd, tts, silence, tick, shootFrame, ts, toSubLines, cutTimes, assemble, countdownHtml, FONT_LINK, BASE_CSS, mark, subHtml } from '../utils/shortsKit.js';

const arg = (name, dflt = null) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt;
};
const EP = arg('ep') || 'own-vs-other';
const OUT_ROOT = arg('out') || path.resolve('out/video/quiz');
Object.assign(ttsConfig, { engine: arg('tts') || 'edge', voice: arg('voice') || 'ko-KR-InJoonNeural', rate: arg('rate') || '+8%' });
const TAIL = 0.5, MIN_SCENE = 2.6;
const COUNT_SEC = 3, COUNT_FPS = 10;   // 카운트다운 3초 · 10fps 로 링 애니메이션 프레임을 찍는다 (30장 · 장당 ~2초 캡처)
const nf = (n) => Number(n).toLocaleString('ko-KR');
const MONA = arg('mona'), NAME = arg('name');

/* 보기 3개 만들기 — 실제값 + 중앙값(가까우면 대신 절반) + 반대쪽 하나. 오름차순, 정답 인덱스 반환.
   숫자는 보기 좋게 반올림하되 **정답은 실제값 그대로** 둔다 (보기가 정답을 배신하면 안 된다) */
function mkOpts(actual, median, fmt) {
    const nice = (v) => v >= 100 ? Math.round(v / 10) * 10 : Math.round(v);
    const cands = new Set([actual]);
    const far = Math.abs(actual - median) / Math.max(1, median) > 0.15;
    cands.add(far ? nice(median) : nice(median * 0.5));
    if (actual >= median) cands.add(nice(Math.max(1, median * 0.45))); else cands.add(nice(median * 1.7));
    let arr = [...cands].filter((v) => v > 0);
    while (arr.length < 3) arr.push(nice(Math.max(...arr) * 1.5 + 1));
    arr = [...new Set(arr)].sort((a, b) => a - b).slice(0, 3);
    if (!arr.includes(actual)) arr[arr.length - 1] = actual, arr.sort((a, b) => a - b);
    return { opts: arr.map(fmt), pick: arr.indexOf(actual) };
}
const pctOpts = (actual, median) => {
    // 비율은 상한 100 이라 별도 — 정답 · 중앙값(가까우면 −15) · 더 낮은 것
    const nice = (v) => Math.round(v);
    const far = Math.abs(actual - median) > 4;
    let arr = [actual, far ? nice(median) : nice(median - 15), nice(Math.min(actual, median) - 25)];
    arr = [...new Set(arr.map((v) => Math.max(1, Math.min(100, v))))].sort((a, b) => a - b);
    while (arr.length < 3) arr.unshift(Math.max(1, arr[0] - 20));
    return { opts: arr.map((v) => `${v === actual ? actual : '약 ' + v}%`), pick: arr.indexOf(actual) };
};

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
    /* 사람 퀴즈 — 「우리 지역구 의원, 얼마나 일할까?」 같은 틀에 사람만 바꾼다 (× 309). 지역구 이름이 훅이다.
       🔴 누구를 다루나는 편집이다 → 기본은 **무작위**(현직 · 표결 코호트 · KPI 코호트 안). --mona/--name 으로 지정할 땐 그 이유가 밖에 있어야 한다.
       숫자는 의원 상세와 같은 서비스(loadShortPerson)에서. 정당 없음 · 평가어 없음 · 중앙값 병기 */
    person: {
        title: null,   // data 에서 채운다
        async data(pool) {
            const svc = PoliticianService(pool);
            let mona = MONA;
            if (!mona && NAME) {
                const { rows } = await pool.query(`SELECT mona_cd, name, electoral_district FROM politicians WHERE name = $1 ORDER BY active_yn DESC`, [NAME]);
                if (!rows.length) throw new Error(`이름 "${NAME}" 없음`);
                if (rows.length > 1) logger.warn(`[quiz] 동명 ${rows.length}명 → 첫 사람 (${rows.map((r) => r.mona_cd + ' ' + r.electoral_district).join(', ')}). --mona 로 지정 가능`);
                mona = rows[0].mona_cd;
            }
            if (!mona) {
                const { rows } = await pool.query(`
                    SELECT p.mona_cd FROM politicians p
                      JOIN politician_cross_party_vote c ON c.mona_cd = p.mona_cd AND c.in_cohort
                     WHERE p.active_yn
                       AND NOT EXISTS (SELECT 1 FROM politician_titles t WHERE t.mona_cd = p.mona_cd AND t.category IN ('국무위원','의장단'))
                     ORDER BY random() LIMIT 1`);
                mona = rows[0].mona_cd;
            }
            const P = await loadShortPerson(svc, mona);
            if (!P) throw new Error(`의원 재료 없음: ${mona}`);
            const kpi = await svc.getKpiPercentiles(mona);
            const medVote = kpi?.median?.vote != null ? Math.round(kpi.median.vote * 10) / 10 : null;
            return { ...P, medVote, kpi };
        },
        scenes: (P) => {
            const who = `${P.district ? P.district + ' ' : ''}${P.name} 의원`;
            const o1 = mkOpts(P.propose, P.medPropose ?? 56, (v) => `${v}건`);
            const o2 = P.voteRate != null && P.medVote != null ? pctOpts(Math.round(P.voteRate), P.medVote) : null;
            const sc = [
                { kind: 'q', no: 1, who: P, say: `${who}. 22대 국회에서 대표발의한 법안, 몇 건일까요?`,
                  q: `<b>${esc(P.name)}</b> 의원이 22대에서<br>대표발의한 법안은?`, opts: o1.opts },
                { kind: 'count', no: 1 },
                { kind: 'reveal', no: 1, pick: o1.pick, say: `${P.propose}건. 의원 중앙값은 ${P.medPropose}건입니다.`,
                  opts: o1.opts, big: `${P.propose}건`, cap: `의원 중앙값 ${P.medPropose}건${P.kpi?.propose?.label ? ` · ${P.kpi.propose.label}` : ''}` },
            ];
            if (o2) sc.push(
                { kind: 'q', no: 2, say: `본회의 표결에는 얼마나 참여했을까요?`,
                  q: `본회의 표결 <b>${nf(P.voteTotal)}번</b> 중<br>몇 %나 참여했을까?`, opts: o2.opts },
                { kind: 'count', no: 2 },
                { kind: 'reveal', no: 2, pick: o2.pick, say: `${Math.round(P.voteRate)}퍼센트. ${nf(P.voteTotal)}번 중 ${nf(P.voteAttended)}번. 의원 중앙값은 ${Math.round(P.medVote)}퍼센트.`,
                  opts: o2.opts, big: `${P.voteRate}%`, cap: `${nf(P.voteTotal)}번 중 ${nf(P.voteAttended)}번 · 의원 중앙값 ${P.medVote}%` },
            );
            if (P.ownRate != null && P.otherRate != null) sc.push(
                { kind: 'fact', say: `자기 당이 낸 법안엔 ${P.ownRate}퍼센트 찬성. 상대 당 법안엔 ${P.otherRate}퍼센트. 격차 ${P.gap}퍼센트포인트, 의원 중앙값은 ${P.gapMedian}.`,
                  kick: '자기 당 · 상대 당 법안 찬성', pair: [`자기 당 ${P.ownRate}%`, `상대 당 ${P.otherRate}%`], lbl: `격차 ${P.gap}%p · 의원 중앙값 ${P.gapMedian}%p`, foot: '' },
            );
            sc.push({ kind: 'outro', who: P, say: `${P.name} 의원의 발의·표결·발언 기록 전부, 당말사에서. 당신 지역구 의원도 찾아보세요. 당 말고 사람.`,
                      tease: `${esc(P.name)} 의원의 기록,<br>전부 있습니다`, sub: '당신 지역구 의원은?', desc: `발의 · 표결 · 발언 기록을<br>의원 309명 이름으로 봅니다` });
            return sc;
        },
        titleOf: (P) => `${P.district ? P.district + ' ' : ''}${P.name} 의원, 법안 몇 건 냈을까? #국회 #퀴즈`.slice(0, 95),
        desc: (P) => [
            `${P.district ? P.district + ' ' : ''}${P.name} 의원의 22대 국회 기록 — 대표발의 ${P.propose}건(중앙값 ${P.medPropose}) · 본회의 표결 참여 ${P.voteRate}% · 자기 당 법안 찬성 ${P.ownRate}% / 상대 당 ${P.otherRate}%.`, '',
            `📌 ${P.name} 의원 상세: https://dangmalsa.kr/politician/${P.mona}`,
            `🔎 우리 지역구 의원 찾기: https://dangmalsa.kr/politician`,
            `🧭 나와 가장 가까운 국회의원은? https://dangmalsa.kr/balance-game`, '',
            '당말사 — 당 말고 사람. 국회가 공개한 자료를 그대로 모아 매일 정리합니다.',
            '※ 건수는 활동량이지 기여도가 아닙니다. 표결 참여율은 불참을 뺀 값이 아니라 전체 대비. 자기 당·상대 당은 대표발의자의 정당 기준.', '',
            '#국회 #국회의원 #법안 #당말사',
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
.big{font:700 200px/1 "JetBrains Mono",monospace;color:#8F5800;letter-spacing:-.04em;margin:30px 0 14px}
.big.mid{font-size:150px}
.cap{font-size:36px;color:#4B5362;font-weight:500}
.pair{display:flex;gap:24px;margin-top:40px}
.pair div{flex:1;background:#fff;border:3px solid #E2DFD4;border-radius:20px;padding:26px 24px;font-size:38px;font-weight:700;text-align:center}
.pair div b{display:block;font:700 72px/1.1 "JetBrains Mono",monospace;color:#1A1D24;margin-top:8px}
.lbl{font-size:40px;color:#4B5362;font-weight:500}
.foot{margin-top:70px;font-size:44px;font-weight:700;line-height:1.4}
.foot b{color:#8F5800}
.who{display:flex;align-items:center;gap:30px;margin-bottom:40px}
.who img{width:150px;height:150px;border-radius:50%;object-fit:cover;object-position:top;border:5px solid #B8740C;background:#EFEDE4}
.who .n{font-family:"Noto Serif KR",serif;font-weight:900;font-size:64px;line-height:1.1}
.who .d{font-size:32px;color:#4B5362;margin-top:8px}
.outro img{width:190px;height:190px;border-radius:50%;object-fit:cover;object-position:top;border:6px solid #B8740C;margin-bottom:30px}
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
    const face = sc.who && sc.who.photo ? `<img src="${esc(sc.who.photo)}" alt="">` : '';
    const whoHtml = sc.who ? `<div class="who">${face}<div><div class="n">${esc(sc.who.name)}</div><div class="d">${esc([sc.who.district, sc.who.reele].filter(Boolean).join(' · '))}</div></div></div>` : '';
    if (sc.kind === 'q') {
        const shown = Math.min(sc.opts.length, Math.max(1, Math.round((cut + 1) / cuts * sc.opts.length)));
        body = `<div class="body">${whoHtml}<div class="qno">Q${sc.no}</div><h1 class="q">${sc.q}</h1>${sc.opts.slice(0, shown).map((o, i) => `<div class="opt"><div class="k">${'ABC'[i]}</div>${esc(o)}</div>`).join('')}</div>`;
    } else if (sc.kind === 'reveal') {
        const pair = sc.pair ? `<div class="pair">${sc.pair.map((t) => { const w = t.split(' '); const v = w.pop(); return `<div>${esc(w.join(' '))}<b>${esc(v)}</b></div>`; }).join('')}</div>` : '';
        body = `<div class="body"><div class="qno">Q${sc.no} 정답</div>${optsHtml(sc.opts, sc.pick, true)}<div class="big${sc.pair ? ' mid' : ''}">${esc(sc.big)}</div><div class="cap">${esc(sc.cap)}</div>${cut > 0 ? pair : ''}</div>`;
    } else if (sc.kind === 'fact') {
        const pairHtml = (pr) => `<div class="pair">${pr.map((t) => { const w = t.split(' '); const v = w.pop(); return `<div>${esc(w.join(' '))}<b>${esc(v)}</b></div>`; }).join('')}</div>`;
        const main = sc.pair ? pairHtml(sc.pair).replace('class="pair"', 'class="pair" style="margin:0 0 30px"') : `<div class="big">${esc(sc.big)}</div>`;
        body = `<div class="body"><div class="kick">${esc(sc.kick)}</div>${main}<div class="lbl">${esc(sc.lbl)}</div>${cut > 0 && sc.foot ? `<div class="foot">${sc.foot}</div>` : ''}</div>`;
    } else if (sc.kind === 'outro') {
        body = `<div class="outro">${face}<div class="tease">${sc.tease}</div><div class="ask">${esc(sc.sub)}</div>${mark(120)}<div class="nm2">당말사</div><div class="tg">당 말고 <b>사람</b></div><div class="url">dangmalsa.kr</div><div class="desc">${sc.desc}</div></div>`;
        return `<!doctype html><meta charset="utf-8">${CSS}${body}${subHtml(line)}`;
    }
    return `<!doctype html><meta charset="utf-8">${CSS}${top}${body}${subHtml(line)}`;
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
    logger.info(`[quiz] ${EP} · ${JSON.stringify(EP === 'person' ? { mona: d.mona, name: d.name, district: d.district, propose: d.propose, voteRate: d.voteRate, ownRate: d.ownRate, otherRate: d.otherRate } : d)}`);

    const dir = path.join(OUT_ROOT, EP === 'person' ? `person-${d.mona}` : EP), work = path.join(dir, 'frames');
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(work, { recursive: true });

    const allScenes = ep.scenes(d);
    const frames = [], wavs = [], srt = [], narr = [];
    let t0 = 0, si = 1, fi = 0;
    for (const sc of allScenes) {
        fi++;
        if (sc.kind === 'count') {
            // 링 애니메이션 — COUNT_SEC 초를 COUNT_FPS 로 쪼개 프레임마다 캡처, 초마다 째깍
            const q = allScenes.find((x) => x.kind === 'q' && x.no === sc.no);
            const qHtml = `<div class="body" style="justify-content:flex-start;padding-top:40px"><div class="qno">Q${sc.no}</div><h1 class="q" style="font-size:64px;margin-bottom:0">${q.q}</h1></div>`;
            const n = COUNT_SEC * COUNT_FPS, seq = [];
            for (let k = 0; k < n; k++) {
                const html = path.join(work, `f${fi}_${k}.html`), png = path.join(work, `f${fi}_${k}.png`);
                fs.writeFileSync(html, countdownHtml(CSS, top, qHtml, k / n, COUNT_SEC), 'utf8');
                await shootFrame(browser, html, png, 900);
                seq.push(png);
            }
            frames.push({ seq, fps: COUNT_FPS, dur: COUNT_SEC });
            for (let k = 0; k < COUNT_SEC; k++) { const wav = path.join(work, `s${fi}_${k}.wav`); tick(1, wav); wavs.push({ wav, dur: 1 }); }
            t0 += COUNT_SEC;
            logger.info(`  count  ${COUNT_SEC}.0s · ${n}프레임`);
            continue;
        }
        const wav = path.join(work, `s${fi}.wav`);
        const words = tts(sc.say, wav);
        const audio = probeDuration(wav);
        const dur = Math.max(MIN_SCENE, audio + TAIL);
        const segs = toSubLines(sc.say); if (!segs.length) segs.push('');
        narr.push(sc.say);
        wavs.push({ wav, dur });
        const starts = cutTimes(sc.say, segs, words, audio);
        for (let i = 0; i < segs.length; i++) {
            const line = segs[i];
            const each = (i + 1 < segs.length ? starts[i + 1] : dur) - starts[i];
            const html = path.join(work, `f${fi}_${i}.html`), png = path.join(work, `f${fi}_${i}.png`);
            fs.writeFileSync(html, sceneHtml(sc, i, segs.length, line), 'utf8');
            await shootFrame(browser, html, png, 3500);
            frames.push({ png, dur: each });
            if (line) srt.push(`${si++}\n${ts(t0 + starts[i])} --> ${ts(t0 + starts[i] + each - 0.05)}\n${line}\n`);
        }
        t0 += dur;
        logger.info(`  ${sc.kind.padEnd(6)} ${dur.toFixed(1)}s · ${segs.length}컷${words.length ? ' · 단어싱크' : ''}  ${sc.say.slice(0, 44)}`);
    }
    const out = assemble(work, frames, wavs, path.join(dir, 'short.mp4'));
    fs.writeFileSync(path.join(dir, 'sub.srt'), srt.join('\n'), 'utf8');
    fs.writeFileSync(path.join(dir, 'title.txt'), ep.titleOf ? ep.titleOf(d) : ep.title, 'utf8');
    fs.writeFileSync(path.join(dir, 'description.txt'), ep.desc(d), 'utf8');
    fs.writeFileSync(path.join(dir, 'narration.txt'), narr.map((n, i) => `[${i + 1}] ${n}`).join('\n'), 'utf8');
    logger.info(`[quiz] 완료 → ${out}  (${t0.toFixed(1)}초 · ${Math.round(fs.statSync(out).size / 1024)}KB)`);
    if (t0 > 60) logger.warn(`[quiz] ⚠ ${t0.toFixed(0)}초 — 60초 초과`);
}

main().catch((e) => { logger.error(`[quiz] 실패: ${e.message}\n${e.stack}`); process.exit(1); });
