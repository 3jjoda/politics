// topicUpdate.js — Claude API 기반 법안 분류

import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';

const BATCH_SIZE = 50;

const CATEGORIES = [
    '보건/복지/의료', '교육/인재/학술', '노동/고용/자영업',
    '국토/도시/주택', '환경/기후/에너지', '농림축산/수산/해양',
    '조세/재정/금융', '산업/기술/R&D', '행정/공공/사법',
    '안보/국방/병무', '문화/체육/예술', '안전/재난/소방',
    '통일/외교/남북', '정치/선거/규제', '유통/소비자/공정',
    '기타',
];

const SYSTEM_PROMPT = `당신은 대한민국 국회 법안 분류 전문가입니다.
주어진 법안명을 아래 15개 카테고리 중 하나로 분류하세요. 어디에도 속하지 않으면 "기타"로 분류하세요.

카테고리: ${CATEGORIES.join(', ')}

분류 가이드라인:
- 동물보호: 반려동물이면 "보건/복지/의료", 축산 관련이면 "농림축산/수산/해양"
- 개인정보/정보통신: "산업/기술/R&D"
- 과거사/인권: "행정/공공/사법"
- 자동차 안전: "안전/재난/소방", 자동차 산업: "산업/기술/R&D"

응답 형식:
각 줄에 "번호|카테고리명"만 출력하세요. 설명 없이 결과만.
예시:
1|보건/복지/의료
2|교육/인재/학술
3|기타`;

// --- Claude API 호출 ---
async function classifyBatch(anthropic, bills) {
    const billList = bills
        .map((b, i) => `${i + 1}. ${b.bill_name}`)
        .join('\n');

    const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `다음 법안들을 분류해주세요:\n\n${billList}` }],
    });

    const text = response.content[0].text.trim();
    const results = new Map();

    for (const line of text.split('\n')) {
        const match = line.match(/^(\d+)\|(.+)$/);
        if (!match) continue;

        const idx = parseInt(match[1], 10) - 1;
        const category = match[2].trim();

        if (idx >= 0 && idx < bills.length && CATEGORIES.includes(category)) {
            results.set(idx, category);
        }
    }

    return results;
}

// --- 메인 ---
async function runTopicUpdate() {
    logger.info('[Topic Update START] Claude API 기반 법안 분류 시작');
    const pool = new pg.Pool(dbConfig);
    const anthropic = new Anthropic();
    const startTime = Date.now();

    try {
        // 1. codes 테이블에서 카테고리 → code_id 매핑
        const { rows: topicCodes } = await pool.query(
            `SELECT code_id, code_name FROM codes WHERE group_code = 'BILL_TOPIC'`
        );
        const codeMap = new Map(topicCodes.map(c => [c.code_name, c.code_id]));
        logger.info(`[준비] 카테고리 매핑 ${codeMap.size}개 로드`);

        // 2. 미분류 법안 조회 (bill_topic_cd IS NULL)
        const { rows: bills } = await pool.query(
            `SELECT bill_id, bill_name FROM bills WHERE bill_topic_cd IS NULL`
        );

        if (bills.length === 0) {
            logger.info('분류할 법안이 없습니다.');
            return;
        }
        logger.info(`[대상] ${bills.length}건 분류 예정 (${BATCH_SIZE}건씩 배치)`);

        // 3. 배치 처리
        let totalUpdated = 0;
        let totalEtc = 0;
        const etcBills = [];
        const categoryStats = new Map();

        for (let i = 0; i < bills.length; i += BATCH_SIZE) {
            const batch = bills.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(bills.length / BATCH_SIZE);

            try {
                const results = await classifyBatch(anthropic, batch);

                for (const [idx, category] of results) {
                    const bill = batch[idx];
                    const codeId = codeMap.get(category);

                    if (!codeId) {
                        logger.warn(`[매핑 없음] "${category}" → codes 테이블에 없음 (${bill.bill_name})`);
                        continue;
                    }

                    await pool.query(
                        `UPDATE bills SET bill_topic_cd = $1 WHERE bill_id = $2`,
                        [codeId, bill.bill_id]
                    );
                    totalUpdated++;

                    // 통계
                    categoryStats.set(category, (categoryStats.get(category) || 0) + 1);

                    if (category === '기타') {
                        totalEtc++;
                        etcBills.push(bill.bill_name);
                    }
                }

                // 응답에서 누락된 건 처리
                for (let j = 0; j < batch.length; j++) {
                    if (!results.has(j)) {
                        logger.warn(`[누락] 응답에서 빠짐: ${batch[j].bill_name}`);
                    }
                }

                logger.info(`[배치 ${batchNum}/${totalBatches}] ${results.size}/${batch.length}건 분류 완료`);

            } catch (error) {
                logger.error(`[배치 ${batchNum} 실패] ${error.message}`);
            }
        }

        // 4. 결과 로깅
        logger.info(`\n[Topic Update SUCCESS] 총 ${totalUpdated}/${bills.length}건 분류 완료`);

        logger.info('--- 카테고리별 분류 결과 ---');
        [...categoryStats.entries()]
            .sort((a, b) => b[1] - a[1])
            .forEach(([name, count]) => logger.info(`  ${name}: ${count}건`));

        if (etcBills.length > 0) {
            logger.warn(`\n--- "기타" 분류 법안 (${totalEtc}건) ---`);
            etcBills.forEach(name => logger.warn(`  - ${name}`));
        }

    } catch (error) {
        logger.error('[Topic Update FAILED]:', error);
    } finally {
        await pool.end();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`소요 시간: ${duration}초`);
        logger.info('[Topic Update END]');
    }
}

runTopicUpdate();
