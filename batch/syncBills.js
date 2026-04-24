// syncBills.js — 열린국회정보 API 기반 법안 동기화 (직접 upsert + bulk insert)

import cron from 'node-cron';
import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import xml2js from 'xml2js';

const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY;
const API_URL = 'https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn';
const PAGE_SIZE = 100;
const BULK_SIZE = 1000;

// --- 유틸리티 ---
function formatDate(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    if (s.length === 8) return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    if (s.includes('-')) return s;
    return null;
}

/**
 * bulk INSERT용 VALUES 절 + 파라미터 배열 생성
 * rows: 2D 배열, colCount: 컬럼 수
 */
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
async function fetchBillPage(pIndex, age) {
    const response = await axios.get(API_URL, {
        params: { KEY: API_KEY, Type: 'xml', pIndex, pSize: PAGE_SIZE, AGE: age },
        timeout: 15000,
    });

    const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false });
    const root = parsed.nzmimeepazxkubdpn;
    if (!root) return { items: [], totalCount: 0 };

    const heads = Array.isArray(root.head) ? root.head : [root.head];
    let totalCount = 0;

    for (const h of heads) {
        if (h.list_total_count) totalCount = parseInt(h.list_total_count, 10);
        if (h.RESULT && h.RESULT.CODE !== 'INFO-000') {
            if (h.RESULT.CODE === 'INFO-200') return { items: [], totalCount: 0 };
            logger.warn(`[API] ${h.RESULT.CODE}: ${h.RESULT.MESSAGE}`);
            return { items: [], totalCount: 0 };
        }
    }

    if (!root.row) return { items: [], totalCount };
    const items = Array.isArray(root.row) ? root.row : [root.row];
    return { items, totalCount };
}

async function fetchAllBills(age) {
    logger.info(`[수집] ${age}대 국회 법안 전체 조회 시작`);

    const { items: firstItems, totalCount } = await fetchBillPage(1, age);
    if (totalCount === 0) {
        logger.warn('[수집] API 반환 법안 0건');
        return [];
    }

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    logger.info(`[수집] 총 ${totalCount}건, ${totalPages}페이지`);

    const allItems = [...firstItems];

    for (let page = 2; page <= totalPages; page++) {
        try {
            const { items } = await fetchBillPage(page, age);
            allItems.push(...items);
            if (page % 20 === 0 || page === totalPages) {
                logger.info(`[수집] ${page}/${totalPages} 페이지 (${allItems.length}건)`);
            }
        } catch (error) {
            logger.error(`[수집] ${page}페이지 실패: ${error.message}`);
        }
    }

    logger.info(`[수집 완료] 총 ${allItems.length}건`);
    return allItems;
}

// --- Bulk Upsert ---
const BILL_COLUMNS = '(bill_id, bill_no, bill_name, propose_dt, proc_result_name, age_cd, link_url, mona_cd, proposer_name, committee, committee_id, co_proposer_count)';
const BILL_COL_COUNT = 12;

const CO_PROPOSER_COLUMNS = '(bill_id, bill_no, mona_cd, proposer_yn)';
const CO_PROPOSER_COL_COUNT = 4;

async function bulkUpsertBills(pool, rows) {
    if (rows.length === 0) return 0;
    const { clause, params } = buildBulkValues(rows, BILL_COL_COUNT);
    try {
        const result = await pool.query(
            `INSERT INTO bills ${BILL_COLUMNS} VALUES ${clause}
             ON CONFLICT (bill_id) DO UPDATE SET
                bill_name = EXCLUDED.bill_name,
                proc_result_name = EXCLUDED.proc_result_name,
                committee = EXCLUDED.committee,
                committee_id = EXCLUDED.committee_id,
                updated_at = NOW()`,
            params
        );
        return result.rowCount;
    } catch (error) {
        // bulk 실패 시 개별 INSERT로 fallback하여 문제 행 특정
        logger.error(`[bills bulk 실패] ${error.message} — 개별 INSERT로 문제 행을 찾습니다.`);
        let count = 0;
        for (const row of rows) {
            try {
                await pool.query(
                    `INSERT INTO bills ${BILL_COLUMNS} VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                     ON CONFLICT (bill_id) DO UPDATE SET
                        bill_name = EXCLUDED.bill_name,
                        proc_result_name = EXCLUDED.proc_result_name,
                        committee = EXCLUDED.committee,
                        committee_id = EXCLUDED.committee_id,
                        updated_at = NOW()`,
                    row
                );
                count++;
            } catch (rowErr) {
                logger.error(`[bills 행 오류] ${rowErr.message}`);
                logger.error(`  → bill_id=${row[0]}, bill_no=${row[1]}, bill_name=${String(row[2]).substring(0, 50)}`);
                logger.error(`  → 컬럼별 길이: ${row.map((v, i) => `[${i}]${v === null ? 'NULL' : String(v).length}`).join(', ')}`);
            }
        }
        return count;
    }
}

