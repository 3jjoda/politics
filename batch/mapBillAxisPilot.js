// mapBillAxisPilot.js — 법안-축 매핑 확장 파일럿 (AI 1차 매핑, 방향 균형 강제)
//
// 왜: 4축 좌표의 병목은 소스(표결/공동발의)가 아니라 **방향 라벨(매핑)** 이다 (CLAUDE.md
//     「공동발의 행렬로 좌표를 뽑는 것도 안 된다」). 매핑 48건 · 방향 13:2 편향으로는 어느 소스든 좌표가 뭉친다.
//     이 파일럿은 (축 × 방향) 8개 셀에 **정원을 두고** 채워질 때까지 후보를 분류한다.
//
// 산출: bill_axis_mapping_pilot (별도 테이블 — v1 48건이 든 bill_axis_mapping 은 PK 가 bill_id 단독이라
//       버전을 겹쳐 둘 수 없다). 분류 결과는 'none' 까지 전건 저장하고, 균형 선별된 행만 is_selected=TRUE.
//
// 사용:
//   node batch/mapBillAxisPilot.js                       # 목표 300건 (셀당 38 → 축당 75)
//   node batch/mapBillAxisPilot.js --target 300 --max-candidates 3000
//   node batch/mapBillAxisPilot.js --select-only         # 분류 없이 기존 결과로 선별만 다시
//   node batch/mapBillAxisPilot.js --dry-run             # DB 안 씀 (첫 배치 1회만 호출해 형식 확인)
//   node batch/mapBillAxisPilot.js --sync-v2             # 선별 결과를 bill_axis_mapping v2 에 미러링 (분류·선별 뒤에 붙인다)
//   node batch/mapBillAxisPilot.js --reclassify social,institution --sync-v2
//        # 이미 분류된 행 중 해당 축인 것을 **현재 프롬프트로 다시 분류해 덮어쓴다** (2026-08-16 눈금 보정 —
//        #   사회·제도 축 정의를 문항이 재는 것에 맞게 바꾼 뒤 5,544건 재분류 ≈ $6). 후보 신규 표집은 안 한다
//
// 정기 갱신 (분기 1회 권장 · 로컬 · 크론 X — 비용 + 희소 셀 사람 검토):
//   node batch/mapBillAxisPilot.js --target 100000 --max-candidates 20000 --sync-v2
//     → 미분류 법안만 분류(한 달치 ~700건 ≈ $0.8) → 균형 재선별 → v2 미러링 → 다음날 크론의 calcPoliticianAxis 가 좌표 재계산
//   🔴 선별은 **결정적**이다 (confidence → weight → 이미 선별됨 → bill_id). random() 으로 뽑으면 재선별마다 법안이 갈려
//      좌표가 이유 없이 흔들린다. 새 법안은 기존 선별을 밀어내지 않고 빈자리(정원 미달 셀)만 채운다

import 'dotenv/config';
import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { POL_MAPPING_VERSION, MATCH_AXES } from '../utils/axisConfig.js';

const MODEL = 'claude-haiku-4-5-20251001';
const PROMPT_VERSION = 'axis-p2';   // p1: 초기 정의 · p2: 사회·제도 축 정의 보정 (2026-08-16)
const BATCH = 20;              // 호출당 법안 수
const CONCURRENCY = 5;         // 동시 호출 수 (호출당 ~25초라 직렬이면 3,000건에 1시간이 넘는다)
const SUMMARY_CHARS = 420;
const MIN_CO = 8;              // 현직 공동발의자 최소 (표본이 있어야 좌표에 기여)
const AXES = ['economy', 'social', 'security', 'institution'];
const PRICE_IN = 1.0, PRICE_OUT = 5.0, PRICE_CW = 1.25, PRICE_CR = 0.10;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseArgs(argv) {
    const a = { target: 300, maxCandidates: 3000, selectOnly: false, dryRun: false, syncV2: false, reclassify: null };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--target') a.target = parseInt(argv[++i], 10);
        else if (argv[i] === '--max-candidates') a.maxCandidates = parseInt(argv[++i], 10);
        else if (argv[i] === '--select-only') a.selectOnly = true;
        else if (argv[i] === '--sync-v2') a.syncV2 = true;
        else if (argv[i] === '--dry-run') a.dryRun = true;
        else if (argv[i] === '--reclassify') a.reclassify = String(argv[++i] || '').split(',').map(x => x.trim()).filter(x => AXES.includes(x));
    }
    // 🔴 재분류 뒤의 선별은 정원 제한 없이 (기본 300 을 그대로 두면 셀당 38 로 줄여 is_selected 를 통째로 덮어쓴다 — 실제로 한 번 그랬다)
    if (a.reclassify && !argv.includes('--target')) a.target = 100000;
    return a;
}

