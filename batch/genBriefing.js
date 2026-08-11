// genBriefing.js — 하루치 AI 브리핑 카드 생성
//
// 흐름: 그날 데이터 SQL 집계 → Haiku 로 헤드라인·본문·키워드 생성 → briefing_posts UPSERT
//
// ⚠️ **숫자는 AI 에게서 받지 않는다.** stats 는 SQL 집계 결과를 그대로 저장하고,
//    AI 에게는 "이미 계산된 숫자" 를 주고 문장만 쓰게 한다. 숫자를 생성물에서 받으면
//    환각을 검증할 방법이 없다.
//
// ⚠️ **중립성이 이 배치의 최대 리스크다.** 정치 브리핑을 AI 가 쓰면 "여당이 밀어붙였다" 류의
//    평가가 섞이기 쉽고, 그건 이 서비스 브랜드(정당색 배제)를 정면으로 깬다.
//    프롬프트에서 금지하고, 생성 후 금지어 검사로 한 번 더 거른다.
//
// 인자: --date YYYY-MM-DD (특정일 강제. START_DATE·주말·지연·중복검사를 **전부** 무시)
//       --limit N        (여러 날 한 번에, 기본 1)
//       --force          (이미 카드가 있는 날도 다시 생성)
//       --dry-run        (DB 안 씀)
//
// 크론(`batch:daily`)은 인자 없이 부른다 → 카드 없는 가장 최근 대상일 1건.
// 대상일 = START_DATE 이후 & (활동 있음 | 평일이고 지연 경과) — pickDays 참조.
//
// 카드 종류 3가지 (`model` 컬럼이 가른다):
//   MODEL      🤖 AI 브리핑  — 정상
//   'fallback' 데이터 요약    — AI 실패 시 SQL 집계로 조립
//   'none'     활동 없음      — 그날 발의·처리가 0건 (AI 호출 안 함)

import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { startBatchRun, finishBatchRun } from '../utils/batchRun.js';
import { startWatchdog } from '../utils/watchdog.js';
import { summaryPreview } from '../utils/billSummary.js';

const MODEL = 'claude-haiku-4-5-20251001';
// b1 = 집계 재서술 (폴백과 결과물이 거의 같았음) / b2 = 주제 종합 + 쉬운 말 번역
const PROMPT_VERSION = 'b2';
// per MTok — 비용 기록용 (syncBillAiAnalysis 와 같은 단가)
const PRICE_IN = 1.0, PRICE_OUT = 5.0;

const argv = process.argv.slice(2);
const argOf = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null; };
const DATE_ARG = argOf('--date');
const LIMIT = Number(argOf('--limit') || 1);

/* 🔴 서비스 시작일 — 이 날짜 **이전은 브리핑하지 않는다.**
   과거 발의일이 527일(2024-05-30까지) 쌓여 있어서, 바닥을 두지 않으면 배치가 매일
   과거로 한 칸씩 파고든다. 롤링 창(--window)으로도 막을 수 있지만 그건 "얼마나 과거까지" 가
   시간이 갈수록 따라 움직인다 — 여기서 필요한 건 **고정된 시작점**이다.
   과거 특정일을 굳이 만들려면 `--date 2026-07-01` 로 명시하면 이 바닥을 넘어간다. */
const START_DATE = '2026-08-13';

/* 원천 데이터 지연 — 발의일로부터 우리 DB 에 들어오기까지 걸리는 날 수.
   실측(2026-08 기준) 1~2일. 여유를 둬 3일.
   ⚠️ **"발의 없음" 카드를 쓸 때 이 값이 결정적이다.** 지연이 지나기 전에 "이날은 발의가
      없었다" 고 단정하면, 실제로는 30건이 발의됐는데 아직 안 들어온 것일 수 있다.
      카드는 한 번 쓰면 다시 안 고치므로 그 거짓이 영구히 남는다. */
const INGEST_LAG_DAYS = 3;
const FORCE = argv.includes('--force');
const DRY = argv.includes('--dry-run');

