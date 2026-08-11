// syncBillSummary.js — 법안 제안이유·주요내용 동기화
//
// 열린국회 API `BPMBILLSUMMARY` (법률안 제안이유 및 주요내용) 로
// 국회 공식 "제안이유 및 주요내용" 원문을 받아 bills.summary 에 저장한다.
//
// 왜 필요한가:
//   법안의 "내용"이 AI 분석(bill_ai_analysis)에만 있어서, 분석하지 않은
//   18,600여 건은 목록·상세에 보여줄 내용이 아예 없었다. 전체 법안의 87%가
//   동명("○○법 일부개정법률안")이라 카드가 서로 구분되지 않는 원인이기도 하다.
//   이 API 는 무료·무제한이고 전건 수집이 6분이라 안 받을 이유가 없다.
//
// AI 분석과 역할이 다르다:
//   summary(여기)             = 국회 원문 그대로(관 문체), 전건
//   bill_ai_analysis(AI 분석) = 쉬운 말 + 찬반 쟁점 + 판단 질문, 요청·가결 건만
//
// 증분:
//   본문은 발의 시점에 확정되고 이후 바뀌지 않으므로 summary_synced_at 이
//   NULL 인 건만 조회한다. 호출에 실패한 건은 마킹하지 않아 다음 실행에 재시도된다.
//   `--full` 로 전건 재수집 가능.

import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { startBatchRun, finishBatchRun } from '../utils/batchRun.js';
import { startWatchdog } from '../utils/watchdog.js';
import axios from 'axios';
import pLimit from 'p-limit';

const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY;
const API_URL = 'https://open.assembly.go.kr/portal/openapi/BPMBILLSUMMARY';
const CONCURRENT_LIMIT = 10;
const BULK_SIZE = 500;

// --full: summary_synced_at 을 무시하고 전건 재수집
const FULL_RESCAN = process.argv.includes('--full');

// --limit N: 대상 건수 제한 (부분 실행·테스트용)
const limitArgIdx = process.argv.indexOf('--limit');
const LIMIT = limitArgIdx > -1 ? parseInt(process.argv[limitArgIdx + 1], 10) : null;

// --- API 호출 ---
// 반환: { ok, summary }
//   ok=false  → 호출 실패. synced 마킹하지 않음 (다음 실행에서 재시도)
//   ok=true, summary=null → API 가 정상 응답했으나 데이터 없음. 마킹함 (매번 재시도하면 낭비)
async function fetchSummary(billNo) {
    const response = await axios.get(API_URL, {
        params: { KEY: API_KEY, Type: 'json', pIndex: 1, pSize: 1, BILL_NO: billNo },
        timeout: 15000,
    });

    const data = response.data;

    // 인자 오류 등은 최상위 RESULT 로 온다
    if (data?.RESULT) {
        // INFO-200 = 해당 데이터 없음 → 정상 응답으로 취급
        if (data.RESULT.CODE === 'INFO-200') return { ok: true, summary: null };
        logger.warn(`[API] BILL_NO=${billNo} ${data.RESULT.CODE}: ${data.RESULT.MESSAGE}`);
        return { ok: false, summary: null };
    }

    const body = data?.BPMBILLSUMMARY;
    if (!Array.isArray(body)) return { ok: false, summary: null };

    const code = body[0]?.head?.find((h) => h.RESULT)?.RESULT?.CODE;
    if (code && code !== 'INFO-000') {
        if (code === 'INFO-200') return { ok: true, summary: null };
        logger.warn(`[API] BILL_NO=${billNo} ${code}`);
        return { ok: false, summary: null };
    }

    const raw = body[1]?.row?.[0]?.SUMMARY;
    const summary = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    return { ok: true, summary };
}

// --- Bulk update ---
// bill_no 기준 UPDATE. UNNEST 로 한 번에 처리한다.
async function bulkUpdateSummaries(pool, rows) {
    if (rows.length === 0) return 0;
    const billNos = rows.map((r) => r[0]);
    const summaries = rows.map((r) => r[1]);
    const result = await pool.query(
        `UPDATE bills b
            SET summary           = s.summary,
                summary_synced_at = NOW()
           FROM (SELECT * FROM UNNEST($1::text[], $2::text[]) AS t(bill_no, summary)) s
          WHERE b.bill_no = s.bill_no
            AND (b.summary IS DISTINCT FROM s.summary OR b.summary_synced_at IS NULL)`,
        [billNos, summaries]
    );
    return result.rowCount;
}