const SYSTEM_PROMPT = `당신은 한국 국회 법안을 4개 정치 성향 축 중 하나에 매핑하는 분류기입니다. 매핑은 의원 성향 좌표 산출에만 쓰이며 화면에 노출되지 않습니다. **정확성보다 일관성과 보수성**이 중요합니다 — 확실하지 않으면 none.

## 4축 정의와 부호 (절대 흔들리지 말 것)
| axis | -1 (찬성이 이 방향) | +1 (찬성이 이 방향) | 예 |
|---|---|---|---|
| economy | 시장 자율 · 규제 완화 · 감세 · 민간 주도 | 정부 개입 · 규제 강화 · 증세/분배 · 공공 확대 | 최저임금, 부동산 세제, 대기업 규제, 복지 확대 |
| social | 전통 · 가족/성 역할 보수 · 이민 제한 · 표현/집회 규제 · 청소년 보호 규제 · 형벌 우선(사형 유지, 마약 비범죄화 반대) | 자율 · 다양성 · 개인 권리 · 소수자 보호 · 이민 개방 · 표현 자유 · 재활/인권 우선 | 차별금지, 낙태, 동성혼·생활동반자, 이민, 집회, 청소년 규제, 사형, 마약 |
| security | 한미동맹 강화 · 대북 강경 · 국방력 증강 | 자주 · 대북 대화/교류 · 군축/병역 완화 | 한미일 협력, 남북교류, 병역, 방위비 |
| institution | 기존 권력기관(검찰·법원·헌재·선관위·행정부)의 **현행 권한·구성·독립성 유지 또는 강화** · 견제 장치 축소 | 그 기관들에 대한 **외부 견제·권한 분산·구성 개편·투명성 확대** | 수사권 분리, 특검, 공수처, 판결문 공개, 대법관·재판관 인선 개편, 비례제, 국회 감시권 |

## 🔴 social · institution 에서 특히 지켜야 할 것 (2026-08-16 보정)
- **범죄 처벌 강화·형량 가중·단속·수사권 강화 일반은 social 이 아니다 → none.** 여야가 모두 찬성하는 상식이라 성향을 가르지 못한다.
  social 은 "가치 대립이 실제로 있는" 사안에만 — 처벌 vs 재활/인권(사형·마약·소년범·수형자 권리), 가족·성 역할, 이민, 표현·집회, 청소년 규제.
- **institution 은 "바꾸나/두나" 가 아니라 "권력을 어디로 옮기나" 다.** 어떤 개정안이든 무언가를 바꾸므로 "바꾼다 = 개혁" 으로 판정하면 안 된다.
  안정 = 검찰 수사권 유지·확대, 공수처 폐지, 사법부·선관위 독립성/자율 강화, 국회 감시권 축소, 정보 비공개.
  개혁 = 수사권 분리·이관, 특검·공수처 강화, 판결문·수사기록 공개, 대법관 증원·인선 절차 개편, 선거제 비례성, 국회 통제 강화,
         **대통령·행정부 권한 제한(사면권 제한, 인사권 견제 등)** — 기존 권력을 제한하는 쪽은 개혁이다.
- **"헌정질서 수호"·"내란 처벌"·"질서 유지" 는 안정이 아니다.** 처벌·질서 어휘가 붙었다고 안정/전통으로 보내지 말 것 → 위 규칙대로 none 이 기본.

## 규칙
- 법안 하나에 **주축 1개**만. 두 축에 걸치면 더 강한 쪽. 어느 축의 어느 방향인지 **명확히 말할 수 없으면 axis="none"**.
- **none 이 기본값이다.** 다음은 none: 절차·행정·명칭 변경·기술 정비·부칙 / **수당·지원금·보상금·급여의 액수 인상이나 대상 확대**
  (참전유공자 수당 인상, 장애수당 확대 등 — 사실상 모든 개정안이 이런 확대라 매핑하면 전부 개입 +1 로 쏠린다) /
  재해·안전·의료·환경·문화 일반 / 지역 개발 / 조직 신설·기금 근거 마련.
- economy 는 **시장 vs 개입의 대립이 실제로 논쟁되는 사안**에만 준다: 세율·감세/증세, 규제 도입/완화, 노동 보호 vs 유연화,
  민영화/공공화, 대기업·플랫폼 규제, 임대차·분양가 등 가격 개입.
- direction: 찬성(공동발의)한 사람이 어느 방향인가. **반드시 아래 축별 고정 라벨 중 하나** (숫자 대신 라벨로 답한다):
  economy → "시장" | "개입" · social → "전통" | "자율" · security → "동맹" | "자주" · institution → "안정" | "개혁"
  ("동맹" = 한미동맹 강화·대북 강경·국방 증강 쪽, "자주" = 자주·대북 대화·군축 쪽. 헷갈리면 none.)
- weight: 명확 1.0 / 약함 0.5.
- confidence: high / medium / low. low 는 선별에서 제외되므로 애매하면 low.
- reason: 20자 이내, 축 정의 어휘만 (진영·정당·가치 판단 단어 금지). reason 의 방향 어휘와 direction 이 모순되면 안 된다.

## 출력 (JSON 객체 1개, 코드 펜스·설명 금지)
{"results":[{"bill_id":"...","axis":"economy|social|security|institution|none","direction":"시장|개입|전통|자율|동맹|자주|안정|개혁|null","weight":1.0|0.5|null,"confidence":"high|medium|low","reason":"..."}, ...]}
results 순서는 입력 순서와 동일.`;

