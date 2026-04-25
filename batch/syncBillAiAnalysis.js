// syncBillAiAnalysis.js — Claude Haiku 4.5 기반 법안 AI 분석 배치 (v4 프롬프트)
//
// 흐름: bills 에서 미분석 대상 조회 → pal.assembly.go.kr 본문 fetch → Haiku 분석 → bill_ai_analysis UPSERT
//
// 사용:
//   node batch/syncBillAiAnalysis.js                 # 기본 limit=3 dry-run
//   node batch/syncBillAiAnalysis.js --limit 10      # 가결 법안 10건
//   node batch/syncBillAiAnalysis.js --bill-id PRC_X2Y...  # 특정 법안 1건
//
// Phase 1: proc_result_name IN ('원안가결','수정가결') 우선

import 'dotenv/config';
import pg from 'pg';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { CATEGORIES, CATEGORY_DEFINITIONS, CATEGORY_TIE_BREAKER } from './billCategories.js';

const MODEL = 'claude-haiku-4-5-20251001';
const PROMPT_VERSION = 'v4.1';

// Haiku 4.5 가격 (per MTok)
//   input          : $1.00
//   output         : $5.00
//   cache write    : $1.25 (=input × 1.25)
//   cache read     : $0.10 (=input × 0.10)
const PRICE_INPUT_PER_MTOK = 1.0;
const PRICE_OUTPUT_PER_MTOK = 5.0;
const PRICE_CACHE_WRITE_PER_MTOK = 1.25;
const PRICE_CACHE_READ_PER_MTOK = 0.10;

// 요청 간 대기 (rate limit 대비)
const REQUEST_INTERVAL_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- 인자 파싱 ---
function parseArgs(argv) {
    const args = { limit: 3, billIds: [] };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--limit') args.limit = parseInt(argv[++i], 10) || 3;
        else if (a === '--bill-id') args.billIds.push(argv[++i]);
    }
    return args;
}

// --- 본문 수집 ---
async function fetchBillContent(billId) {
    const url = `https://pal.assembly.go.kr/napal/lgsltpa/lgsltpaDone/view.do?lgsltPaId=${encodeURIComponent(billId)}`;
    const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; politics-barometer/1.0)' },
        timeout: 15000,
    });
    const $ = cheerio.load(res.data);
    const h4 = $('h4').filter((_, el) => $(el).text().trim() === '제안이유 및 주요내용').first();
    if (!h4.length) return null;

    // h4 의 부모 박스에서 h4 라벨 제거 후 텍스트만
    const box = h4.parent().clone();
    box.find('h4').remove();
    const text = box.text().replace(/\s+/g, ' ').trim();
    // 본문 첫 줄에 또 "제안이유 및 주요내용" 라벨이 들어있는 경우가 있어서 1회 제거
    return text.replace(/^제안이유\s*및\s*주요내용\s*/, '').trim();
}

