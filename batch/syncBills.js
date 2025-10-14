// C:\dev\politics\jobs\syncBills.js (Final Optimized Version with All Skip Logics)

import cron from 'node-cron';
import mysql from 'mysql2/promise';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { format } from 'date-fns';
import WebScraper from '../utils/webScraper.js';
import pLimit from 'p-limit';

const CONCURRENT_POLITICIAN_LIMIT = 5; // 안정성을 위해 5로 조정
const ROWS_PER_PAGE = 100;
const API_CALL_DELAY_MS = 150;

// --- 유틸리티 및 API 호출 함수 ---
function getPoliticianDetailPageUrl(monaCd, age) { return `https://www.assembly.go.kr/portal/assm/assmPrpl/prplMst.do?monaCd=${monaCd}&st=${age}&viewType=CONTBODY&tabId=repbill`; }
async function callAssemblyApiWithScraper(endpoint, params, refererUrl, scraperInstance) { return scraperInstance.postData(endpoint, params, refererUrl); }
async function fetchRepresentativeBills(monaCd, pageIndex, rowPerPage, age, refererUrl, scraperInstance) { return callAssemblyApiWithScraper('findRepPrpsBill.json', { monaCd, age, pageIndex, rowPerPage, pageLink: 'doActionRepBill.goPage', represent: '법률안', procResultCd: '', billName: '' }, refererUrl, scraperInstance); }
async function fetchCoProposerBills(monaCd, pageIndex, rowPerPage, age, refererUrl, scraperInstance) { return callAssemblyApiWithScraper('findCollaPrpsBill.json', { monaCd, age, pageIndex, rowPerPage, pageLink: 'doActionRepBill.goPage', represent: '법률안', procResultCd: '', billName: '' }, refererUrl, scraperInstance); }
async function fetchVoteResults(monaCd, pageIndex, rowPerPage, age, refererUrl, scraperInstance) { return callAssemblyApiWithScraper('findAssmVoteResult.json', { monaCd, age, pageIndex, rowPerPage, pageLink: 'doActionAssmVoteResult.goPage' }, refererUrl, scraperInstance); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function extractBillIdFromUrl(url) { const match = url.match(/billId=([^&]+)/); return match ? match[1] : null; }
function parseProposerInfo(proposerText) { if (!proposerText) return { proposerName: null, coProposerCount: 0, names: [] }; const nameMatch = proposerText.match(/^([^등]+?)(?:의원|$)/); const coProposerCountMatch = proposerText.match(/등 (\d+)인/); const proposerName = nameMatch ? nameMatch[1].trim() + '의원' : proposerText.split('등')[0].trim(); const coProposerCount = coProposerCountMatch ? parseInt(coProposerCountMatch[1]) : 0; const names = proposerName.split('ㆍ').map(n => n.trim()); return { proposerName, coProposerCount, names }; }

// --- 임시 테이블 저장 전용 함수 ---
async function saveToTempBill(connection, bill, proposerMonaCd) { const { proposerName, coProposerCount } = parseProposerInfo(bill.proposer); const sql = `INSERT INTO temp_bills (bill_id, bill_no, bill_name, bill_kind_cd, age_cd, age_name, proposer_kind_cd, proposer_name, mona_cd, co_proposer_count, propose_dt, committee, committee_id, proc_result_cd, proc_result_name, link_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE bill_id = VALUES(bill_id)`; const values = [bill.billId, bill.billNo, bill.billName, bill.billKindCd, bill.age, bill.ageNm, bill.proposerKindCd, proposerName, proposerMonaCd, coProposerCount, bill.proposeDt, bill.currCommittee, bill.currCommitteeId, bill.procResultCd, bill.procResultNm, bill.billLinkUrl]; await connection.execute(sql, values); }
async function saveToTempCoProposer(connection, billId, monaCd, isRepresentative) { const sql = `INSERT INTO temp_bill_co_proposers (bill_id, mona_cd, proposer_yn) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE bill_id=bill_id`; await connection.execute(sql, [billId, monaCd, isRepresentative ? 1 : 0]); }
async function saveToTempVote(connection, billId, monaCd, voteResult, voteDate) { const sql = `INSERT INTO temp_bill_votes (bill_id, mona_cd, vote_result, vote_date) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE bill_id=bill_id`; const formattedDate = voteDate ? format(new Date(voteDate), 'yyyy-MM-dd') : null; await connection.execute(sql, [billId, monaCd, voteResult, formattedDate]); }


/**
 * [1단계 작업] 특정 의원의 데이터를 수집하여 변경/신규 건만 임시 테이블에 저장합니다.
 */
async function collectAndStageData(politician, assemblyAge, pool, politicianNameToMonaCdMap, globalBillStatusMap, latestVoteDateMap) {
    const { mona_cd: monaCd, name: politicianName } = politician;
    const detailUrl = getPoliticianDetailPageUrl(monaCd, assemblyAge);
    
    const scraper = new WebScraper();
    const connection = await pool.getConnection();
    const collectedCounts = { bills: 0, coProposers: 0, votes: 0 };

    try {
        if (!await scraper.initialize(detailUrl)) throw new Error('Scraper 초기화 실패');
        
        // 대표 발의 (bills 스킵 로직 적용)
        for (let p = 1, t = 1; p <= t; p++) {
            let pageHasChanges = false;
            const res = await fetchRepresentativeBills(monaCd, p, ROWS_PER_PAGE, assemblyAge, detailUrl, scraper);
            if (!res || !res.resultList?.length) break;
            t = res.paginationInfo.totalPageCount;
            for (const bill of res.resultList) {
                const existingStatus = globalBillStatusMap.get(bill.billId);
                if (!existingStatus || existingStatus !== bill.procResultCd) {
                    await saveToTempBill(connection, bill, monaCd);
                    collectedCounts.bills++;
                    pageHasChanges = true;
                }
            }
            if (!pageHasChanges) { logger.debug(`[${politicianName}] 대표 발의: 변경 사항 없어 수집 중단`); break; }
            if (p < t) await sleep(API_CALL_DELAY_MS);
        }

        // 공동 발의 (bills 스킵 로직 적용)
        for (let p = 1, t = 1; p <= t; p++) {
            let pageHasChanges = false;
            const res = await fetchCoProposerBills(monaCd, p, ROWS_PER_PAGE, assemblyAge, detailUrl, scraper);
            if (!res || !res.resultList?.length) break;
            t = res.paginationInfo.totalPageCount;
            for (const bill of res.resultList) {
                const existingStatus = globalBillStatusMap.get(bill.billId);
                if (!existingStatus || existingStatus !== bill.procResultCd) {
                    const repName = parseProposerInfo(bill.proposer).names[0]?.replace(/의원$/, '');
                    await saveToTempBill(connection, bill, politicianNameToMonaCdMap.get(repName) || null);
                    collectedCounts.bills++;
                    pageHasChanges = true;
                }
            }
            if (!pageHasChanges) { logger.debug(`[${politicianName}] 공동 발의: 변경 사항 없어 수집 중단`); break; }
            if (p < t) await sleep(API_CALL_DELAY_MS);
        }

        // 공동 발의자 관계 (항상 전체 수집)
        for (let p = 1, t = 1; p <= t; p++) {
            const res = await fetchCoProposerBills(monaCd, p, ROWS_PER_PAGE, assemblyAge, detailUrl, scraper);
            if (!res || !res.resultList?.length) break;
            t = res.paginationInfo.totalPageCount;
            for (const bill of res.resultList) {
                await saveToTempCoProposer(connection, bill.billId, monaCd, false);
                collectedCounts.coProposers++;
            }
            if (p < t) await sleep(API_CALL_DELAY_MS);
        }
        for (let p = 1, t = 1; p <= t; p++) {
            const res = await fetchRepresentativeBills(monaCd, p, ROWS_PER_PAGE, assemblyAge, detailUrl, scraper);
            if (!res || !res.resultList?.length) break;
            t = res.paginationInfo.totalPageCount;
            for (const bill of res.resultList) {
                await saveToTempCoProposer(connection, bill.billId, monaCd, true);
            }
            if (p < t) await sleep(API_CALL_DELAY_MS);
        }

        // 표결 결과 (votes 스킵 로직 적용)
        const latestVoteDate = latestVoteDateMap.get(monaCd);
        for (let p = 1, t = 1; p <= t; p++) {
            let stopFetching = false;
            const res = await fetchVoteResults(monaCd, p, ROWS_PER_PAGE, assemblyAge, detailUrl, scraper);
            if (!res || !res.resultList?.length) break;
            t = res.paginationInfo.totalPageCount;
            for (const vote of res.resultList) {
                if (latestVoteDate && vote.voteendDt && new Date(vote.voteendDt) <= latestVoteDate) {
                    stopFetching = true;
                    break;
                }
                const billId = extractBillIdFromUrl(vote.billUrl);
                if(billId) {
                    await saveToTempVote(connection, billId, monaCd, vote.resultVoteMod, vote.voteendDt);
                    collectedCounts.votes++;
                }
            }
            if (stopFetching) { logger.debug(`[${politicianName}] 표결 결과: 기존 데이터 발견하여 수집 중단`); break; }
            if (p < t) await sleep(API_CALL_DELAY_MS);
        }

    } catch (error) {
        logger.error(`[수집 단계][${politicianName}] 처리 중 오류 발생:`, error.message);
    } finally {
        if(connection) connection.release();
    }
    return collectedCounts;
}


/**
 * 메인 실행 함수
 */
async function runBillSync(assemblyAge) {
    if (!assemblyAge) { logger.error('Error: 국회 대수(assemblyAge)가 지정되지 않았습니다.'); return; }
    logger.info(`[Bill Sync Batch START] ${assemblyAge}대 국회 법안 데이터 동기화를 시작합니다.`);
    
    const pool = mysql.createPool(dbConfig);
    const startTime = Date.now();

    try {
        const [politicians] = await pool.execute('SELECT mona_cd, name FROM politicians WHERE active_yn = TRUE');
        const totalPoliticians = politicians.length;
        if (totalPoliticians === 0) { logger.warn('DB에서 현역 의원 정보를 찾을 수 없습니다.'); return; }
        
        const politicianNameToMonaCdMap = new Map(politicians.map(p => [p.name, p.mona_cd]));
        
        // [준비 1] bills 스킵 기준 로드
        const [allBillsInDb] = await pool.execute('SELECT bill_id, proc_result_cd FROM bills');
        const globalBillStatusMap = new Map(allBillsInDb.map(b => [b.bill_id, b.proc_result_cd]));
        logger.info(`[준비] DB에서 ${globalBillStatusMap.size}개의 기존 법안 상태 정보를 로드했습니다.`);
        
        // [준비 2] votes 스킵 기준 로드
        const [latestVotesInDb] = await pool.execute('SELECT mona_cd, MAX(vote_date) as max_date FROM bill_votes GROUP BY mona_cd');
        const latestVoteDateMap = new Map(latestVotesInDb.map(v => [v.mona_cd, new Date(v.max_date)]));
        logger.info(`[준비] DB에서 ${latestVoteDateMap.size}명의 의원별 최신 표결 일자 정보를 로드했습니다.`);

        // [준비 3] 임시 테이블 비우기
        logger.info('[준비] 임시 테이블을 비웁니다...');
        await pool.execute('TRUNCATE TABLE temp_bills');
        await pool.execute('TRUNCATE TABLE temp_bill_co_proposers');
        await pool.execute('TRUNCATE TABLE temp_bill_votes');

        // --- 1단계: 병렬 수집 ---
        logger.info(`--- [1단계 시작] ${totalPoliticians}명의 의원 정보를 병렬로 수집합니다... (동시 처리: ${CONCURRENT_POLITICIAN_LIMIT}) ---`);
        const limit = pLimit(CONCURRENT_POLITICIAN_LIMIT);
        let completedCount = 0;
        
        const collectionPromises = politicians.map(politician => limit(async () => {
            const randomDelay = Math.random() * 500;
            await sleep(randomDelay);
            const collectedCounts = await collectAndStageData(politician, assemblyAge, pool, politicianNameToMonaCdMap, globalBillStatusMap, latestVoteDateMap);
            completedCount++;
            logger.info(`[수집 진행] ${completedCount}/${totalPoliticians}명 완료 (${politician.name}: 법안 ${collectedCounts.bills}, 공동발의 ${collectedCounts.coProposers}, 표결 ${collectedCounts.votes} 건 수집)`);
        }));
        await Promise.all(collectionPromises);
        logger.info('--- [1단계 완료] 모든 데이터 수집 완료. ---');

        // --- 2단계: 데이터 이전 ---
        logger.info('--- [2단계 시작] 임시 테이블의 데이터를 업무 테이블로 이전합니다... ---');
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            const [billResult] = await connection.execute(`INSERT INTO bills (bill_id, bill_no, bill_name, bill_kind_cd, age_cd, age_name, proposer_kind_cd, proposer_name, mona_cd, co_proposer_count, propose_dt, committee, committee_id, proc_result_cd, proc_result_name, link_url) SELECT * FROM temp_bills ON DUPLICATE KEY UPDATE bill_name = VALUES(bill_name), proc_result_cd = VALUES(proc_result_cd), proc_result_name = VALUES(proc_result_name), updated_at = NOW()`);
            logger.info(`- Bills: ${billResult.affectedRows} 건 신규/변경됨.`);

            const [coProposerResult] = await connection.execute(`INSERT IGNORE INTO bill_co_proposers (bill_id, mona_cd, proposer_yn) SELECT bill_id, mona_cd, proposer_yn FROM temp_bill_co_proposers`);
            logger.info(`- Co-Proposers: ${coProposerResult.affectedRows} 건 신규 처리됨.`);

            const [voteResult] = await connection.execute(`INSERT INTO bill_votes (bill_id, mona_cd, vote_result, vote_date) SELECT bill_id, mona_cd, vote_result, vote_date FROM temp_bill_votes ON DUPLICATE KEY UPDATE vote_result = VALUES(vote_result), vote_date = VALUES(vote_date)`);
            logger.info(`- Votes: ${voteResult.affectedRows} 건 신규/변경됨.`);

            await connection.commit();
            logger.info('--- [2단계 완료] 데이터 이전 성공. ---');

        } catch (error) {
            await connection.rollback();
            logger.error('--- [2단계 실패] 데이터 이전 중 오류 발생. 롤백되었습니다. ---', error);
        } finally {
            if(connection) connection.release();
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`\n[Bill Sync Batch SUCCESS] 동기화 완료 (총 소요 시간: ${duration}초)`);

    } catch (error) {
        logger.error(`[Bill Sync Batch FAILED] 심각한 오류 발생:`, error);
    } finally {
        await pool.end();
        logger.info(`[Bill Sync Batch END] 배치가 종료되었습니다.`);
    }
}

const ASSEMBLY_AGE_TO_SYNC = process.env.ASSEMBLY_AGE || '22';
cron.schedule('30 5 * * *', () => { runBillSync(ASSEMBLY_AGE_TO_SYNC); });
logger.info(`법안 데이터 동기화 배치가 설정되었습니다.`);

runBillSync(ASSEMBLY_AGE_TO_SYNC);