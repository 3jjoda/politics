// C:\dev\politics\jobs\syncBills.js (Weekday Fast Version)

import cron from 'node-cron';
import mysql from 'mysql2/promise';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { format } from 'date-fns';
import WebScraper from '../utils/webScraper.js';
import pLimit from 'p-limit';

const CONCURRENT_POLITICIAN_LIMIT = 5;
const ROWS_PER_PAGE = 100;
const API_CALL_DELAY_MS = 200;

const BILL_KIND = {
    LAW: { ID: 1, NAME: '법률안' },
    ETC: { ID: 2, NAME: '기타의안' },
};

// --- 유틸리티 및 API 호출 함수 (검증 완료) ---
function getPoliticianDetailPageUrl(monaCd, age) { return `https://www.assembly.go.kr/portal/assm/assmPrpl/prplMst.do?monaCd=${monaCd}&st=${age}&viewType=CONTBODY`; }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function extractBillIdFromUrl(url) { const match = url.match(/billId=([^&]+)/); return match ? match[1] : null; }
function parseProposerInfo(proposerText) { if (!proposerText) return { proposerName: null, coProposerCount: 0, names: [] }; const nameMatch = proposerText.match(/^([^등]+?)(?:의원|$)/); const coProposerCountMatch = proposerText.match(/등 (\d+)인/); const proposerName = nameMatch ? nameMatch[1].trim() + '의원' : proposerText.split('등')[0].trim(); const coProposerCount = coProposerCountMatch ? parseInt(coProposerCountMatch[1]) : 0; const names = proposerName.split('ㆍ').map(n => n.trim()); return { proposerName, coProposerCount, names }; }

// --- 임시 테이블 저장 함수 (검증 완료) ---
async function saveToTempBill(connection, bill, proposerMonaCd, billKindId) { const { proposerName, coProposerCount } = parseProposerInfo(bill.proposer); const sql = `INSERT INTO temp_bills (bill_id, bill_no, bill_name, bill_kind_cd, age_cd, age_name, proposer_kind_cd, proposer_name, mona_cd, co_proposer_count, propose_dt, committee, committee_id, proc_result_cd, proc_result_name, link_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE bill_id = VALUES(bill_id)`; const values = [bill.billId, bill.billNo, bill.billName, billKindId, bill.age, bill.ageNm, bill.proposerKindCd, proposerName, proposerMonaCd, coProposerCount, bill.proposeDt, bill.currCommittee, bill.currCommitteeId, bill.procResultCd, bill.procResultNm, bill.billLinkUrl]; await connection.execute(sql, values); }
async function saveToTempCoProposer(connection, billId, billNo, monaCd, isRepresentative) { const sql = `INSERT INTO temp_bill_co_proposers (bill_id, bill_no, mona_cd, proposer_yn) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE bill_id=bill_id`; await connection.execute(sql, [billId, billNo, monaCd, isRepresentative ? 1 : 0]); }
async function saveToTempVote(connection, billId, billNo, monaCd, voteResult, voteDate) { const sql = `INSERT INTO temp_bill_votes (bill_id, bill_no, mona_cd, vote_result, vote_date) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE bill_id=bill_id`; const formattedDate = voteDate ? format(new Date(voteDate), 'yyyy-MM-dd') : null; await connection.execute(sql, [billId, billNo, monaCd, voteResult, formattedDate]); }

/**
 * [핵심 수집 로직] 모든 페이지를 스크레이핑하는 범용 함수
 */
async function fetchAllScrapedPages(monaCd, scraper, endpoint, baseParams) {
    const allItems = []; let pageIndex = 1; let totalPages = 1;
    do {
        const refererUrl = getPoliticianDetailPageUrl(monaCd, '22');
        const currentParams = { ...baseParams, pageIndex };
        const response = await scraper.postData(endpoint, currentParams, refererUrl);
        if (!response?.resultList?.length) break;
        allItems.push(...response.resultList);
        totalPages = response.paginationInfo.totalPageCount;
        if (pageIndex >= totalPages) break;
        pageIndex++; await sleep(API_CALL_DELAY_MS);
    } while (true);
    return allItems;
}

/**
 * [1단계 작업] 한 명의 의원에 대한 모든 데이터를 수집하여 임시 테이블에 저장합니다.
 */
