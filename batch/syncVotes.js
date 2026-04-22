// syncVotes.js — 열린국회정보 API 기반 법안별 표결 동기화
// bills 테이블의 모든 bill_id를 순회하며 표결 정보를 수집하여 bill_votes에 bulk upsert

import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import xml2js from 'xml2js';
import pLimit from 'p-limit';

const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY;
const API_URL = 'https://open.assembly.go.kr/portal/openapi/nojepdqqaweusdfbi';
const ASSEMBLY_AGE = process.env.ASSEMBLY_AGE || '22';
const PAGE_SIZE = 100;
const BULK_SIZE = 1000;
const CONCURRENT_LIMIT = 10;

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

async function fetchAllVotesForBill(billId) {
    const first = await fetchVotePage(billId, 1);
    if (first.noData || first.totalCount === 0) return first.items;

    const totalPages = Math.ceil(first.totalCount / PAGE_SIZE);
    if (totalPages <= 1) return first.items;

    const allItems = [...first.items];
    for (let page = 2; page <= totalPages; page++) {
        try {
            const { items } = await fetchVotePage(billId, page);
            allItems.push(...items);
        } catch (error) {
            logger.error(`[수집] BILL_ID=${billId} ${page}페이지 실패: ${error.message}`);
        }
    }
    return allItems;
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
    logger.info(`[Vote Sync START] ${ASSEMBLY_AGE}대 국회 표결 동기화 시작`);
    const pool = new pg.Pool(dbConfig);
    const startTime = Date.now();

    try {
        // 1. bills 테이블에서 대상 bill_id 조회 (처리 완료된 법안만 — 계류 중 법안은 표결 없음)
        const { rows: bills } = await pool.query(`
            SELECT bill_id, bill_no
            FROM bills
            WHERE bill_id IS NOT NULL
              AND proc_result_name IS NOT NULL
            ORDER BY propose_dt DESC NULLS LAST
        `);

        const total = bills.length;
        if (total === 0) {
            logger.warn('[수집] bills 테이블에 대상 법안이 없습니다.');
            return;
        }
        logger.info(`[수집] 대상 법안 ${total}건 (동시 호출: ${CONCURRENT_LIMIT})`);

        // 2. 병렬 API 호출 및 표결 데이터 수집
        const limit = pLimit(CONCURRENT_LIMIT);
        const voteRows = [];
        let processed = 0;
        let billsWithVotes = 0;

        const tasks = bills.map((bill) => limit(async () => {
            try {
                const votes = await fetchAllVotesForBill(bill.bill_id);
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

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[Vote Sync SUCCESS] 완료 (${duration}초)`);
        logger.info(`- bill_votes: ${totalVotes}건 upsert`);

    } catch (error) {
        logger.error('[Vote Sync FAILED]:', error);
    } finally {
        await pool.end();
        logger.info('[Vote Sync END]');
    }
}

runVoteSync();