// --- 프롬프트 (v4) ---
// 원칙: ANALYSIS.md §3 (가치판단 금지·쟁점 대칭성·발의자 인용 등) + UI_ANALYSIS.md 매핑
const SYSTEM_PROMPT = `당신은 대한민국 국회 법안을 분석하는 AI입니다. 정치 바로미터 서비스의 분석 엔진으로, 국민이 법안을 스스로 판단할 수 있도록 돕는 것이 목적입니다.

## 분석 원칙 (17항)
1. 발의자 주장과 사실을 구분한다. 제안이유는 "발의자 주장"으로 표시하고 객관 사실과 분리한다. 단정적 표현("~때문에", "~므로")은 "발의자에 따르면"으로 완화한다.
2. 반대 관점도 함께 제시한다. 법안 내용만 보지 말고 같은 주제의 기존 법·판례·학계 논쟁을 고려해 발의 목적 외 잠재적 영향·우려도 균형 있게 서술한다.
3. 정당·정파 언급 최소화. 발의자 소속 정당 언급 금지(메타 정보로 별도 노출됨). "여야"·"진보/보수"·"좌파/우파" 등 진영 프레임 사용 금지. 법안 내용 자체로만 분석한다.
4. 확정적 단정 대신 쟁점을 나열한다. "이 법은 민주주의를 강화한다"(X) → "지지자는 ~라고 보고, 반대 측은 ~를 우려한다"(O).
5. 검증 불가능한 사실 주장은 자제한다. 발의자가 주장하는 현황·통계는 "발의자는 ~라고 주장한다"로 처리하고, AI가 확인할 수 없는 정황은 limitations 에 명시한다.
6. 원본 법안 문언을 넘어서는 맥락 주입 금지. 발의자가 직접 언급하지 않은 과거 사건·인물·조직 연관은 issues 에 포함하지 말고 context 에서만 다룬다. 역사적 배경은 "과거 사례"로만 언급, 인과 판단 금지.
7. 쟁점 강도의 대칭성 유지. 한쪽을 "구조적 모순"으로 표현하면 다른 쪽도 동등 강도의 언어를 사용한다. 양쪽 모두 건조한 중립 언어 권장.
8. 쟁점은 실질적이어야 한다. "추가 검토가 필요하다"는 쟁점이 아니다. 쟁점은 의견이 갈리는 구체적 지점이며, 안전한 중간지대로 도망가지 말 것.
9. 프롬프트 범위 밖 제안 금지. "원하면 다른 분석도 가능합니다" 같은 메타 코멘트 금지. 고정 JSON 스키마만 출력하고 사족 금지.
10. 발의자 서술의 강도를 중화하지 말 것. "내란을 일으킨" → "문제 제기" 같은 약화 금지. "발의자는 '[원문 표현]'이라고 주장" 형식으로 귀속시켜 원본의 강한 표현을 그대로 전달한다. 양측 균형을 위해 한쪽 서술 강도를 임의 조정 금지.
11. 결론적 프레임 제시 금지. "이 법안의 본질은 X vs Y" 같은 단정 금지. 쟁점을 축으로 압축하는 건 유저의 일이며, 분석은 재료 제공만 한다.
12. 페르소나·AI 정체성 언급 금지. "AI로서", "Claude로서" 등 자기 언급 금지. 분석 결과 서두·말미에 메타 설명 금지.
13. 법안의 구조적 빈틈은 "쟁점"이다. 경과규정·부칙·시행령 누락은 limitations 가 아니라 issues type=gap 에 둔다. 법안 문언의 불명확성은 유저 판단 재료이므로 issues 에 배치한다. limitations 는 AI 역량 한계(사실 검증 불가 등)에 한정한다.
14. judgment_questions 표준화. 정답 없는 열린 질문 3개. 쟁점에서 추출한 관점 대비 구조. 유저가 자기 입장을 정리하도록 유도한다.
15. 출력 종료 규칙. JSON 오브젝트 외 어떠한 텍스트도 금지("이 분석은…", "안내:", "분석 방법론…" 등). 디스클레이머는 시스템 레벨에서 별도 처리한다.
16. issues 완결성 체크리스트. 다음 3가지가 모두 포함되어야 한다:
    a) type=pro: 찬성 근거 — 발의자 주장 원문 인용 포함
    b) type=con: 반대 우려 — 구체적 메커니즘 명시("검토 필요"·"논쟁 가능" 같은 추상 표현 금지). 인과 관계 설명 권장
    c) type=gap: 법안 문언의 구조적 빈틈 — 경과규정·부칙·시행령·조직 개편 계획 중 누락된 사항
17. 반대 쟁점(con) 서술 형식. "X의 경우 Y 가능성" 인과 구조 권장. "~를 충분히 갖추었는지", "~에 대한 논의 필요", "~인지 의문" 같은 회피 표현 금지. 구체적 조직·기능·체계에 연결된 우려를 서술한다.

## 금지사항
- 법안이 "좋다/나쁘다" 평가 금지
- 발의자를 칭찬하거나 비판하는 표현 금지
- "국민의 뜻", "시대정신" 같은 추상적 수사 금지
- 반대 측을 "저항세력", 찬성 측을 "개혁세력"처럼 프레이밍 금지

## 카테고리 16종 (category_main 으로 정확히 1개만 선택)
${CATEGORY_DEFINITIONS}

## 모호한 케이스 결정 가이드
${CATEGORY_TIE_BREAKER}

## 출력 형식 (반드시 단일 JSON 오브젝트, 다른 텍스트 금지)
{
  "summary": "법안이 바꾸려는 핵심을 30자 이내 한 줄. 어휘는 중립.",
  "category_main": "위 16개 카테고리 라벨 중 정확히 1개. 임의 표현 금지, 16개 외 카테고리 금지.",
  "category_sub": "구체적 분야를 자유 형식 10자 이내로 (예: '양자기술', '환경교육', '소상공인'). 특별히 좁힐 필요 없으면 null.",
  "reading_time_min": 본문 길이 기반 정수 1~5,
  "changes": {
    "current": "현행 제도/조문이 어떻게 되어 있는지 1~2문장",
    "revised": "개정안이 무엇을 바꾸려 하는지 1~2문장. 핵심 동사를 <strong>로 강조 가능",
    "clause": "제○조 같은 변경 조문. 알 수 없으면 짧게 '신설' 등"
  },
  "affected": {
    "benefit": "직접적 혜택을 받는 대상 (1줄)",
    "loss": "부담·기존 권한 축소 등 손해를 보는 대상 (1줄). 없으면 '직접적 손해 없음'",
    "direct": ["직접 영향 대상", "최대 4개"],
    "indirect": ["간접 영향 영역", "최대 3개"]
  },
  "issues": [
    {
      "type": "pro",
      "title": "찬성 측 논리의 핵심 문장 (제목 형태, 25자 이내)",
      "body": "발의자 주장의 근거 + 발의자가 진단한 현상. <strong>으로 핵심 표현 강조 가능. 2~4문장."
    },
    {
      "type": "con",
      "title": "반대/우려 측 핵심 문장 (제목 형태, 25자 이내)",
      "body": "구체적 메커니즘 명시. '검토 필요'·'논의 필요' 같은 회피 표현 금지. 인과 구조('X의 경우 Y 가능성') 권장. 2~4문장."
    },
    {
      "type": "gap",
      "title": "법안 문언의 구조적 빈틈 (제목 형태, 25자 이내)",
      "body": "경과규정·부칙·시행령·예산·조직 개편 중 누락된 사항. 2~4문장."
    }
  ],
  "context": [
    {
      "title": "관련 법·판례·정책 (15자 이내)",
      "body": "1~2문장 설명. 인과 판단 금지, 사실 진술만."
    }
  ],
  "limitations": [
    {
      "title": "AI 검증 한계 항목 (15자 이내)",
      "body": "AI가 확인할 수 없는 사실/통계/맥락. 1~2문장."
    }
  ],
  "judgment_questions": [
    {
      "question": "정답 없는 열린 질문. 쟁점에서 추출한 관점 대비 구조. 한 문장.",
      "hint": "이 질문이 가리키는 쟁점 축 (10자 이내)"
    }
  ]
}

## 추가 제약
- category_main 은 위 16개 라벨 중 하나를 글자 그대로 사용. 변형·축약·다른 라벨 금지.
- category_sub 는 10자 이내. 구체화할 필요 없으면 null. 임의로 끼워 맞추지 말 것.
- issues 는 정확히 3개 (pro / con / gap 각 1개). type 순서는 위와 동일.
- context, limitations 는 각각 2~3개.
- judgment_questions 는 정확히 3개.
- <strong> 외 다른 HTML 태그 금지.
- 출력은 위 JSON 한 개만. 코드 펜스(\`\`\`)·머리말·꼬리말 금지.`;

