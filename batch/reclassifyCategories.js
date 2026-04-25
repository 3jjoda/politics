// reclassifyCategories.js — 기존 bill_ai_analysis 행의 자유형식 category 를
// v4.1 의 category_main(16종 고정) + category_sub(자유 형식)로 일괄 재분류한다.
//
// - 한 번의 Haiku 호출로 N건 일괄 처리 (input 절감)
// - 입력: 각 법안의 bill_name + 기존 summary + 기존 category
// - 출력: { bill_id: { category_main, category_sub | null } }
// - DB: UPDATE bill_ai_analysis SET category_main, category_sub, prompt_version='v4.1'
//
// 사용:
//   node batch/reclassifyCategories.js              # category_main IS NULL 인 행 전부
//   node batch/reclassifyCategories.js --all        # v4.1 행도 강제 재분류
//   node batch/reclassifyCategories.js --dry-run    # DB 쓰지 않고 결과만 출력

import 'dotenv/config';
import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { CATEGORIES, CATEGORY_DEFINITIONS, CATEGORY_TIE_BREAKER } from './billCategories.js';

const MODEL = 'claude-haiku-4-5-20251001';
const PROMPT_VERSION = 'v4.1';

const PRICE_INPUT_PER_MTOK  = 1.0;
const PRICE_OUTPUT_PER_MTOK = 5.0;

function parseArgs(argv) {
    const args = { all: false, dryRun: false };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--all')     args.all     = true;
        if (argv[i] === '--dry-run') args.dryRun = true;
    }
    return args;
}

const SYSTEM_PROMPT = `당신은 한국 국회 법안을 16개 카테고리 중 정확히 1개로 분류하는 분류기입니다.

## 카테고리 16종 (정의)
${CATEGORY_DEFINITIONS}

## 모호한 케이스 결정 가이드
${CATEGORY_TIE_BREAKER}

## 작업
입력으로 여러 법안의 메타가 줄단위로 주어집니다. 각 법안에 대해:
- category_main: 위 16개 라벨 중 정확히 1개. 임의 표현 금지.
- category_sub: 구체적 분야 자유 형식 10자 이내 (예: "양자기술", "환경교육", "소상공인"). 좁힐 필요 없으면 null.

## 출력 형식 (JSON 객체 1개, 다른 텍스트 금지)
{
  "results": [
    {"bill_id": "<원본 ID 그대로>", "category_main": "<라벨>", "category_sub": "<10자 이내 또는 null>"},
    ...
  ]
}

코드 펜스 금지. 머리말·꼬리말 금지. results 의 순서는 입력 순서와 동일하게 유지.`;

const buildUserMessage = (rows) => {
    const lines = rows.map((r, i) => {
        const oldCat = r.category ? ` | 이전 카테고리: ${r.category}` : '';
        return `${i + 1}. bill_id=${r.bill_id}\n   법안명: ${r.bill_name}\n   요약: ${r.summary}${oldCat}`;
    });
    return `다음 ${rows.length}건의 법안을 분류하세요. 각각 입력 순서를 유지해 results 배열로 출력합니다.\n\n${lines.join('\n\n')}`;
};

async function classifyBatch(anthropic, rows) {
    const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: [
            { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }
        ],
        messages: [{ role: 'user', content: buildUserMessage(rows) }]
    });

    const text = response.content[0].text.trim();
    let jsonStr = text;
    const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (fence) jsonStr = fence[1];

    let parsed;
    try {
        parsed = JSON.parse(jsonStr);
    } catch (e) {
        throw new Error(`JSON 파싱 실패: ${e.message}\n--- 응답 ---\n${text.substring(0, 600)}`);
    }
    if (!parsed.results || !Array.isArray(parsed.results)) {
        throw new Error(`results 배열 없음: ${JSON.stringify(parsed).substring(0, 200)}`);
    }
    return {
        results: parsed.results,
        usage: {
            input:       response.usage.input_tokens,
            output:      response.usage.output_tokens,
            cacheCreate: response.usage.cache_creation_input_tokens || 0,
            cacheRead:   response.usage.cache_read_input_tokens || 0
        }
    };
}

