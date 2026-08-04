// syncVotes.js — 열린국회정보 API 기반 법안별 표결 동기화
// bills 테이블의 모든 bill_id를 순회하며 표결 정보를 수집하여 bill_votes에 bulk upsert

import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { startBatchRun, finishBatchRun } from '../utils/batchRun.js';
import { startWatchdog } from '../utils/watchdog.js';
import axios from 'axios';
import xml2js from 'xml2js';
import pLimit from 'p-limit';

const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY;
const API_URL = 'https://open.assembly.go.kr/portal/openapi/nojepdqqaweusdfbi';
const ASSEMBLY_AGE = process.env.ASSEMBLY_AGE || '22';
const PAGE_SIZE = 100;
const BULK_SIZE = 1000;
const CONCURRENT_LIMIT = 10;

// --full: vote_synced_at 을 무시하고 전건 재스캔 (주 1회 정합성 확인용)
const FULL_RESCAN = process.argv.includes('--full');

// --- 유틸리티 ---
function formatDate(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    if (!s) return null;
    if (s.length === 8) return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    if (s.includes('-')) return s.substring(0, 10);
    return null;
}

function buildBulkValues(rows, colCount) {
    const params = [];
    const valueClauses = rows.map((row, i) => {
        const placeholders = row.map((_, j) => `$${i * colCount + j + 1}`);
        params.push(...row);
        return `(${placeholders.join(',')})`;
    });
    return { clause: valueClauses.join(','), params };
}

// --- API 호출 ---
async function fetchVotePage(billId, pIndex) {
    const response = await axios.get(API_URL, {
        params: {
            KEY: API_KEY,
            Type: 'xml',
            pIndex,
            pSize: PAGE_SIZE,
            BILL_ID: billId,
            AGE: ASSEMBLY_AGE,
        },
        timeout: 15000,
    });

    const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
    const root = parsed.nojepdqqaweusdfbi;
    if (!root) return { items: [], totalCount: 0, noData: true };

    const heads = Array.isArray(root.head) ? root.head : [root.head];
    let totalCount = 0;

    for (const h of heads) {
        if (h && h.list_total_count) totalCount = parseInt(h.list_total_count, 10);
        if (h && h.RESULT && h.RESULT.CODE !== 'INFO-000') {
            if (h.RESULT.CODE === 'INFO-200') return { items: [], totalCount: 0, noData: true };
            logger.warn(`[API] BILL_ID=${billId} ${h.RESULT.CODE}: ${h.RESULT.MESSAGE}`);
            return { items: [], totalCount: 0, noData: true };
        }
    }

    if (!root.row) return { items: [], totalCount, noData: false };
    const items = Array.isArray(root.row) ? root.row : [root.row];
    return { items, totalCount, noData: false };
}

// { items, complete } 를 반환한다. complete=false 면 일부 페이지를 못 받은 것이므로
// 호출부에서 vote_synced_at 을 찍지 않아 다음 실행에 자동 재시도된다.
// (표결 1건은 보통 3페이지 — 페이지 하나가 빠지면 의원 100명의 표결이 통째로 누락된다)
async function fetchAllVotesForBill(billId) {
    const first = await fetchVotePage(billId, 1);
    if (first.noData || first.totalCount === 0) return { items: first.items, complete: true };

    const totalPages = Math.ceil(first.totalCount / PAGE_SIZE);
    if (totalPages <= 1) return { items: first.items, complete: true };

    const allItems = [...first.items];
    let complete = true;
    for (let page = 2; page <= totalPages; page++) {
        try {
            const { items } = await fetchVotePage(billId, page);
            allItems.push(...items);
        } catch (error) {
            complete = false;
            logger.error(`[수집] BILL_ID=${billId} ${page}페이지 실패: ${error.message}`);
        }
    }
    return { items: allItems, complete };
}

// --- Bulk Upsert ---
const VOTE_COLUMNS = '(bill_id, bill_no, mona_cd, vote_result, vote_date)';
const VOTE_COL_COUNT = 5;