const buildUserMessage = (bill, content) => `[법안 메타]
- 법안번호: ${bill.bill_no}
- 법안명: ${bill.bill_name}
- 소관위원회: ${bill.committee || '미지정'}
- 대표발의: ${bill.proposer_name || '미상'}
- 발의일: ${bill.propose_dt || '미상'}
- 처리결과: ${bill.proc_result_name || '계류'}

[제안이유 및 주요내용]
${content}

위 법안을 시스템 프롬프트의 JSON 스키마에 맞춰 분석하세요. JSON 한 개만 출력하세요.`;

// --- Claude 호출 ---
// system 을 cache_control ephemeral 로 감싸 prompt caching 사용 (5분 TTL).
// 첫 요청은 cache write (input × 1.25), 이후는 cache read (input × 0.10).
async function analyzeBill(anthropic, bill, content) {
    const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: [
            {
                type: 'text',
                text: SYSTEM_PROMPT,
                cache_control: { type: 'ephemeral' },
            },
        ],
        messages: [{ role: 'user', content: buildUserMessage(bill, content) }],
    });

    const text = response.content[0].text.trim();
    // JSON 추출 — 코드 펜스 fallback
    let jsonStr = text;
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (fenceMatch) jsonStr = fenceMatch[1];

    let parsed;
    try {
        parsed = JSON.parse(jsonStr);
    } catch (err) {
        throw new Error(`JSON 파싱 실패: ${err.message}\n--- 응답 ---\n${text.substring(0, 500)}`);
    }

    return {
        analysis: parsed,
        usage: {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
            cacheCreate: response.usage.cache_creation_input_tokens || 0,
            cacheRead: response.usage.cache_read_input_tokens || 0,
        },
    };
}

