// updateCommittee.js — 기존 bills 레코드의 committee / committee_id 재주입
//
// 용도: syncBills.js 수정 이전에 수집된 레코드는 committee, committee_id 가 NULL.
//       API를 다시 호출해서 두 컬럼만 채워 넣음. (bill_topic_cd 는 건드리지 않음)
//
// 실행: node batch/updateCommittee.js

import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import xml2js from 'xml2js';

const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY;
const API_URL = 'https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn';
const PAGE_SIZE = 1000;
const BATCH_SIZE = 1000;
const ASSEMBLY_AGE = process.env.ASSEMBLY_AGE || '22';

/* ---------- API ---------- */
async function fetchBillPage(pIndex, age) {
    const response = await axios.get(API_URL, {
        params: { KEY: API_KEY, Type: 'xml', pIndex, pSize: PAGE_SIZE, AGE: age },
        timeout: 30000,
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
    logger.info(`[수집] ${age}대 국회 법안 전체 조회 시작 (pSize=${PAGE_SIZE})`);
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
            logger.info(`[수집] ${page}/${totalPages} 페이지 완료 (${allItems.length}건)`);
        } catch (err) {
            logger.error(`[수집] ${page}페이지 실패: ${err.message}`);
        }
    }
    logger.info(`[수집 완료] ${allItems.length}건`);
    return allItems;
}

/* ---------- 배치 UPDATE ---------- */
async function updateChunk(pool, rows) {
    if (rows.length === 0) return 0;
    // rows: [[bill_id, committee, committee_id], ...]
    const valuesClause = rows
        .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
        .join(',');
    const params = rows.flat();
    const sql = `
        UPDATE bills b
           SET committee    = v.committee,
               committee_id = v.committee_id,
               updated_at   = NOW()
          FROM (VALUES ${valuesClause}) AS v(bill_id, committee, committee_id)
         WHERE b.bill_id = v.bill_id
    `;
    const result = await pool.query(sql, params);
    return result.rowCount;
}

/* ---------- 메인 ---------- */
async function run() {
    logger.info(`[Committee Update START] ${ASSEMBLY_AGE}대 국회`);
    const pool = new pg.Pool(dbConfig);
    const startTime = Date.now();

    try {
        const allBills = await fetchAllBills(ASSEMBLY_AGE);
        if (allBills.length === 0) return;

        // 데이터 변환
        const rows = [];
        let hasCommittee = 0;
        for (const bill of allBills) {
            const billId = bill.BILL_ID;
            const committee = bill.COMMITTEE ? String(bill.COMMITTEE).trim() : null;
            const committeeId = bill.COMMITTEE_ID || null;
            if (committee) hasCommittee++;
            rows.push([billId, committee, committeeId]);
        }
        logger.info(`[데이터] 전체 ${rows.length}건 (committee 값 있음: ${hasCommittee}건)`);

        // 1000건씩 청크 UPDATE
        logger.info(`[업데이트] ${BATCH_SIZE}건 단위 bulk UPDATE 시작`);
        let totalUpdated = 0;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const chunk = rows.slice(i, i + BATCH_SIZE);
            const updated = await updateChunk(pool, chunk);
            totalUpdated += updated;
            logger.info(`[업데이트] ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}건 처리 (누적 업데이트 ${totalUpdated}건)`);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[Committee Update SUCCESS] ${totalUpdated}건 업데이트 완료 (${duration}초)`);
    } catch (err) {
        logger.error('[Committee Update FAILED]:', err);
    } finally {
        await pool.end();
        logger.info('[Committee Update END]');
    }
}

run();