async function bulkUpsertVotes(pool, rows) {
    if (rows.length === 0) return 0;
    const { clause, params } = buildBulkValues(rows, VOTE_COL_COUNT);
    try {
        const result = await pool.query(
            `INSERT INTO bill_votes ${VOTE_COLUMNS} VALUES ${clause}
             ON CONFLICT (bill_id, mona_cd, vote_date) DO UPDATE SET
                vote_result = EXCLUDED.vote_result,
                bill_no = EXCLUDED.bill_no`,
            params
        );
        return result.rowCount;
    } catch (error) {
        logger.error(`[votes bulk 실패] ${error.message} — 개별 INSERT로 문제 행을 찾습니다.`);
        let count = 0;
        for (const row of rows) {
            try {
                await pool.query(
                    `INSERT INTO bill_votes ${VOTE_COLUMNS} VALUES ($1,$2,$3,$4,$5)
                     ON CONFLICT (bill_id, mona_cd, vote_date) DO UPDATE SET
                        vote_result = EXCLUDED.vote_result,
                        bill_no = EXCLUDED.bill_no`,
                    row
                );
                count++;
            } catch (rowErr) {
                logger.error(`[votes 행 오류] ${rowErr.message}`);
                logger.error(`  → bill_id=${row[0]}, bill_no=${row[1]}, mona_cd=${row[2]}, vote_result=${row[3]}, vote_date=${row[4]}`);
            }
        }
        return count;
    }
}