// 빈 응답이었던 건도 조회 시각은 남긴다 — 안 그러면 매 실행마다 다시 호출한다
async function markSyncedOnly(pool, billNos) {
    if (billNos.length === 0) return 0;
    const result = await pool.query(
        `UPDATE bills SET summary_synced_at = NOW() WHERE bill_no = ANY($1)`,
        [billNos]
    );
    return result.rowCount;
}

// --- 메인 ---
async function runSummarySync() {
    logger.info(`[Summary Sync START] 법안 제안이유·주요내용 동기화 시작${FULL_RESCAN ? ' (전건 재수집)' : ''}`);
    const stopWatchdog = startWatchdog('syncBillSummary', 20);
    const pool = new pg.Pool(dbConfig);
    const startTime = Date.now();
    const runId = await startBatchRun(pool, 'syncBillSummary');

    try {
        // 1. 대상 조회
        //    본문은 발의 시점에 확정되므로 한 번 조회에 성공하면 다시 볼 이유가 없다.
        //    (표결과 달리 "나중에 값이 생기는" 필드가 아님)
        const targetSql = `
            SELECT bill_no FROM bills
             WHERE bill_no IS NOT NULL
               ${FULL_RESCAN ? '' : 'AND summary_synced_at IS NULL'}
             ORDER BY propose_dt DESC NULLS LAST
             ${LIMIT ? `LIMIT ${LIMIT}` : ''}`;

        const { rows: bills } = await pool.query(targetSql);
        const total = bills.length;

        if (total === 0) {
            logger.info('[수집] 미조회 법안이 없습니다. 조회 생략.');
            await finishBatchRun(pool, runId, {
                status: 'success',
                stats: { scanned: 0, updated: 0, skipped: true }
            });
            return;
        }
        logger.info(`[수집] 대상 법안 ${total}건 (동시 호출: ${CONCURRENT_LIMIT})`);

        // 2. 병렬 API 호출
        const limit = pLimit(CONCURRENT_LIMIT);
        const summaryRows = [];   // [bill_no, summary] — 본문 있음
        const emptyBillNos = [];  // 정상 응답 + 본문 없음 → 시각만 마킹
        let processed = 0;
        let failed = 0;

        const tasks = bills.map((bill) => limit(async () => {
            try {
                const { ok, summary } = await fetchSummary(bill.bill_no);
                if (!ok) failed++;                                  // 마킹 안 함 → 다음 실행 재시도
                else if (summary) summaryRows.push([bill.bill_no, summary]);
                else emptyBillNos.push(bill.bill_no);
            } catch (error) {
                failed++;
                logger.error(`[수집] BILL_NO=${bill.bill_no} 실패: ${error.message}`);
            } finally {
                processed++;
                if (processed % 2000 === 0 || processed === total) {
                    logger.info(`[수집 진행] ${processed}/${total}건 (본문 확보 ${summaryRows.length}, 빈응답 ${emptyBillNos.length}, 실패 ${failed})`);
                }
            }
        }));

        await Promise.all(tasks);
        logger.info(`[수집 완료] 본문 ${summaryRows.length}건 / 빈응답 ${emptyBillNos.length}건 / 실패 ${failed}건`);

        // 3. Bulk update
        let updated = 0;
        for (let i = 0; i < summaryRows.length; i += BULK_SIZE) {
            updated += await bulkUpdateSummaries(pool, summaryRows.slice(i, i + BULK_SIZE));
            if (i + BULK_SIZE < summaryRows.length && ((i / BULK_SIZE + 1) % 10 === 0)) {
                logger.info(`[저장] ${Math.min(i + BULK_SIZE, summaryRows.length)}/${summaryRows.length}건`);
            }
        }

        let markedEmpty = 0;
        for (let i = 0; i < emptyBillNos.length; i += BULK_SIZE) {
            markedEmpty += await markSyncedOnly(pool, emptyBillNos.slice(i, i + BULK_SIZE));
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[Summary Sync SUCCESS] 완료 (${duration}초)`);
        logger.info(`- bills.summary: ${updated}건 갱신 (빈응답 마킹 ${markedEmpty}건, 미마킹 ${failed}건은 다음 실행에서 재시도)`);

        await finishBatchRun(pool, runId, {
            status: 'success',
            stats: {
                fullRescan: FULL_RESCAN,
                scanned: total,
                updated,
                empty: markedEmpty,
                failed
            }
        });

    } catch (error) {
        logger.error('[Summary Sync FAILED]:', error);
        await finishBatchRun(pool, runId, { status: 'failed', error: error.message });
    } finally {
        await pool.end();
        stopWatchdog();
        logger.info('[Summary Sync END]');
    }
}

runSummarySync();