async function fetchTargets(pool, all) {
    const where = all
        ? `WHERE TRUE`
        : `WHERE category_main IS NULL`;
    const { rows } = await pool.query(`
        SELECT bill_id, summary, category
          FROM bill_ai_analysis
          ${where}
        ORDER BY analyzed_at DESC
    `);
    if (rows.length === 0) return [];
    // bills 와 조인해서 bill_name 가져오기
    const ids = rows.map(r => r.bill_id);
    const { rows: bills } = await pool.query(
        `SELECT bill_id, bill_name FROM bills WHERE bill_id = ANY($1::text[])`,
        [ids]
    );
    const nameMap = new Map(bills.map(b => [b.bill_id, b.bill_name]));
    return rows.map(r => ({
        ...r,
        bill_name: nameMap.get(r.bill_id) || '(법안명 없음)'
    }));
}

async function run() {
    const args = parseArgs(process.argv);
    logger.info(`[Reclassify START] all=${args.all} dryRun=${args.dryRun} model=${MODEL}`);

    if (!process.env.ANTHROPIC_API_KEY) {
        logger.error('ANTHROPIC_API_KEY 환경변수 없음');
        process.exit(1);
    }

    const pool = new pg.Pool(dbConfig);
    const anthropic = new Anthropic();
    const startTime = Date.now();

    try {
        const targets = await fetchTargets(pool, args.all);
        if (targets.length === 0) {
            logger.info('재분류 대상 없음. 종료.');
            return;
        }
        logger.info(`[대상] ${targets.length}건`);

        const { results, usage } = await classifyBatch(anthropic, targets);
        const cost = (usage.input * PRICE_INPUT_PER_MTOK + usage.output * PRICE_OUTPUT_PER_MTOK) / 1_000_000;

        // 결과 매핑 — bill_id 로 lookup
        const resultMap = new Map(results.map(r => [r.bill_id, r]));

        let valid = 0;
        let invalid = 0;
        const updates = [];

        for (const target of targets) {
            const r = resultMap.get(target.bill_id);
            if (!r) {
                logger.warn(`  ⚠ ${target.bill_id} → 응답 누락`);
                invalid++;
                continue;
            }
            const main = String(r.category_main || '').trim();
            const sub  = r.category_sub ? String(r.category_sub).trim() : null;
            const isValidMain = CATEGORIES.includes(main);
            if (!isValidMain) {
                logger.warn(`  ⚠ ${target.bill_id} → category_main="${main}" 16종 외, 강제로 needs_review`);
                invalid++;
            } else {
                valid++;
            }
            updates.push({ bill_id: target.bill_id, main, sub, isValidMain, oldCategory: target.category });
        }

        // 출력
        logger.info('--- 분류 결과 ---');
        updates.forEach(u => {
            const label = u.main + (u.sub ? `·${u.sub}` : '');
            const flag = u.isValidMain ? '✓' : '⚠';
            logger.info(`  ${flag} ${u.bill_id} : ${u.oldCategory || '(없음)'} → ${label}`);
        });

        if (args.dryRun) {
            logger.info('[Dry run] DB 쓰기 생략');
        } else {
            // UPDATE — 한 건씩 (12건 정도라 트랜잭션 + 개별 update 로 충분)
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const u of updates) {
                    await client.query(
                        `UPDATE bill_ai_analysis
                            SET category_main = $1,
                                category_sub  = $2,
                                prompt_version = $3,
                                needs_review = needs_review OR $4,
                                updated_at = NOW()
                          WHERE bill_id = $5`,
                        [
                            u.isValidMain ? u.main : null,
                            u.isValidMain ? u.sub : null,
                            PROMPT_VERSION,
                            !u.isValidMain,
                            u.bill_id
                        ]
                    );
                }
                await client.query('COMMIT');
                logger.info(`[DB] ${updates.length}건 UPDATE 완료`);
            } catch (e) {
                await client.query('ROLLBACK');
                throw e;
            } finally {
                client.release();
            }
        }

        // 요약
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.info('--- 결과 요약 ---');
        logger.info(`처리: 정상 ${valid}건 / 이상 ${invalid}건 (총 ${targets.length}건)`);
        logger.info(`토큰: input ${usage.input.toLocaleString()} / output ${usage.output.toLocaleString()} `
            + `/ cache_w ${usage.cacheCreate} / cache_r ${usage.cacheRead}`);
        logger.info(`비용: $${cost.toFixed(6)} (1건당 평균 $${(cost / targets.length).toFixed(6)})`);
        logger.info(`소요: ${duration}초`);
    } catch (err) {
        logger.error(`[FATAL] ${err.message}\n${err.stack}`);
    } finally {
        await pool.end();
        logger.info('[Reclassify END]');
    }
}

run();