// --- 메인 ---
async function runVoteSync() {
    logger.info(`[Vote Sync START] ${ASSEMBLY_AGE}대 국회 표결 동기화 시작${FULL_RESCAN ? ' (전건 재스캔)' : ''}`);
    const stopWatchdog = startWatchdog('syncVotes', 20); // --full 전건 재스캔 고려해 조금 넉넉히
    const pool = new pg.Pool(dbConfig);
    const startTime = Date.now();
    const runId = await startBatchRun(pool, 'syncVotes');

    try {
        // 1. bills 테이블에서 대상 bill_id 조회 (처리 완료된 법안만 — 계류 중 법안은 표결 없음)
        //
        // 증분 조건 (--full 이 아닐 때):
        //   · vote_synced_at IS NULL          → 아직 한 번도 표결을 조회하지 않은 법안
        //   · updated_at > vote_synced_at     → 조회 이후 법안 상태가 바뀜 (본회의 표결 발생 가능)
        //
        // 본회의 표결은 확정되면 바뀌지 않고, 표결이 나면 proc_result_name 이 갱신되며
        // syncBills 가 updated_at 을 밀어준다(변경 가드 덕분에 실제 변경 시에만).
        // 따라서 위 두 경우 외에는 재조회할 이유가 없다.
        //
        // 이 조건이 없으면 처리완료 법안 전건(현재 4,541)을 매일 호출하는데
        // 그중 표결이 있는 건 598건뿐 — 호출의 87%가 빈 응답이었다.
        const targetSql = FULL_RESCAN
            ? `SELECT bill_id, bill_no FROM bills
                WHERE bill_id IS NOT NULL AND proc_result_name IS NOT NULL
                ORDER BY propose_dt DESC NULLS LAST`
            : `SELECT bill_id, bill_no FROM bills
                WHERE bill_id IS NOT NULL AND proc_result_name IS NOT NULL
                  AND (vote_synced_at IS NULL OR updated_at > vote_synced_at)
                ORDER BY propose_dt DESC NULLS LAST`;

        const { rows: bills } = await pool.query(targetSql);

        const total = bills.length;
        if (total === 0) {
            logger.info('[수집] 신규·변경된 처리완료 법안이 없습니다. 조회 생략.');
            await finishBatchRun(pool, runId, {
                status: 'success',
                stats: { scanned: 0, billsWithVotes: 0, votesUpserted: 0, skipped: true }
            });
            return;
        }
        logger.info(`[수집] 대상 법안 ${total}건 (동시 호출: ${CONCURRENT_LIMIT})`);

        // 2. 병렬 API 호출 및 표결 데이터 수집
        const limit = pLimit(CONCURRENT_LIMIT);
        const voteRows = [];
        const syncedBillIds = [];   // 전체 페이지를 온전히 받은 법안만 vote_synced_at 갱신 대상
        let processed = 0;
        let billsWithVotes = 0;
        let incomplete = 0;         // 페이지 일부 누락 — 마킹 보류하고 다음 실행에 재시도

        const tasks = bills.map((bill) => limit(async () => {
            try {
                const { items: votes, complete } = await fetchAllVotesForBill(bill.bill_id);
                // 페이지 일부가 빠졌으면 스캔 완료로 찍지 않는다 → 다음 실행에서 재시도
                if (complete) syncedBillIds.push(bill.bill_id);
                else incomplete++;
                if (votes.length > 0) {
                    billsWithVotes++;
                    for (const v of votes) {
                        const monaCd = v.MONA_CD;
                        const voteResult = v.RESULT_VOTE_MOD;
                        const voteDate = formatDate(v.VOTE_DATE);
                        if (!monaCd || !voteResult || !voteDate) continue;
                        voteRows.push([
                            bill.bill_id,
                            v.BILL_NO || bill.bill_no,
                            monaCd,
                            voteResult,
                            voteDate,
                        ]);
                    }
                }
            } catch (error) {
                logger.error(`[수집] BILL_ID=${bill.bill_id} 실패: ${error.message}`);
            } finally {
                processed++;
                if (processed % 500 === 0 || processed === total) {
                    logger.info(`[수집 진행] ${processed}/${total}건 (표결 있는 법안: ${billsWithVotes}, 누적 행: ${voteRows.length})`);
                }
            }
        }));

        await Promise.all(tasks);

        logger.info(`[수집 완료] 표결 ${voteRows.length}건 / ${billsWithVotes}개 법안`);

        // 3. 1000건씩 Bulk upsert
        let totalVotes = 0;
        for (let i = 0; i < voteRows.length; i += BULK_SIZE) {
            const chunk = voteRows.slice(i, i + BULK_SIZE);
            totalVotes += await bulkUpsertVotes(pool, chunk);
            if (i + BULK_SIZE < voteRows.length && ((i / BULK_SIZE + 1) % 10 === 0)) {
                logger.info(`[votes] ${Math.min(i + BULK_SIZE, voteRows.length)}/${voteRows.length}건`);
            }
        }

        // 4. 조회 성공한 법안에 스캔 시각 기록 — 다음 실행의 증분 기준
        //    API 호출이 실패한 법안은 제외되므로 다음 실행에서 자동 재시도된다.
        let marked = 0;
        for (let i = 0; i < syncedBillIds.length; i += BULK_SIZE) {
            const chunk = syncedBillIds.slice(i, i + BULK_SIZE);
            const res = await pool.query(
                `UPDATE bills SET vote_synced_at = NOW() WHERE bill_id = ANY($1)`,
                [chunk]
            );
            marked += res.rowCount;
        }
        logger.info(`[스캔 기록] vote_synced_at 갱신 ${marked}건 (미마킹 ${total - syncedBillIds.length}건 = 호출 실패 + 페이지 누락 ${incomplete}건, 다음 실행에서 재시도)`);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[Vote Sync SUCCESS] 완료 (${duration}초)`);
        logger.info(`- bill_votes: ${totalVotes}건 upsert`);

        await finishBatchRun(pool, runId, {
            status: 'success',
            stats: {
                fullRescan: FULL_RESCAN,
                scanned: total,
                failed: total - syncedBillIds.length - incomplete,
                incomplete,
                billsWithVotes,
                votesUpserted: totalVotes
            }
        });

    } catch (error) {
        logger.error('[Vote Sync FAILED]:', error);
        await finishBatchRun(pool, runId, { status: 'failed', error: error.message });
    } finally {
        await pool.end();
        stopWatchdog();
        logger.info('[Vote Sync END]');
    }
}

runVoteSync();