const calcCost = (input, output, cacheCreate = 0, cacheRead = 0) =>
    (input * PRICE_INPUT_PER_MTOK
        + output * PRICE_OUTPUT_PER_MTOK
        + cacheCreate * PRICE_CACHE_WRITE_PER_MTOK
        + cacheRead * PRICE_CACHE_READ_PER_MTOK
    ) / 1_000_000;

// --- 후처리: 알려진 오타 치환 ---
const TYPO_MAP = {
    '첍': '첩',
    '감감': '감면',
    '따랅': '따릅',
};

function fixTypos(text) {
    if (typeof text !== 'string') return text;
    let fixed = text;
    for (const [typo, correct] of Object.entries(TYPO_MAP)) {
        fixed = fixed.replaceAll(typo, correct);
    }
    return fixed;
}

function postprocessAnalysis(obj) {
    if (typeof obj === 'string') return fixTypos(obj);
    if (Array.isArray(obj)) return obj.map(postprocessAnalysis);
    if (obj && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [k, postprocessAnalysis(v)])
        );
    }
    return obj;
}

// --- 검수 플래그 자동 판정 ---
// 사실 오류 위험이 높은 케이스에 needs_review=true 를 달아둠.
function shouldReview(analysis) {
    const text = JSON.stringify(analysis);
    const yearCount = (text.match(/\d{4}년/g) || []).length;
    const specificClaimCount = (text.match(/[가-힣]+(위원회|부\b|법\b|기관)/g) || []).length;
    const limitationsCount = (analysis.limitations || []).length;
    return yearCount >= 3 || specificClaimCount >= 5 || limitationsCount >= 3;
}

// --- 카테고리 검증 ---
// AI 가 16개 외 라벨을 뱉으면 가장 가까운 라벨을 찾을 방법이 없으므로 needs_review=true 강제.
function validateCategoryMain(value) {
    if (!value) return { value: null, valid: false };
    const v = String(value).trim();
    return { value: v, valid: CATEGORIES.includes(v) };
}