async function collectAndStageData(politician, assemblyAge, pool, politicianNameToMonaCdMap, globalBillStatusMap, existingCounts) {
    const { mona_cd: monaCd, name: politicianName } = politician;
    const scraper = new WebScraper();
    const connection = await pool.getConnection();
    const collectedCounts = { bills: 0, coProposers: 0, votes: 0 };
    try {
        await connection.query("SET NAMES 'utf8mb4'");
        await scraper.initialize(getPoliticianDetailPageUrl(monaCd, assemblyAge));

        const commonBillParams = { monaCd, age: '', rowPerPage: 100, billName: '', procResultCd: '', pageLink: 'doActionRepBill.goPage' };
        const billSources = [
            { kind: BILL_KIND.LAW, type: 'law_rep', endpoint: 'findRepPrpsBill.json', params: { ...commonBillParams, represent: BILL_KIND.LAW.NAME } },
            { kind: BILL_KIND.LAW, type: 'law_co', endpoint: 'findCollaPrpsBill.json', params: { ...commonBillParams, represent: BILL_KIND.LAW.NAME } },
            { kind: BILL_KIND.ETC, type: 'etc_rep', endpoint: 'findRepPrpsEtcBill.json', params: { ...commonBillParams } },
            { kind: BILL_KIND.ETC, type: 'etc_co', endpoint: 'findCollaPrpsEtcBill.json', params: { ...commonBillParams } },
        ];

        // 법안 및 공동발의자 수집
        for (const source of billSources) {
            const firstPageResponse = await scraper.postData(source.endpoint, { ...source.params, pageIndex: 1 }, getPoliticianDetailPageUrl(monaCd, assemblyAge));
            const apiTotalCount = firstPageResponse?.paginationInfo?.totalRecordCount || 0;
            const dbTotalCount = existingCounts[source.type].get(monaCd) || 0;

            if (apiTotalCount === dbTotalCount) {
                logger.info(`[${politicianName}] ${source.kind.NAME}(${source.type.includes('rep') ? '대표' : '공동'}): 변동 없음 (${apiTotalCount}건). 스킵합니다.`);
            } else {
                logger.warn(`[${politicianName}] ${source.kind.NAME}(${source.type.includes('rep') ? '대표' : '공동'}): 변동 감지 (DB: ${dbTotalCount} -> API: ${apiTotalCount}). 전체 스캔 시작.`);
                const allItems = await fetchAllScrapedPages(monaCd, scraper, source.endpoint, source.params);
                for (const bill of allItems) {
                    const isRep = source.type.includes('rep');
                    if (!globalBillStatusMap.has(bill.billId) || globalBillStatusMap.get(bill.billId) !== bill.procResultCd) {
                        const repMonaCd = isRep ? monaCd : (politicianNameToMonaCdMap.get(parseProposerInfo(bill.proposer).names[0]?.replace(/의원$/, '')) || null);
                        await saveToTempBill(connection, bill, repMonaCd, source.kind.ID);
                        collectedCounts.bills++;
                        globalBillStatusMap.set(bill.billId, bill.procResultCd);
                    }
                    await saveToTempCoProposer(connection, bill.billId, bill.billNo, monaCd, isRep);
                    if (!isRep) collectedCounts.coProposers++;
                }
            }
        }
        
        const voteParams = { monaCd, pageLink: 'doActionVote.goPage', age: '', procResultCd: '', bgVoteendDt: '', edVoteendDt: '', resultVoteMod: '', billName: '', rowPerPage: 100 };
        const firstVotePage = await scraper.postData('findAssmVoteResult.json', { ...voteParams, pageIndex: 1 }, getPoliticianDetailPageUrl(monaCd, assemblyAge));
        const apiVoteCount = firstVotePage?.paginationInfo?.totalRecordCount || 0;
        const dbVoteCount = existingCounts.votes.get(monaCd) || 0;

        if (apiVoteCount === dbVoteCount) {
            logger.info(`[${politicianName}] 표결: 변동 없음 (${apiVoteCount}건). 스킵합니다.`);
        } else {
            logger.warn(`[${politicianName}] 표결: 변동 감지 (DB: ${dbVoteCount} -> API: ${apiVoteCount}). 전체 스캔 시작.`);
            const votes = await fetchAllScrapedPages(monaCd, scraper, 'findAssmVoteResult.json', voteParams);
            for (const vote of votes) {
                const billId = extractBillIdFromUrl(vote.billUrl);
                if(billId && vote.billNo) {
                    await saveToTempVote(connection, billId, vote.billNo, monaCd, vote.resultVoteMod, vote.voteendDt);
                    collectedCounts.votes++;
                }
            }
        }

    } catch (error) {
        logger.error(`[수집 단계][${politicianName}] 처리 중 오류 발생:`, error);
    } finally {
        if(connection) connection.release();
    }
    return collectedCounts;
}

/**
 * 메인 실행 함수
 */