// 부호는 AI 숫자를 믿지 않고 축별 라벨에서 코드가 정한다 (dry-run 에서 "한미동맹 강화" 라 써놓고 +1 을 준 사례가 있었다)
const DIR_SIGN = {
    economy:     { '시장': -1, '개입': 1 },
    social:      { '전통': -1, '자율': 1 },
    security:    { '동맹': -1, '자주': 1 },
    institution: { '안정': -1, '개혁': 1 },
};

const userMsg = rows => `다음 ${rows.length}건을 매핑하세요.\n\n` + rows.map((r, i) =>
    `${i + 1}. bill_id=${r.bill_id}\n   법안명: ${r.bill_name}\n   소관위: ${r.committee || '-'}\n   제안이유: ${r.summary}`).join('\n\n');

async function classify(anthropic, rows) {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await anthropic.messages.create({
                model: MODEL, max_tokens: 4096,
                system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
                messages: [{ role: 'user', content: userMsg(rows) }],
            });
            let text = res.content[0].text.trim();
            const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/); if (fence) text = fence[1];
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed.results)) throw new Error('results 없음');
            const u = res.usage;
            return { results: parsed.results, usage: { in: u.input_tokens, out: u.output_tokens, cw: u.cache_creation_input_tokens || 0, cr: u.cache_read_input_tokens || 0 } };
        } catch (err) {
            if (err.status === 429) { const w = parseInt(err.headers?.['retry-after'], 10) || 30; logger.warn(`429 — ${w}초 대기`); await sleep(w * 1000); continue; }
            if (attempt === 2) throw err;
            logger.warn(`재시도 (${attempt + 1}): ${err.message.slice(0, 120)}`);
            await sleep(2000);
        }
    }
}

// 후보 풀 — 위원회별 층화 표집 (안보·외교 등 소수 위원회가 자연히 과표집된다). 이미 분류한 법안·v1 48건 제외
async function fetchCandidates(pool, limit) {
    const { rows } = await pool.query(`
        WITH pool AS (
            SELECT b.bill_id, b.bill_name, b.committee, LEFT(b.summary, $2) AS summary,
                   ROW_NUMBER() OVER (PARTITION BY b.committee ORDER BY random()) AS rn
              FROM bills b
             WHERE b.summary IS NOT NULL AND b.committee IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM bill_axis_mapping_pilot p WHERE p.bill_id = b.bill_id)
               AND NOT EXISTS (SELECT 1 FROM bill_axis_mapping m WHERE m.bill_id = b.bill_id)
               AND (SELECT COUNT(*) FROM bill_co_proposers c JOIN politicians pl ON pl.mona_cd = c.mona_cd
                     WHERE c.bill_id = b.bill_id) >= $3
        )
        SELECT bill_id, bill_name, committee, summary FROM pool ORDER BY rn, random() LIMIT $1`,
        [limit, SUMMARY_CHARS, MIN_CO]);
    return rows;
}