// --- DB 저장 ---
async function upsertAnalysis(pool, billId, analysis, usage, needsReview) {
    const cost = calcCost(usage.input, usage.output, usage.cacheCreate, usage.cacheRead);
    await pool.query(
        `INSERT INTO bill_ai_analysis
            (bill_id, summary, category_main, category_sub, reading_time_min,
             changes, affected, issues, context, limitations, judgment_questions,
             model, prompt_version, tokens_input, tokens_output, cost_usd,
             needs_review, analyzed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, NOW())
         ON CONFLICT (bill_id) DO UPDATE SET
            summary = EXCLUDED.summary,
            category_main = EXCLUDED.category_main,
            category_sub = EXCLUDED.category_sub,
            reading_time_min = EXCLUDED.reading_time_min,
            changes = EXCLUDED.changes,
            affected = EXCLUDED.affected,
            issues = EXCLUDED.issues,
            context = EXCLUDED.context,
            limitations = EXCLUDED.limitations,
            judgment_questions = EXCLUDED.judgment_questions,
            model = EXCLUDED.model,
            prompt_version = EXCLUDED.prompt_version,
            tokens_input = EXCLUDED.tokens_input,
            tokens_output = EXCLUDED.tokens_output,
            cost_usd = EXCLUDED.cost_usd,
            needs_review = EXCLUDED.needs_review,
            analyzed_at = NOW()`,
        [
            billId,
            analysis.summary || '',
            analysis.category_main || null,
            analysis.category_sub || null,
            Number(analysis.reading_time_min) || 2,
            JSON.stringify(analysis.changes || {}),
            JSON.stringify(analysis.affected || {}),
            JSON.stringify(analysis.issues || []),
            JSON.stringify(analysis.context || []),
            JSON.stringify(analysis.limitations || []),
            JSON.stringify(analysis.judgment_questions || []),
            MODEL,
            PROMPT_VERSION,
            usage.input,
            usage.output,
            cost,
            needsReview,
        ]
    );
    return cost;
}

// --- 대상 조회 ---
async function fetchTargets(pool, args) {
    if (args.billIds.length > 0) {
        const { rows } = await pool.query(
            `SELECT bill_id, bill_no, bill_name, committee, proposer_name,
                    TO_CHAR(propose_dt, 'YYYY-MM-DD') AS propose_dt, proc_result_name
               FROM bills
              WHERE bill_id = ANY($1::text[])`,
            [args.billIds]
        );
        return rows;
    }

    // Phase 1: 가결 법안 우선, 미분석만
    const { rows } = await pool.query(
        `SELECT b.bill_id, b.bill_no, b.bill_name, b.committee, b.proposer_name,
                TO_CHAR(b.propose_dt, 'YYYY-MM-DD') AS propose_dt, b.proc_result_name
           FROM bills b
      LEFT JOIN bill_ai_analysis a ON a.bill_id = b.bill_id
          WHERE a.bill_id IS NULL
            AND b.proc_result_name IN ('원안가결', '수정가결')
            AND b.bill_name IS NOT NULL
          ORDER BY b.propose_dt DESC
          LIMIT $1`,
        [args.limit]
    );
    return rows;
}