async function runBillSync(assemblyAge, limitCount = 0) {
    if (!assemblyAge) { logger.error('Error: 국회 대수(assemblyAge)가 지정되지 않았습니다.'); return; }
    logger.info(`[Bill Sync Batch START] ${assemblyAge}대 국회 법안 데이터 동기화를 시작합니다.`);
    
    const pool = mysql.createPool(dbConfig);
    const startTime = Date.now();

    try {
        let [politicians] = await pool.execute('SELECT mona_cd, name FROM politicians WHERE active_yn = TRUE');
        if (limitCount > 0) {
            logger.warn(`[테스트 모드] ${limitCount}명만 데이터를 수집합니다.`);
            politicians = politicians.slice(0, limitCount);
        }
        const totalPoliticians = politicians.length;
        if (totalPoliticians === 0) { logger.warn('DB에서 처리할 현역 의원 정보를 찾을 수 없습니다.'); return; }
        
        const politicianNameToMonaCdMap = new Map(politicians.map(p => [p.name, p.mona_cd]));
        
        logger.info('[준비] DB의 현재 데이터 상태를 로드합니다...');
        const [allBillsInDb] = await pool.execute('SELECT bill_id, proc_result_cd FROM bills');
        const globalBillStatusMap = new Map(allBillsInDb.map(b => [b.bill_id, b.proc_result_cd]));
        
        // [핵심 수정] 각 데이터 유형별 총 건수를 DB에서 미리 조회
        const [lawRepCounts] = await pool.execute(`SELECT p.mona_cd, count(b.bill_id) as count FROM politicians p LEFT JOIN bills b ON p.mona_cd = b.mona_cd WHERE b.bill_kind_cd = ${BILL_KIND.LAW.ID} GROUP BY p.mona_cd`);
        const [lawCoCounts] = await pool.execute(`SELECT bcp.mona_cd, count(bcp.bill_id) as count FROM bill_co_proposers bcp JOIN bills b ON bcp.bill_id = b.bill_id WHERE bcp.proposer_yn = 0 AND b.bill_kind_cd = ${BILL_KIND.LAW.ID} GROUP BY bcp.mona_cd`);
        const [etcRepCounts] = await pool.execute(`SELECT p.mona_cd, count(b.bill_id) as count FROM politicians p LEFT JOIN bills b ON p.mona_cd = b.mona_cd WHERE b.bill_kind_cd = ${BILL_KIND.ETC.ID} GROUP BY p.mona_cd`);
        const [etcCoCounts] = await pool.execute(`SELECT bcp.mona_cd, count(bcp.bill_id) as count FROM bill_co_proposers bcp JOIN bills b ON bcp.bill_id = b.bill_id WHERE bcp.proposer_yn = 0 AND b.bill_kind_cd = ${BILL_KIND.ETC.ID} GROUP BY bcp.mona_cd`);
        const [voteCounts] = await pool.execute('SELECT mona_cd, COUNT(*) as count FROM bill_votes GROUP BY mona_cd');

        const existingCounts = {
            law_rep: new Map(lawRepCounts.map(i => [i.mona_cd, i.count])),
            law_co: new Map(lawCoCounts.map(i => [i.mona_cd, i.count])),
            etc_rep: new Map(etcRepCounts.map(i => [i.mona_cd, i.count])),
            etc_co: new Map(etcCoCounts.map(i => [i.mona_cd, i.count])),
            votes: new Map(voteCounts.map(i => [i.mona_cd, i.count])),
        };
        logger.info('[준비] 데이터 로드 완료.');

        logger.info('[준비] 임시 테이블을 비웁니다...');
        await pool.execute('TRUNCATE TABLE temp_bills');
        await pool.execute('TRUNCATE TABLE temp_bill_co_proposers');
        await pool.execute('TRUNCATE TABLE temp_bill_votes');

        logger.info(`--- [1단계 시작] ${totalPoliticians}명의 의원 정보를 병렬로 수집합니다...`);
        const limit = pLimit(CONCURRENT_POLITICIAN_LIMIT);
        
        const collectionPromises = politicians.map(politician => limit(async () => {
            await sleep(Math.random() * 1000);
            const collectedCounts = await collectAndStageData(politician, assemblyAge, pool, politicianNameToMonaCdMap, globalBillStatusMap, existingCounts);
            logger.info(`[수집 진행] ${politician.name}: 법안 ${collectedCounts.bills}, 공동발의 ${collectedCounts.coProposers}, 표결 ${collectedCounts.votes} 건 임시 저장`);
        }));
        await Promise.all(collectionPromises);
        logger.info('--- [1단계 완료] 모든 데이터 수집 완료. ---');

        logger.info('--- [2단계 시작] 임시 테이블의 데이터를 업무 테이블로 이전합니다... ---');
        // ... (2단계 데이터 이전 로직은 이전 최종 버전과 동일)

    } catch (error) {
        logger.error(`[Bill Sync Batch FAILED] 심각한 오류 발생:`, error);
    } finally {
        await pool.end();
        logger.info(`[Bill Sync Batch END] 배치가 종료되었습니다.`);
    }
}

// ... (실행 로직은 이전 최종 버전과 동일)