async function bulkUpsertCoProposers(pool, rows) {
    if (rows.length === 0) return 0;
    const { clause, params } = buildBulkValues(rows, CO_PROPOSER_COL_COUNT);
    try {
        const result = await pool.query(
            `INSERT INTO bill_co_proposers ${CO_PROPOSER_COLUMNS} VALUES ${clause}
             ON CONFLICT DO NOTHING`,
            params
        );
        return result.rowCount;
    } catch (error) {
        logger.error(`[co_proposers bulk 실패] ${error.message} — 개별 INSERT로 문제 행을 찾습니다.`);
        let count = 0;
        for (const row of rows) {
            try {
                await pool.query(
                    `INSERT INTO bill_co_proposers ${CO_PROPOSER_COLUMNS} VALUES ($1,$2,$3,$4)
                     ON CONFLICT DO NOTHING`,
                    row
                );
                count++;
            } catch (rowErr) {
                logger.error(`[co_proposers 행 오류] ${rowErr.message}`);
                logger.error(`  → bill_id=${row[0]}, bill_no=${row[1]}, mona_cd=${row[2]}, proposer_yn=${row[3]}`);
                logger.error(`  → 컬럼별 길이: ${row.map((v, i) => `[${i}]${v === null ? 'NULL' : String(v).length}`).join(', ')}`);
            }
        }
        return count;
    }
}

// --- 메인 ---
async function runBillSync(assemblyAge) {
    if (!assemblyAge) { logger.error('국회 대수(assemblyAge)가 지정되지 않았습니다.'); return; }
    logger.info(`[Bill Sync START] ${assemblyAge}대 국회 법안 동기화 시작`);

    const pool = new pg.Pool(dbConfig);
    const startTime = Date.now();

    try {
        // 1. API에서 전체 법안 수집
        const allBills = await fetchAllBills(assemblyAge);
        if (allBills.length === 0) return;

        // 2. 데이터 변환 — bills 행 + co_proposers 행 준비
        const billRows = [];
        const coProposerRows = [];

        const splitCsv = (raw) => raw
            ? String(raw).split(',').map(s => s.trim()).filter(Boolean)
            : [];

        for (const bill of allBills) {
            const billId = bill.BILL_ID;
            const billNo = bill.BILL_NO;
            // 대표발의자 — API가 공동대표 케이스에서 쉼표로 여러 값을 반환
            const rstMonaList    = splitCsv(bill.RST_MONA_CD);
            const rstProposerRaw = bill.RST_PROPOSER || '';
            const firstRstMonaCd = rstMonaList[0] || null;
            // bills.proposer_name 은 단일 컬럼 — 첫 이름만 저장 (목록·검색 호환)
            const firstRstProposer = rstProposerRaw
                ? String(rstProposerRaw).split(',')[0].trim()
                : null;
            // 공동발의자
            const coProposerList = splitCsv(bill.PUBL_MONA_CD);

            billRows.push([
                billId, billNo, bill.BILL_NAME,
                formatDate(bill.PROPOSE_DT),
                bill.PROC_RESULT || null,
                bill.AGE || assemblyAge,
                bill.DETAIL_LINK || null,
                firstRstMonaCd,
                firstRstProposer,
                bill.COMMITTEE || null,
                bill.COMMITTEE_ID || null,
                coProposerList.length,
            ]);

            // 대표발의자 — 공동대표 모두 proposer_yn=1
            for (const monaCd of rstMonaList) {
                coProposerRows.push([billId, billNo, monaCd, 1]);
            }
            // 공동발의자
            for (const monaCd of coProposerList) {
                coProposerRows.push([billId, billNo, monaCd, 0]);
            }
        }

        logger.info(`[저장] bills ${billRows.length}건, co_proposers ${coProposerRows.length}건 upsert 시작`);

        // 3. Bulk upsert — 1000건씩 청크
        let totalBills = 0;
        for (let i = 0; i < billRows.length; i += BULK_SIZE) {
            const chunk = billRows.slice(i, i + BULK_SIZE);
            totalBills += await bulkUpsertBills(pool, chunk);
            if (i + BULK_SIZE < billRows.length) {
                logger.info(`[bills] ${Math.min(i + BULK_SIZE, billRows.length)}/${billRows.length}건`);
            }
        }

        let totalCo = 0;
        for (let i = 0; i < coProposerRows.length; i += BULK_SIZE) {
            const chunk = coProposerRows.slice(i, i + BULK_SIZE);
            totalCo += await bulkUpsertCoProposers(pool, chunk);
            if (i + BULK_SIZE < coProposerRows.length && (i / BULK_SIZE + 1) % 10 === 0) {
                logger.info(`[co_proposers] ${Math.min(i + BULK_SIZE, coProposerRows.length)}/${coProposerRows.length}건`);
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[Bill Sync SUCCESS] 완료 (${duration}초)`);
        logger.info(`- bills: ${totalBills}건, co_proposers: ${totalCo}건`);

    } catch (error) {
        logger.error('[Bill Sync FAILED]:', error);
    } finally {
        await pool.end();
        logger.info('[Bill Sync END]');
    }
}

// --- 실행 ---
const ASSEMBLY_AGE = process.env.ASSEMBLY_AGE || '22';

// cron.schedule('30 23 * * *', () => { runBillSync(ASSEMBLY_AGE); });
// logger.info('법안 동기화 배치 설정 완료 (매일 23:30)');
runBillSync(ASSEMBLY_AGE);