// --- 메인 ---
async function run() {
    const args = parseArgs(process.argv);
    logger.info(`[Bill AI Analysis START] limit=${args.limit} billIds=${JSON.stringify(args.billIds)} model=${MODEL}`);

    if (!process.env.ANTHROPIC_API_KEY) {
        logger.error('ANTHROPIC_API_KEY 환경변수가 없습니다.');
        process.exit(1);
    }

    const pool = new pg.Pool(dbConfig);
    const anthropic = new Anthropic();
    const startTime = Date.now();

    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheWrite = 0;
    let totalCacheRead = 0;
    let totalCost = 0;
    let success = 0;
    let failed = 0;
    let reviewFlagged = 0;

    try {
        const targets = await fetchTargets(pool, args);
        if (targets.length === 0) {
            logger.info('분석 대상 없음.');
            return;
        }
        logger.info(`[대상] ${targets.length}건`);

        for (let i = 0; i < targets.length; i++) {
            const bill = targets[i];
            const tag = `[${i + 1}/${targets.length}] ${bill.bill_no} ${String(bill.bill_name).substring(0, 30)}`;
            try {
                logger.info(`${tag} → 본문 수집 중`);
                const content = await fetchBillContent(bill.bill_id);
                if (!content || content.length < 50) {
                    logger.warn(`${tag} 본문 없음/너무 짧음 (len=${content ? content.length : 0}) — 스킵`);
                    failed++;
                    continue;
                }
                logger.info(`${tag} 본문 ${content.length}자 → Claude 분석 중`);

                const { analysis, usage } = await analyzeBill(anthropic, bill, content);
                const cleaned = postprocessAnalysis(analysis);

                // 카테고리 검증 — 16개 외 라벨이면 needs_review 강제 + 경고 로그
                const catCheck = validateCategoryMain(cleaned.category_main);
                if (!catCheck.valid) {
                    logger.warn(`${tag} ⚠ category_main 이상값="${catCheck.value}" — needs_review 처리`);
                }

                const needsReview = shouldReview(cleaned) || !catCheck.valid;
                const cost = await upsertAnalysis(pool, bill.bill_id, cleaned, usage, needsReview);

                totalInput += usage.input;
                totalOutput += usage.output;
                totalCacheWrite += usage.cacheCreate;
                totalCacheRead += usage.cacheRead;
                totalCost += cost;
                success++;
                if (needsReview) reviewFlagged++;

                const catLabel = cleaned.category_main + (cleaned.category_sub ? `·${cleaned.category_sub}` : '');
                logger.info(
                    `${tag} ✓ ${catLabel} | in=${usage.input} out=${usage.output} `
                    + `cache_w=${usage.cacheCreate} cache_r=${usage.cacheRead} `
                    + `review=${needsReview ? 'Y' : 'N'} cost=$${cost.toFixed(6)}`
                );
            } catch (err) {
                // 429 rate limit — retry-after 만큼 대기 후 같은 항목 재시도
                if (err.status === 429) {
                    const retryAfter = parseInt(err.headers?.['retry-after'], 10) || 60;
                    logger.warn(`${tag} 429 rate limit — ${retryAfter}초 대기 후 재시도`);
                    await sleep(retryAfter * 1000);
                    i--;
                    continue;
                }
                logger.error(`${tag} 실패: ${err.message}`);
                failed++;
            }

            // 마지막 아이템이 아니면 요청 간 sleep
            if (i < targets.length - 1) {
                await sleep(REQUEST_INTERVAL_MS);
            }
        }
    } catch (err) {
        logger.error(`[FATAL] ${err.message}\n${err.stack}`);
    } finally {
        await pool.end();
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const cacheReadRatio = (totalCacheRead + totalInput) > 0
            ? (totalCacheRead / (totalCacheRead + totalInput) * 100).toFixed(1)
            : '0.0';
        logger.info('--- 결과 요약 ---');
        logger.info(`처리: 성공 ${success}건 / 실패 ${failed}건 / 검수필요 ${reviewFlagged}건`);
        logger.info(`토큰: input ${totalInput.toLocaleString()} / output ${totalOutput.toLocaleString()} `
            + `/ cache_w ${totalCacheWrite.toLocaleString()} / cache_r ${totalCacheRead.toLocaleString()} `
            + `(캐시 히트율 ${cacheReadRatio}%)`);
        logger.info(`비용: $${totalCost.toFixed(6)} (1건당 평균 $${success ? (totalCost / success).toFixed(6) : '0'})`);
        logger.info(`소요: ${duration}초`);
        logger.info('[Bill AI Analysis END]');
    }
}

run();