// 재분류 대상 — 파일럿 테이블에서 해당 축으로 분류된 행 전부 (confidence 불문). 표집이 아니라 전건이다
async function fetchReclassify(pool, axes, limit, offset) {
    const { rows } = await pool.query(`
        SELECT b.bill_id, b.bill_name, b.committee, LEFT(b.summary, $1) AS summary
          FROM bill_axis_mapping_pilot p JOIN bills b USING (bill_id)
         WHERE p.axis = ANY($2::text[]) AND p.prompt_version <> $3 AND b.summary IS NOT NULL
         ORDER BY b.bill_id LIMIT $4 OFFSET $5`, [SUMMARY_CHARS, axes, PROMPT_VERSION, limit, offset]);
    return rows;
}

async function ensureTable(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS bill_axis_mapping_pilot (
            bill_id        VARCHAR(50) PRIMARY KEY REFERENCES bills(bill_id) ON DELETE CASCADE,
            axis           VARCHAR(20) NOT NULL,          -- economy|social|security|institution|none
            agree_score    SMALLINT,
            disagree_score SMALLINT,
            weight         NUMERIC(3,2),
            confidence     VARCHAR(10),
            reason         TEXT,
            is_selected    BOOLEAN NOT NULL DEFAULT FALSE, -- 방향 균형 선별 통과
            prompt_version VARCHAR(20) NOT NULL,
            model          VARCHAR(50) NOT NULL,
            created_at     TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_bamp_axis ON bill_axis_mapping_pilot (axis, agree_score) WHERE is_selected;`);
}

// 셀별 현황 (high/medium 만 셈)
async function cellCounts(pool) {
    const { rows } = await pool.query(`
        SELECT axis, agree_score, COUNT(*)::int n FROM bill_axis_mapping_pilot
         WHERE axis <> 'none' AND confidence IN ('high','medium') GROUP BY 1,2`);
    const m = {}; for (const ax of AXES) m[ax] = { '-1': 0, '1': 0 };
    for (const r of rows) if (m[r.axis]) m[r.axis][String(r.agree_score)] = r.n;
    return m;
}
const fmtCells = m => AXES.map(ax => `${ax.padEnd(11)} −1:${String(m[ax]['-1']).padStart(3)} +1:${String(m[ax]['1']).padStart(3)}`).join(' | ');

// 균형 선별: 셀당 quota 이하로, 각 축 안에서 두 방향을 min 으로 맞춘다 (남는 쪽은 버린다 — 균형이 목적)
// 🔴 결정적 순서: high 먼저 → weight 큰 것 → **이미 선별된 것** → bill_id. 재실행해도 같은 입력이면 같은 결과,
//    새 법안이 들어와도 기존 선별을 밀어내지 않는다 (random() 은 재선별마다 법안이 갈려 좌표를 흔든다)
async function select(pool, quota, dryRun) {
    const cells = await cellCounts(pool);
    const summary = [];
    const chosen = [];
    for (const ax of AXES) {
        const take = Math.min(quota, cells[ax]['-1'], cells[ax]['1']);
        summary.push({ axis: ax, per_dir: take, total: take * 2, avail_neg: cells[ax]['-1'], avail_pos: cells[ax]['1'] });
        if (take === 0) continue;
        for (const dir of [-1, 1]) {
            const { rows } = await pool.query(`
                SELECT bill_id FROM bill_axis_mapping_pilot
                 WHERE axis = $1 AND agree_score = $2 AND confidence IN ('high','medium')
                 ORDER BY (confidence = 'high') DESC, weight DESC, is_selected DESC, bill_id LIMIT $3`, [ax, dir, take]);
            rows.forEach(r => chosen.push(r.bill_id));
        }
    }
    if (!dryRun) {
        await pool.query(`UPDATE bill_axis_mapping_pilot SET is_selected = (bill_id = ANY($1::text[]))`, [chosen]);
    }
    return summary;
}

// v2 미러링 — 선별분(매칭 축만) 을 bill_axis_mapping 에 넣고, 선별에서 빠진 ai_v2 행은 지운다.
// ⚠️ mapped_by='ai_v2' 행만 지운다 — 사람이 넣은 v2 행이 생기면 건드리지 않게
async function syncV2(pool) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const up = await client.query(`
            INSERT INTO bill_axis_mapping (bill_id, axis, agree_score, disagree_score, weight, mapping_version, mapped_by, notes)
            SELECT bill_id, axis, agree_score, disagree_score, weight, $1, 'ai_v2', confidence || ' · ' || COALESCE(reason, '')
              FROM bill_axis_mapping_pilot
             WHERE is_selected AND axis = ANY($2::text[])
            ON CONFLICT (bill_id, mapping_version) DO UPDATE SET
              axis = EXCLUDED.axis, agree_score = EXCLUDED.agree_score, disagree_score = EXCLUDED.disagree_score,
              weight = EXCLUDED.weight, notes = EXCLUDED.notes, updated_at = NOW()
             WHERE bill_axis_mapping.mapped_by = 'ai_v2'
               AND (bill_axis_mapping.axis, bill_axis_mapping.agree_score, bill_axis_mapping.weight)
                   IS DISTINCT FROM (EXCLUDED.axis, EXCLUDED.agree_score, EXCLUDED.weight)`,
            [POL_MAPPING_VERSION, MATCH_AXES]);
        const del = await client.query(`
            DELETE FROM bill_axis_mapping m
             WHERE m.mapping_version = $1 AND m.mapped_by = 'ai_v2'
               AND NOT EXISTS (SELECT 1 FROM bill_axis_mapping_pilot p
                                WHERE p.bill_id = m.bill_id AND p.is_selected AND p.axis = ANY($2::text[]))`,
            [POL_MAPPING_VERSION, MATCH_AXES]);
        const { rows: tot } = await client.query(
            `SELECT axis, agree_score, COUNT(*)::int n FROM bill_axis_mapping WHERE mapping_version = $1 GROUP BY 1,2 ORDER BY 1,2`, [POL_MAPPING_VERSION]);
        await client.query('COMMIT');
        return { upserted: up.rowCount, deleted: del.rowCount, totals: tot };
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
}

async function run() {
    const args = parseArgs(process.argv);
    const quota = Math.ceil(args.target / 8);
    logger.info(`[Axis Pilot START] target=${args.target} (셀당 ${quota}) maxCandidates=${args.maxCandidates} selectOnly=${args.selectOnly} syncV2=${args.syncV2} dryRun=${args.dryRun}`);
    if (!args.selectOnly && !process.env.ANTHROPIC_API_KEY) { logger.error('ANTHROPIC_API_KEY 없음'); process.exit(1); }

    const pool = new pg.Pool(dbConfig);
    const anthropic = args.selectOnly ? null : new Anthropic();
    const t0 = Date.now();
    let cost = 0, classified = 0, mapped = 0;
    try {
        await ensureTable(pool);
        if (args.reclassify && args.reclassify.length) {
            // ── 재분류: 기존 행을 현재 프롬프트로 다시 분류해 UPDATE. prompt_version 이 이미 현재값인 행은 건너뛴다 (재실행 안전)
            const { rows: [{ n: total }] } = await pool.query(
                `SELECT COUNT(*)::int n FROM bill_axis_mapping_pilot p WHERE p.axis = ANY($1::text[]) AND p.prompt_version <> $2`, [args.reclassify, PROMPT_VERSION]);
            logger.info(`재분류 대상 ${total}건 (${args.reclassify.join(',')}) · 프롬프트 ${PROMPT_VERSION}`);
            const moved = {};   // 이전 축 → 새 축 이동 집계
            let seen = 0;
            while (true) {
                const chunk = await fetchReclassify(pool, args.reclassify, 200, 0);   // UPDATE 로 prompt_version 이 바뀌므로 OFFSET 0 고정
                if (chunk.length === 0) break;
                const { rows: prev } = await pool.query(`SELECT bill_id, axis, agree_score FROM bill_axis_mapping_pilot WHERE bill_id = ANY($1::text[])`, [chunk.map(r => r.bill_id)]);
                const prevBy = new Map(prev.map(r => [r.bill_id, r]));
                const batches = []; for (let i = 0; i < chunk.length; i += BATCH) batches.push(chunk.slice(i, i + BATCH));
                for (let g = 0; g < batches.length; g += CONCURRENCY) {
                    const group = batches.slice(g, g + CONCURRENCY);
                    const outs = await Promise.all(group.map(rows => classify(anthropic, rows).then(o => ({ rows, ...o }))));
                    for (const { rows, results, usage } of outs) {
                        cost += (usage.in * PRICE_IN + usage.out * PRICE_OUT + usage.cw * PRICE_CW + usage.cr * PRICE_CR) / 1e6;
                        const byId = new Map(results.map(r => [r.bill_id, r]));
                        for (const r of rows) {
                            const x = byId.get(r.bill_id);
                            if (!x) { logger.warn(`  응답 누락 ${r.bill_id}`); continue; }
                            let axis = String(x.axis || 'none'); if (!AXES.includes(axis)) axis = 'none';
                            let ag = axis === 'none' ? null : (DIR_SIGN[axis][String(x.direction || '').trim()] ?? null);
                            if (axis !== 'none' && ag === null) axis = 'none';
                            const w = axis === 'none' ? null : (Number(x.weight) === 0.5 ? 0.5 : 1.0);
                            const conf = ['high', 'medium', 'low'].includes(x.confidence) ? x.confidence : 'low';
                            const p = prevBy.get(r.bill_id);
                            const key = `${p?.axis}${p?.agree_score > 0 ? '+' : p?.agree_score < 0 ? '−' : ''} → ${axis}${ag > 0 ? '+' : ag < 0 ? '−' : ''}`;
                            moved[key] = (moved[key] || 0) + 1;
                            classified++; if (axis !== 'none') mapped++;
                            if (args.dryRun) { logger.info(`  ${key.padEnd(28)} ${conf.padEnd(6)} ${String(x.reason || '').slice(0, 40)}  ← ${r.bill_name.slice(0, 40)}`); continue; }
                            await pool.query(`UPDATE bill_axis_mapping_pilot SET axis=$2, agree_score=$3, disagree_score=$4, weight=$5, confidence=$6, reason=$7,
                                                 prompt_version=$8, model=$9, is_selected = CASE WHEN $10 THEN FALSE ELSE is_selected END
                                               WHERE bill_id=$1`,
                                [r.bill_id, axis, ag, ag === null ? null : -ag, w, conf, String(x.reason || '').slice(0, 60), PROMPT_VERSION, MODEL, axis === 'none']);
                        }
                        if (args.dryRun) { logger.info(`[Dry run] 1배치만 호출. 비용 $${cost.toFixed(4)}`); return; }
                    }
                    await sleep(300);
                }
                seen += chunk.length;
                logger.info(`재분류 ${seen}/${total} · $${cost.toFixed(3)}`);
            }
            logger.info('--- 이동 집계 (이전 → 새) ---');
            Object.entries(moved).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => logger.info(`  ${k.padEnd(28)} ${n}`));
        } else if (!args.selectOnly) {
            let cells = await cellCounts(pool);
            logger.info(`시작 셀: ${fmtCells(cells)}`);
            const done = () => AXES.every(ax => cells[ax]['-1'] >= quota && cells[ax]['1'] >= quota);
            let seen = 0;
            while (!done() && seen < args.maxCandidates) {
                const chunk = await fetchCandidates(pool, Math.min(200, args.maxCandidates - seen));
                if (chunk.length === 0) { logger.warn('후보 소진'); break; }
                seen += chunk.length;
                const batches = []; for (let i = 0; i < chunk.length; i += BATCH) batches.push(chunk.slice(i, i + BATCH));
                for (let g = 0; g < batches.length; g += CONCURRENCY) {
                  const group = batches.slice(g, g + CONCURRENCY);
                  const outs = await Promise.all(group.map(rows => classify(anthropic, rows).then(o => ({ rows, ...o }))));
                  for (const { rows, results, usage } of outs) {
                    cost += (usage.in * PRICE_IN + usage.out * PRICE_OUT + usage.cw * PRICE_CW + usage.cr * PRICE_CR) / 1e6;
                    const byId = new Map(results.map(r => [r.bill_id, r]));
                    const vals = [];
                    for (const r of rows) {
                        const x = byId.get(r.bill_id);
                        if (!x) { logger.warn(`  응답 누락 ${r.bill_id}`); continue; }
                        let axis = String(x.axis || 'none'); if (!AXES.includes(axis)) axis = 'none';
                        let ag = axis === 'none' ? null : (DIR_SIGN[axis][String(x.direction || '').trim()] ?? null);
                        if (axis !== 'none' && ag === null) axis = 'none';   // 라벨이 축과 안 맞으면 버린다
                        const w = axis === 'none' ? null : (Number(x.weight) === 0.5 ? 0.5 : 1.0);
                        const conf = ['high', 'medium', 'low'].includes(x.confidence) ? x.confidence : 'low';
                        vals.push([r.bill_id, axis, ag, ag === null ? null : -ag, w, conf, String(x.reason || '').slice(0, 60)]);
                        classified++; if (axis !== 'none') mapped++;
                    }
                    if (args.dryRun) {
                        vals.forEach(v => logger.info(`  ${v[1].padEnd(11)} ${v[2] === null ? '  ' : (v[2] > 0 ? '+1' : '-1')} ${v[5].padEnd(6)} ${v[6]}  ← ${rows.find(r => r.bill_id === v[0]).bill_name.slice(0, 40)}`));
                        logger.info(`[Dry run] 1배치만 호출. 비용 $${cost.toFixed(4)}`); return;
                    }
                    if (vals.length) {
                        const ph = vals.map((_, k) => `($${k * 7 + 1},$${k * 7 + 2},$${k * 7 + 3},$${k * 7 + 4},$${k * 7 + 5},$${k * 7 + 6},$${k * 7 + 7},'${PROMPT_VERSION}','${MODEL}')`).join(',');
                        await pool.query(`INSERT INTO bill_axis_mapping_pilot
                            (bill_id, axis, agree_score, disagree_score, weight, confidence, reason, prompt_version, model)
                            VALUES ${ph} ON CONFLICT (bill_id) DO NOTHING`, vals.flat());
                    }
                  }
                  await sleep(300);
                }
                cells = await cellCounts(pool);
                logger.info(`후보 ${seen}건 · 분류 ${classified} · 매핑 ${mapped} · $${cost.toFixed(3)} | ${fmtCells(cells)}`);
            }
        }
        const sel = await select(pool, quota, args.dryRun);
        logger.info('--- 균형 선별 (셀당 quota, 축 안에서 두 방향을 같은 수로) ---');
        sel.forEach(s => logger.info(`  ${s.axis.padEnd(11)} 선별 ${String(s.total).padStart(3)}건 (방향당 ${s.per_dir}) · 가용 −1:${s.avail_neg} +1:${s.avail_pos}`));
        logger.info(`  합계 ${sel.reduce((a, s) => a + s.total, 0)}건`);
        if (args.syncV2 && !args.dryRun) {
            const r = await syncV2(pool);
            logger.info(`--- v2 미러링 (bill_axis_mapping · ${POL_MAPPING_VERSION}) --- 신규/변경 ${r.upserted}건 · 삭제 ${r.deleted}건`);
            r.totals.forEach(t => logger.info(`  ${t.axis.padEnd(11)} ${t.agree_score > 0 ? '+1' : '−1'} ${t.n}`));
            logger.info(`  → 좌표는 다음 크론(calcPoliticianAxis)에서 재계산된다. 지금 반영하려면: node batch/calcPoliticianAxis.js`);
        }
        const { rows: dist } = await pool.query(`SELECT axis, confidence, COUNT(*)::int n FROM bill_axis_mapping_pilot GROUP BY 1,2 ORDER BY 1,2`);
        logger.info('--- 분류 전체 분포 (axis × confidence) ---');
        dist.forEach(d => logger.info(`  ${d.axis.padEnd(11)} ${d.confidence.padEnd(6)} ${d.n}`));
    } catch (e) {
        logger.error(`[FATAL] ${e.message}\n${e.stack}`);
    } finally {
        await pool.end();
        logger.info(`[Axis Pilot END] 분류 ${classified} · 비용 $${cost.toFixed(3)} · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
    }
}
run();