/* ── 그날 데이터 수집 (전부 SQL — AI 입력이자 stats 저장값) ── */
async function collect(pool, day) {
    const [proposed, committees, hotLaws, floor, cmt, topBills] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS cnt, COUNT(DISTINCT mona_cd)::int AS proposers,
                           COALESCE(SUM(co_proposer_count),0)::int AS cosign
                      FROM bills WHERE propose_dt = $1`, [day]),
        pool.query(`SELECT committee, COUNT(*)::int AS cnt FROM bills
                     WHERE propose_dt = $1 AND committee IS NOT NULL AND committee <> ''
                     GROUP BY 1 ORDER BY 2 DESC LIMIT 5`, [day]),
        pool.query(`SELECT bill_name, COUNT(*)::int AS cnt FROM bills
                     WHERE propose_dt = $1 GROUP BY 1 HAVING COUNT(*) > 1
                     ORDER BY 2 DESC LIMIT 3`, [day]),
        pool.query(`SELECT proc_result_name AS result, COUNT(*)::int AS cnt FROM bills
                     WHERE proc_dt = $1 GROUP BY 1 ORDER BY 2 DESC`, [day]),
        pool.query(`SELECT cmt_proc_result AS result, COUNT(*)::int AS cnt FROM bills
                     WHERE cmt_proc_dt = $1 GROUP BY 1 ORDER BY 2 DESC`, [day]),
        // ⚠️ **그날 전건**을 가져온다 (v1 은 LIMIT 5 였다).
        //    주제를 가로질러 찾으려면 전부 읽어야 한다 — 5건만 주면 나머지는 존재하지도 않는 셈이라
        //    "여러 건을 관통하는 주제" 를 찾으라는 요구 자체가 성립하지 않는다.
        //    요약도 160자 → 700자. 관 문체 한 문단은 그보다 짧으면 무슨 법인지 알 수 없다.
        //    비용: 51건 최대 실측 in 23,478 tok = $0.028. 하루 1콜이라 연 $6 수준.
        pool.query(`SELECT b.bill_id, b.bill_name, b.proposer_name, p.party_name,
                           b.co_proposer_count, b.committee, LEFT(b.summary, 700) AS summary
                      FROM bills b LEFT JOIN politicians p ON p.mona_cd = b.mona_cd
                     WHERE b.propose_dt = $1
                     ORDER BY b.co_proposer_count DESC NULLS LAST, b.bill_id`, [day]),
    ]);

    return {
        day,
        proposed: proposed.rows[0],
        committees: committees.rows,
        hotLaws: hotLaws.rows,
        floor: floor.rows,
        committeeProc: cmt.rows,
        allBills: topBills.rows,              // 프롬프트 입력 (전건)
        topBills: topBills.rows.slice(0, 5),  // 카드에 붙일 대표 법안 (공동발의 많은 순)
    };
}

/* ── 프롬프트 (v2) ──
   ⚠️ **AI 에게 집계를 다시 말하게 시키지 말 것.** v1 이 그 실수를 했다:
      "3~4문장. 무엇이 몇 건 있었고 어디에 몰렸는지" 는 composeFallback() 의 직무기술서다.
      그 결과 AI 카드와 폴백 카드가 어순만 다른 같은 글이 됐고, "AI 를 쓸 이유가 있나" 가 됐다.

   AI 가 실제로 값을 더하는 지점은 **집계 키를 가로지르는 주제를 찾는 것**이다.
   2026-07-30 실측: 51건 중 25건이 인구감소지역 정책 하나로 묶였는데, 14개 부처·서로 다른
   법률에 흩어져 있어 committee 로도 bill_name 으로도 GROUP BY 가 안 된다. SQL 이 못 하는 일. */
const SYSTEM = `당신은 대한민국 국회 데이터를 시민에게 전달하는 중립적 브리핑 작성자입니다.

당신의 일은 **집계를 다시 말하는 것이 아닙니다.** 건수·의원 수 같은 숫자는 화면에 표로 따로
표시되므로, 문장에서 숫자를 나열하면 같은 말이 두 번 나옵니다.

당신이 할 일은 데이터베이스가 못 하는 것입니다:
1. 그날 발의된 법안을 **전부 읽고**, 여러 건을 관통하는 주제가 있으면 찾아내기.
   위원회가 다르고 법률명이 달라도 실제로 같은 문제를 다루는 경우가 있습니다 — 그건
   기계적 분류로는 안 보이고, 내용을 읽어야만 보입니다.
2. 관 문체로 쓰인 법안 내용을 **일상어로 옮기기**
   ("이격거리 기준의 조례 위임 근거 마련" → "태양광 설비를 집에서 얼마나 떨어뜨릴지 지자체가 정하게")
3. 주제로 안 묶이는 날이면 억지로 묶지 말고, **눈에 띄는 개별 법안 두세 건**을 그렇게 소개하기

절대 규칙:
1. 주어진 데이터에 없는 사실을 만들지 마세요. 숫자를 새로 계산하거나 추정하지 마세요.
2. 정당·정치인에 대한 평가·비판·옹호를 하지 마세요. "여당/야당이 ~했다" 같은 대립 구도로 쓰지 마세요.
3. 법안의 좋고 나쁨, 통과 가능성, 정치적 의도를 추측하지 마세요.
   "이 법이 통과되면 ~해질 것" 도 추측입니다. **법안이 무엇을 바꾸려 하는지**만 쓰세요.
4. 정당 이름은 사실 전달에 필요할 때만 쓰고, 정당 간 우열이나 대조를 암시하지 마세요.
5. 감정적·선동적 표현을 쓰지 마세요. 담담한 서술체로 쓰세요.
6. 주어진 데이터는 **하루치**입니다. "한 달간", "7월 국회", "이번 주", "최근" 처럼 기간을
   넓히는 표현을 쓰지 마세요. 기간은 반드시 "8월 5일" 처럼 그날 하나로만 지칭하세요.
   (하루 24건을 "7월 한 달간 24건" 으로 쓰면 실제 월 합계 651건과 27배 어긋납니다.)

당신이 하는 일은 "무슨 일이 있었는지" 를 사실대로 전하는 것입니다. 해석은 독자의 몫입니다.

출력은 JSON 하나만. 다른 텍스트를 붙이지 마세요.
{
  "headline": "그날 국회가 무엇을 다뤘는지 한 줄 (40자 이내, 마침표 없이). 건수를 헤드라인으로 쓰지 마세요.",
  "body": "4~6문장. 주제 → 대표 법안이 실제로 바꾸려는 것(쉬운 말). 건수 나열 금지.",
  "threads": [{ "theme": "주제명(15자 이내)", "what": "그 주제의 법안들이 바꾸려는 것 한 문장", "bills": [1, 4, 7] }],
  "keywords": ["뉴스 검색어 5개"]
}

threads 는 0~3개입니다. 실제로 **2건 이상**이 같은 문제를 다룰 때만 넣고, 억지로 채우지 마세요.
- "bills" 는 입력 목록의 **번호**입니다. 그 주제에 해당하는 법안 번호를 빠짐없이 적으세요.
- ⚠️ **건수를 세지 마세요.** 개수는 번호 목록에서 자동으로 계산됩니다.

keywords 는 뉴스 검색어로 쓰이므로:
- 법률명·정책 분야·제도명 같은 **주제어**로 (예: "조세특례제한법", "소상공인 지원")
- 정당명·정치인명은 넣지 마세요 (검색 결과가 정쟁 기사로 쏠립니다)`;

function buildUserPrompt(d) {
    const [, mm, dd] = d.day.split('-');
    const L = [];
    // ⚠️ **"하루치" 라고 못 박아야 한다.** 날짜만 주면 AI 가 기간을 임의로 넓힌다 —
    //    실제로 2026-07-31 카드가 "7월 한 달간 24건" 으로 나왔다 (7월 전체는 651건, 24건은 그날 하루치).
    //    숫자는 SQL 이 주므로 환각이 안 나지만, **그 숫자가 어느 기간의 것인지**는 여기서 고정해야 한다.
    L.push(`[집계 범위] ${d.day} **하루** (${Number(mm)}월 ${Number(dd)}일 당일). 아래 숫자는 전부 이 하루치다.`);
    L.push(`[발의] ${d.proposed.cnt}건 · 대표발의 의원 ${d.proposed.proposers}명 · 공동발의 서명 ${d.proposed.cosign}건`);

    if (d.committees.length) {
        L.push(`[위원회별 발의] ${d.committees.map((c) => `${c.committee} ${c.cnt}건`).join(', ')}`);
    }
    if (d.hotLaws.length) {
        L.push(`[같은 법률에 몰린 개정안] ${d.hotLaws.map((h) => `${h.bill_name} ${h.cnt}건`).join(', ')}`);
    }
    if (d.floor.length) {
        L.push(`[본회의 처리] ${d.floor.map((f) => `${f.result || '결과 미기재'} ${f.cnt}건`).join(', ')}`);
    } else {
        L.push('[본회의 처리] 없음');
    }
    if (d.committeeProc.length) {
        L.push(`[위원회 처리] ${d.committeeProc.map((c) => `${c.result || '결과 미기재'} ${c.cnt}건`).join(', ')}`);
    }

    if (d.allBills.length) {
        // 번호는 threads[].bills 가 참조하는 키다. 여기 순서를 바꾸면 매핑이 어긋난다.
        L.push(`\n[그날 발의된 법안 전체 ${d.allBills.length}건]`);
        d.allBills.forEach((b, i) => {
            L.push(`${i + 1}. ${b.bill_name} [${b.committee || '회부 전'}] 공동발의 ${b.co_proposer_count}인`);
            const s = summaryPreview(b.summary, 400);
            if (s) L.push(`   ${s}`);
        });
    }
    return L.join('\n');
}

/* ── 중립성 후처리 검사 ──
   프롬프트만으로는 새지 않는다는 보장이 없다. 생성물에 평가·대립 표현이 있으면 폐기한다. */
const BANNED = [
    '여당', '야당', '밀어붙', '강행', '발목', '독주', '폭주', '꼼수', '무능', '실정',
    '비판받', '논란을 일으', '반발을 샀', '공세', '역풍',
];
function neutralityCheck(text) {
    const hits = BANNED.filter((w) => text.includes(w));
    return { ok: hits.length === 0, hits };
}

/* ── 집계 범위 검사 ──
   중립성과는 다른 실패 모드다: **숫자는 맞는데 기간을 틀리게 붙이는 것.**
   숫자 자체는 SQL 이 주므로 환각이 안 나지만, AI 가 하루치를 "7월 한 달간" 으로 옮기면
   24건이 651건(실제 7월 합계)의 자리에 앉는다 — 검증 불가능한 거짓이 된다.

   판정: **그 카드 자신의 월**이 `N일` 없이 나오면 탈락.
     (07-31 카드) "7월 한 달간" ❌   "8월 10일" ✅
     (08-07 카드) "8월 발의 법안 26건" ❌

   ⚠️ **"모든 N월" 을 검사하면 안 된다.** 처음에 그렇게 만들었다가 15건 중 5건이 오탐으로
      폴백됐다 — `"한편 6월 지방선거 때 투표용지 부족으로…"` 처럼 법안이 언급한 과거 사건·
      시행 시기가 걸린 것이다. 그건 집계 기간과 무관하다.
      AI 가 자기 집계에 기간을 잘못 붙일 때는 **반드시 그 카드의 월**을 쓴다 (7월 데이터를
      "7월 한 달간" 이라 부르지 "10월 한 달간" 이라 하지 않는다). 그래서 자기 월만 본다.
      남는 오탐은 "매년 7월" 류인데 훨씬 드물고, 걸려도 폴백일 뿐 거짓이 나가진 않는다. */
const PERIOD_WORDS = [
    '한 달간', '한달간', '한 달 동안', '이번 주', '이번주', '지난 주', '지난주',
    '한 주간', '주간', '월간', '연간', '올 들어', '올해 들어',
    '이번 달', '이번달', '이달', '지난달', '지난 달',
];
function scopeCheck(text, day) {
    const hits = PERIOD_WORDS.filter((w) => text.includes(w));
    // 이 카드의 월이 `N일` 없이 등장하는 경우 (다른 달은 법안 내용이므로 건드리지 않는다)
    const month = Number(String(day).split('-')[1]);
    if (Number.isFinite(month)) {
        const own = text.match(new RegExp(`(?<!\\d)${month}\\s*월(?!\\s*\\d+\\s*일)`, 'g'));
        if (own) hits.push(...own.map((m) => `${m}(일 없음)`));
    }
    // ⚠️ 탈락 사유에 **앞뒤 문맥을 같이 남긴다.** 히트 단어만 찍으면 오탐인지 진짜인지
    //    판단할 수 없어 프롬프트를 고칠 근거가 없다 (실제로 "10월(일 없음)" 만 보고는 못 고쳤다).
    const ctx = hits.map((h) => {
        const w = h.replace(/\(일 없음\)$/, '');
        const i = text.indexOf(w);
        return i < 0 ? h : `${h} → "…${text.slice(Math.max(0, i - 25), i + w.length + 25)}…"`;
    });
    return { ok: hits.length === 0, hits: ctx };
}

/* ── threads 정리 — **개수는 코드가 센다** ──
   AI 에게 건수를 직접 묻지 않는 이유: 실험에서 2026-07-30 "인구감소지역" 을 21건이라고
   답했으나 실제는 25건이었다. 주제를 찾는 능력과 세는 능력은 별개다.
   → AI 는 입력 목록의 **번호**만 돌려주고, 여기서 실제 법안에 매핑해 개수를 낸다.
     그러면 건수가 생성물이 아니라 파생값이 되어 stats 와 같은 신뢰 등급을 갖는다.

   범위 밖 번호는 조용히 버린다 (환각 방지). 유효 법안이 2건 미만이면 주제로 치지 않는다 —
   프롬프트가 "2건 이상일 때만" 이라고 요구하므로 그 아래는 억지 묶음이다. */
const MAX_THREADS = 3;
function shapeThreads(raw, d) {
    if (!Array.isArray(raw)) return [];

    return raw.slice(0, MAX_THREADS).map((t) => {
        const idx = Array.isArray(t?.bills) ? t.bills : [];
        const picked = [...new Set(idx
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= d.allBills.length))]
            .map((n) => d.allBills[n - 1]);

        return {
            theme: String(t?.theme || '').slice(0, 40),
            what: String(t?.what || ''),
            bill_count: picked.length,                       // ← 코드가 센 값
            bill_ids: picked.map((b) => b.bill_id),
        };
    }).filter((t) => t.theme && t.what && t.bill_count >= 2);
}

async function generate(anthropic, d) {
    const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: 'user', content: buildUserPrompt(d) }],
    });

    const raw = res.content.map((c) => (c.type === 'text' ? c.text : '')).join('').trim();
    const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let out;
    try {
        out = JSON.parse(json);
    } catch {
        throw new Error(`JSON 파싱 실패: ${json.slice(0, 160)}`);
    }
    if (!out.headline || !out.body) throw new Error('headline/body 누락');

    const threads = shapeThreads(out.threads, d);

    // ⚠️ threads 의 `what` 도 화면에 그대로 나간다 — body 와 **같은 검사를 받아야 한다.**
    //    본문만 검사하면 중립성·기간 문제가 threads 로 새어나간다.
    const full = [out.headline, out.body, ...threads.map((t) => `${t.theme} ${t.what}`)].join(' ');

    const check = neutralityCheck(full);
    if (!check.ok) throw new Error(`중립성 검사 탈락 — 금지 표현: ${check.hits.join(', ')}`);

    const scope = scopeCheck(full, d.day);
    if (!scope.ok) throw new Error(`집계 범위 검사 탈락 — 하루치를 넓힌 표현: ${scope.hits.join(', ')}`);

    return {
        headline: String(out.headline).slice(0, 140),
        body: String(out.body),
        threads,
        keywords: Array.isArray(out.keywords) ? out.keywords.slice(0, 5).map(String) : [],
        usage: res.usage,
    };
}

/* ── AI 실패 시 폴백 카드 (SQL 만으로 조립) ──
   API 장애·키 만료로 피드가 비는 것을 막는다. **거짓을 쓰지 않는다** — 집계된 사실만 문장으로 잇는다.
   `model='fallback'` 로 표시되어 화면에서 "데이터 요약" 으로 구분되고, 나중에 --force 로 덮어쓸 수 있다. */
function composeFallback(d) {
    const n = (v) => Number(v || 0).toLocaleString('ko-KR');
    const floorTotal = d.floor.reduce((s, f) => s + f.cnt, 0);

    let headline;
    if (floorTotal > 0) {
        headline = `본회의에서 ${n(floorTotal)}건 처리`;
    } else if (d.hotLaws.length) {
        headline = `${d.hotLaws[0].bill_name}에 ${d.hotLaws[0].cnt}건 몰려`;
    } else {
        headline = `법안 ${n(d.proposed.cnt)}건 발의`;
    }

    const s = [];
    s.push(`이날 법안 ${n(d.proposed.cnt)}건이 발의됐습니다. 대표발의한 의원은 ${n(d.proposed.proposers)}명이고, 공동발의 서명은 ${n(d.proposed.cosign)}건입니다.`);
    if (d.committees.length) {
        s.push(`위원회별로는 ${d.committees.slice(0, 3).map((c) => `${c.committee} ${c.cnt}건`).join(', ')} 순입니다.`);
    }
    if (d.hotLaws.length) {
        s.push(`같은 법률에 개정안이 몰린 경우로는 ${d.hotLaws.map((h) => `${h.bill_name} ${h.cnt}건`).join(', ')}이 있습니다.`);
    }
    if (floorTotal > 0) {
        s.push(`본회의에서는 ${d.floor.map((f) => `${f.result || '결과 미기재'} ${f.cnt}건`).join(', ')}이 처리됐습니다.`);
    }

    // 키워드는 법률명·위원회명에서 뽑는다 (정당·인명은 넣지 않는다 — 검색이 정쟁 기사로 쏠린다)
    const kw = [
        ...d.hotLaws.map((h) => h.bill_name.replace(/\s*(일부개정법률안|전부개정법률안|법률안|제정법률안)$/, '')),
        ...d.committees.map((c) => c.committee.replace(/위원회$/, '')),
    ].filter(Boolean);

    return {
        headline: headline.slice(0, 140),
        body: s.join(' '),
        // 주제 묶음은 내용을 읽어야 나오는 것이라 SQL 로는 만들 수 없다. 폴백은 항상 빈 배열 —
        // 뷰가 threads 없는 카드를 정상 처리하므로(그냥 안 그림) 화면은 깨지지 않는다.
        threads: [],
        keywords: [...new Set(kw)].slice(0, 5),
        usage: { input_tokens: 0, output_tokens: 0 },
        fallback: true,
    };
}

/* ── "활동 없음" 카드 ──
   ⚠️ **AI 를 부르지 않는다.** 요약할 내용이 없는데 문장을 지어내라고 하면 없는 사실이 나온다.
   그리고 "없습니다" 한 줄로 끝내면 정보량이 0이라 카드를 만든 의미가 없으므로,
   **마지막 활동이 언제 몇 건이었는지**를 붙여 독자가 공백의 길이를 가늠할 수 있게 한다. */
async function composeEmpty(pool, day) {
    const { rows: [prev] } = await pool.query(`
        WITH last AS (SELECT MAX(propose_dt) AS day FROM bills WHERE propose_dt < $1)
        SELECT TO_CHAR(l.day, 'YYYY-MM-DD')                                        AS day
             , ($1::date - l.day)::int                                             AS days_ago
             , (SELECT COUNT(*) FROM bills b WHERE b.propose_dt = l.day)::int      AS cnt
          FROM last l WHERE l.day IS NOT NULL`, [day]);

    const s = ['이날 국회에 새로 발의된 법안이 없고, 본회의·위원회에서 처리된 안건도 없습니다.'];
    if (prev) {
        s.push(`가장 최근 발의는 ${prev.day.replace(/-/g, '.')}(${prev.days_ago}일 전) ${prev.cnt}건이었습니다.`);
    }

    return {
        headline: '이날 국회에 기록된 활동이 없습니다',
        body: s.join(' '),
        threads: [],
        keywords: [],
        usage: { input_tokens: 0, output_tokens: 0 },
        empty: true,
    };
}

/* ── 대상 날짜 고르기 ── */
/* 대상 날짜 고르기 — **달력 기준**이다 (bills 에 있는 발의일 목록이 아니라).
   발의가 0건인 날도 후보에 넣어야 "이날은 발의가 없었습니다" 카드를 쓸 수 있기 때문.
   이전에는 `FROM bills` 로 뽑아서 발의 없는 날은 아예 존재하지 않는 것처럼 취급됐다.

   ⚠️ **주말은 제외한다.** 실측 최근 119일에서 주말 34일은 **예외 없이 전부** 발의 0건이었다.
      매주 토·일에 "발의 없음" 을 남기면 연 104장이 쌓이는데, 국회가 원래 안 하는 날이라
      정보가 아니라 노이즈다. 평일 무발의는 85일 중 6일(7%)뿐이라 그건 진짜 신호다.
      (주말에 본회의가 열리는 예외가 생기면 아래 `has_activity` 가 잡아준다.) */
async function pickDays(pool) {
    if (DATE_ARG) return [DATE_ARG];      // 명시 지정은 시작일·주말·지연을 전부 무시한다

    const { rows } = await pool.query(`
        WITH days AS (
            SELECT generate_series($1::date, CURRENT_DATE - 1, '1 day')::date AS day
        ), enriched AS (
            SELECT d.day
                 , EXISTS (SELECT 1 FROM bills b WHERE b.propose_dt = d.day) AS has_bills
                 , EXISTS (SELECT 1 FROM bills b
                            WHERE b.proc_dt = d.day OR b.cmt_proc_dt = d.day) AS has_proc
              FROM days d
        )
        SELECT TO_CHAR(e.day, 'YYYY-MM-DD') AS day
          FROM enriched e
         WHERE (
                 -- 활동이 있는 날은 주말이라도 대상 (주말 본회의 등 예외 대응)
                 e.has_bills OR e.has_proc
                 -- 활동이 없는 날은 평일만, 그리고 원천 지연이 지난 뒤에만 "없음" 으로 확정
                 OR (EXTRACT(ISODOW FROM e.day) < 6 AND e.day <= CURRENT_DATE - $2::int)
               )
           ${FORCE ? '' : `AND (
                 NOT EXISTS (SELECT 1 FROM briefing_posts bp WHERE bp.briefing_date = e.day)
                 -- "발의 없음" 으로 써둔 카드는 나중에 법안이 들어오면 **다시 만든다.**
                 -- 지연 때문에 빈 카드를 잘못 쓴 경우를 스스로 교정하는 유일한 장치다.
                 OR EXISTS (SELECT 1 FROM briefing_posts bp
                             WHERE bp.briefing_date = e.day
                               AND COALESCE((bp.stats->>'proposed')::int, 0) = 0
                               AND e.has_bills)
               )`}
         ORDER BY e.day DESC
         LIMIT $3`, [START_DATE, INGEST_LAG_DAYS, LIMIT]);
    return rows.map((r) => r.day);
}

async function run() {
    logger.info(`[Briefing Gen START]${DRY ? ' (dry-run)' : ''}`);
    const stopWatchdog = startWatchdog('genBriefing', 10);
    const pool = new pg.Pool(dbConfig);
    const runId = DRY ? null : await startBatchRun(pool, 'genBriefing');
    const started = Date.now();

    try {
        const days = await pickDays(pool);
        if (days.length === 0) {
            // 창 안에 새 발의일이 없는 정상 상태다 (주말·휴회). 실패가 아니다.
            logger.info(`[생성] 대상 날짜가 없습니다 — ${START_DATE} 이후 대상일이 모두 생성됨.`);
            await finishBatchRun(pool, runId, { status: 'success', stats: { generated: 0, skipped: true } });
            return;
        }
        logger.info(`[생성] 대상 ${days.length}일: ${days.join(', ')}`);

        const anthropic = new Anthropic();
        let ok = 0, failed = 0, fellBack = 0, empty = 0, cost = 0;

        for (const day of days) {
            const d = await collect(pool, day);

            try {
                let g;
                const nothing = d.proposed.cnt === 0 && d.floor.length === 0 && d.committeeProc.length === 0;
                if (nothing) {
                    // AI 를 부르지 않는다 — 요약할 내용이 없는데 문장을 짓게 하면 없는 사실이 나온다
                    g = await composeEmpty(pool, day);
                    empty++;
                    logger.info(`  ${day} — 활동 없음 카드 ("${g.headline}")`);
                } else try {
                    g = await generate(anthropic, d);
                } catch (aiErr) {
                    // AI 실패(키 만료·장애·중립성 탈락)해도 피드를 비우지 않는다.
                    // 폴백은 집계된 사실만 잇는 것이라 거짓이 들어가지 않는다.
                    logger.warn(`  ${day} AI 실패 → 폴백 카드로 대체: ${aiErr.message}`);
                    g = composeFallback(d);
                    fellBack++;
                }
                const c = (g.usage.input_tokens / 1e6) * PRICE_IN + (g.usage.output_tokens / 1e6) * PRICE_OUT;
                cost += c;

                // stats 는 **SQL 집계 결과**를 그대로 저장한다 (AI 출력이 아님)
                const stats = {
                    proposed: d.proposed.cnt,
                    proposers: d.proposed.proposers,
                    cosign: d.proposed.cosign,
                    committees: d.committees,
                    hotLaws: d.hotLaws,
                    floor: d.floor,
                    committeeProc: d.committeeProc,
                };

                logger.info(`  ${day} — "${g.headline}" $${c.toFixed(5)}`);
                (g.threads || []).forEach((t) => logger.info(`      · ${t.theme} (${t.bill_count}건) — ${t.what}`));

                if (!DRY) {
                    await pool.query(`
                        INSERT INTO briefing_posts
                            (briefing_date, headline, body, keywords, stats, bill_ids, threads,
                             model, prompt_version, tokens_input, tokens_output, cost_usd)
                        VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12)
                        ON CONFLICT (briefing_date) DO UPDATE SET
                            headline = EXCLUDED.headline, body = EXCLUDED.body,
                            keywords = EXCLUDED.keywords, stats = EXCLUDED.stats,
                            bill_ids = EXCLUDED.bill_ids, threads = EXCLUDED.threads,
                            model = EXCLUDED.model,
                            prompt_version = EXCLUDED.prompt_version,
                            tokens_input = EXCLUDED.tokens_input, tokens_output = EXCLUDED.tokens_output,
                            cost_usd = EXCLUDED.cost_usd`,
                        [day, g.headline, g.body, JSON.stringify(g.keywords), JSON.stringify(stats),
                         JSON.stringify(d.topBills.map((b) => b.bill_id)),
                         JSON.stringify(g.threads || []),
                         // 화면 배지를 가르는 값: none=활동 없음 / fallback=데이터 요약 / 그 외=AI 브리핑
                         g.empty ? 'none' : (g.fallback ? 'fallback' : MODEL),
                         PROMPT_VERSION, g.usage.input_tokens, g.usage.output_tokens, c.toFixed(6)]);
                }
                ok++;
            } catch (err) {
                failed++;
                logger.error(`  ${day} 실패: ${err.message}`);
            }
        }

        logger.info(`[Briefing Gen SUCCESS] 생성 ${ok}건 (AI ${ok - fellBack - empty} / 폴백 ${fellBack} / 활동없음 ${empty}) / 실패 ${failed}건 / 비용 $${cost.toFixed(4)} (${((Date.now() - started) / 1000).toFixed(1)}초)`);
        if (fellBack > 0) logger.warn(`  ⚠ 폴백 ${fellBack}건 — ANTHROPIC_API_KEY 확인 후 --force 로 다시 생성하세요.`);
        await finishBatchRun(pool, runId, { status: 'success', stats: { generated: ok, fallback: fellBack, failed, costUsd: Number(cost.toFixed(6)) } });
    } catch (error) {
        logger.error('[Briefing Gen FAILED]:', error);
        await finishBatchRun(pool, runId, { status: 'failed', error: error.message });
    } finally {
        await pool.end();
        stopWatchdog();
        logger.info('[Briefing Gen END]');
    }
}

run();
