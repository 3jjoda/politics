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
// 인자: --date YYYY-MM-DD (기본: 가장 최근 발의가 있는 날)
//       --limit N        (여러 날 소급 생성)
//       --force          (이미 있는 날도 다시 생성)
//       --dry-run        (DB 안 씀)

import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { startBatchRun, finishBatchRun } from '../utils/batchRun.js';
import { startWatchdog } from '../utils/watchdog.js';
import { summaryPreview } from '../utils/billSummary.js';

const MODEL = 'claude-haiku-4-5-20251001';
const PROMPT_VERSION = 'b1';
// per MTok — 비용 기록용 (syncBillAiAnalysis 와 같은 단가)
const PRICE_IN = 1.0, PRICE_OUT = 5.0;

const argv = process.argv.slice(2);
const argOf = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null; };
const DATE_ARG = argOf('--date');
const LIMIT = Number(argOf('--limit') || 1);
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
        // 카드에 붙일 대표 법안 — 공동발의 많은 순 (1단계에서 쓸 수 있는 유일한 관심도 프록시)
        pool.query(`SELECT b.bill_id, b.bill_name, b.proposer_name, p.party_name,
                           b.co_proposer_count, b.committee, LEFT(b.summary, 300) AS summary
                      FROM bills b LEFT JOIN politicians p ON p.mona_cd = b.mona_cd
                     WHERE b.propose_dt = $1
                     ORDER BY b.co_proposer_count DESC NULLS LAST, b.bill_id
                     LIMIT 5`, [day]),
    ]);

    return {
        day,
        proposed: proposed.rows[0],
        committees: committees.rows,
        hotLaws: hotLaws.rows,
        floor: floor.rows,
        committeeProc: cmt.rows,
        topBills: topBills.rows,
    };
}

/* ── 프롬프트 ── */
const SYSTEM = `당신은 대한민국 국회 데이터를 정리해 시민에게 전달하는 중립적 브리핑 작성자입니다.

절대 규칙:
1. 주어진 데이터에 없는 사실을 만들지 마세요. 숫자를 새로 계산하거나 추정하지 마세요.
2. 정당·정치인에 대한 평가·비판·옹호를 하지 마세요. "여당/야당이 ~했다" 같은 대립 구도로 쓰지 마세요.
3. 법안의 좋고 나쁨, 통과 가능성, 정치적 의도를 추측하지 마세요.
4. 정당 이름은 사실 전달에 필요할 때만 쓰고, 정당 간 우열이나 대조를 암시하지 마세요.
5. 감정적·선동적 표현을 쓰지 마세요. 담담한 서술체로 쓰세요.

당신이 하는 일은 "무슨 일이 있었는지" 를 사실대로 요약하는 것입니다. 해석은 독자의 몫입니다.

출력은 JSON 하나만. 다른 텍스트를 붙이지 마세요.
{
  "headline": "그날을 한 줄로 (40자 이내, 마침표 없이). 가장 두드러진 사실 하나.",
  "body": "3~4문장. 무엇이 몇 건 있었고 어디에 몰렸는지. 숫자는 주어진 것만 사용.",
  "keywords": ["키워드5개", "…"]
}

keywords 는 그날 다뤄진 주제어입니다. 뉴스 검색어로 쓰이므로:
- 법률명·정책 분야·제도명 같은 **주제어**로 (예: "조세특례제한법", "소상공인 지원")
- 정당명·정치인명은 넣지 마세요 (검색 결과가 정쟁 기사로 쏠립니다)`;

function buildUserPrompt(d) {
    const L = [];
    L.push(`[날짜] ${d.day}`);
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

    if (d.topBills.length) {
        L.push('\n[공동발의가 많았던 법안]');
        d.topBills.forEach((b, i) => {
            const s = summaryPreview(b.summary, 160);
            L.push(`${i + 1}. ${b.bill_name} (대표발의 ${b.proposer_name || '—'}, 공동발의 ${b.co_proposer_count}인)`);
            if (s) L.push(`   내용: ${s}`);
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

    const check = neutralityCheck(`${out.headline} ${out.body}`);
    if (!check.ok) throw new Error(`중립성 검사 탈락 — 금지 표현: ${check.hits.join(', ')}`);

    return {
        headline: String(out.headline).slice(0, 140),
        body: String(out.body),
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
        keywords: [...new Set(kw)].slice(0, 5),
        usage: { input_tokens: 0, output_tokens: 0 },
        fallback: true,
    };
}

/* ── 대상 날짜 고르기 ── */
async function pickDays(pool) {
    if (DATE_ARG) return [DATE_ARG];
    const { rows } = await pool.query(`
        SELECT TO_CHAR(propose_dt, 'YYYY-MM-DD') AS day
          FROM bills
         WHERE propose_dt IS NOT NULL
           ${FORCE ? '' : 'AND NOT EXISTS (SELECT 1 FROM briefing_posts bp WHERE bp.briefing_date = bills.propose_dt)'}
         GROUP BY propose_dt
         ORDER BY propose_dt DESC
         LIMIT $1`, [LIMIT]);
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
            logger.info('[생성] 대상 날짜가 없습니다 (이미 전부 생성됨).');
            await finishBatchRun(pool, runId, { status: 'success', stats: { generated: 0, skipped: true } });
            return;
        }
        logger.info(`[생성] 대상 ${days.length}일: ${days.join(', ')}`);

        const anthropic = new Anthropic();
        let ok = 0, failed = 0, fellBack = 0, cost = 0;

        for (const day of days) {
            const d = await collect(pool, day);
            if (d.proposed.cnt === 0 && d.floor.length === 0) {
                logger.info(`  ${day} — 발의·처리 모두 없음, 건너뜀`);
                continue;
            }

            try {
                let g;
                try {
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

                logger.info(`  ${day} — "${g.headline}" (${g.keywords.join(', ')}) $${c.toFixed(5)}`);

                if (!DRY) {
                    await pool.query(`
                        INSERT INTO briefing_posts
                            (briefing_date, headline, body, keywords, stats, bill_ids,
                             model, prompt_version, tokens_input, tokens_output, cost_usd)
                        VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11)
                        ON CONFLICT (briefing_date) DO UPDATE SET
                            headline = EXCLUDED.headline, body = EXCLUDED.body,
                            keywords = EXCLUDED.keywords, stats = EXCLUDED.stats,
                            bill_ids = EXCLUDED.bill_ids, model = EXCLUDED.model,
                            prompt_version = EXCLUDED.prompt_version,
                            tokens_input = EXCLUDED.tokens_input, tokens_output = EXCLUDED.tokens_output,
                            cost_usd = EXCLUDED.cost_usd`,
                        [day, g.headline, g.body, JSON.stringify(g.keywords), JSON.stringify(stats),
                         JSON.stringify(d.topBills.map((b) => b.bill_id)),
                         g.fallback ? 'fallback' : MODEL,   // 화면에서 "AI 브리핑" ↔ "데이터 요약" 을 가르는 값
                         PROMPT_VERSION, g.usage.input_tokens, g.usage.output_tokens, c.toFixed(6)]);
                }
                ok++;
            } catch (err) {
                failed++;
                logger.error(`  ${day} 실패: ${err.message}`);
            }
        }

        logger.info(`[Briefing Gen SUCCESS] 생성 ${ok}건 (AI ${ok - fellBack} / 폴백 ${fellBack}) / 실패 ${failed}건 / 비용 $${cost.toFixed(4)} (${((Date.now() - started) / 1000).toFixed(1)}초)`);
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
