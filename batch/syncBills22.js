// syncBills.js (Topic 분류 로직 제거 후 최종 버전)

import cron from 'node-cron';
import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { format } from 'date-fns';
import WebScraper from '../utils/webScraper.js';
import pLimit from 'p-limit';

const CONCURRENT_POLITICIAN_LIMIT = 5;
const PAGE_CONCURRENT_LIMIT = 10;
const ROWS_PER_PAGE = 100;
const API_CALL_DELAY_MS = 150;

// --- [정의] 의안 종류 코드 및 이름 ---
const BILL_KIND = {
    LAW: { ID: 1, NAME: '법률안' },
    ETC: { ID: 2, NAME: '기타의안' },
    UNKNOWN: { ID: 0, NAME: '정보수집필요' }
};


// --- 유틸리티 함수 (변동 없음) ---
function getPoliticianDetailPageUrl(monaCd, age) { return `https://www.assembly.go.kr/portal/assm/assmPrpl/prplMst.do?monaCd=${monaCd}&st=${age}&viewType=CONTBODY&tabId=repbill`; }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function extractBillIdFromUrl(url) { const match = url.match(/billId=([^&]+)/); return match ? match[1] : null; }
function parseProposerInfo(proposerText) { if (!proposerText) return { proposerName: null, coProposerCount: 0, names: [] }; const nameMatch = proposerText.match(/^([^등]+?)(?:의원|$)/); const coProposerCountMatch = proposerText.match(/등 (\d+)인/); const proposerName = nameMatch ? nameMatch[1].trim() + '의원' : proposerText.split('등')[0].trim(); const coProposerCount = coProposerCountMatch ? parseInt(coProposerCountMatch[1]) : 0; const names = proposerName.split('ㆍ').map(n => n.trim()); return { proposerName, coProposerCount, names }; }


// --- 임시 테이블 저장 전용 함수 ---
async function saveToTempBill(client, bill, proposerMonaCd, billKindId) {
    const { proposerName, coProposerCount } = parseProposerInfo(bill.proposer);

    const sql = `INSERT INTO temp_bills (bill_id, bill_no, bill_name, bill_kind_cd, age_cd, age_name, proposer_kind_cd, proposer_name, mona_cd, co_proposer_count, propose_dt, committee, committee_id, proc_result_cd, proc_result_name, link_url, bill_topic_cd) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NULL) ON CONFLICT (bill_id) DO UPDATE SET bill_id = EXCLUDED.bill_id`;
    const values = [bill.billId, bill.billNo, bill.billName, billKindId, bill.age, bill.ageNm, bill.proposerKindCd, proposerName, proposerMonaCd, coProposerCount, bill.proposeDt, bill.currCommittee, bill.currCommitteeId, bill.procResultCd, bill.procResultNm, bill.billLinkUrl];
    await client.query(sql, values);
}
async function saveToTempCoProposer(client, billId, billNo, monaCd, isRepresentative) { const sql = `INSERT INTO temp_bill_co_proposers (bill_id, bill_no, mona_cd, proposer_yn) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`; await client.query(sql, [billId, billNo, monaCd, isRepresentative ? 1 : 0]); }
async function saveToTempVote(client, billId, billNo, monaCd, voteResult, voteDate) {
    try {
        const sql = `INSERT INTO temp_bill_votes (bill_id, bill_no, mona_cd, vote_result, vote_date) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`;
        const formattedDate = (voteDate && voteDate.trim() !== '') ? format(new Date(voteDate), 'yyyy-MM-dd') : null;
        await client.query(sql, [billId, billNo, monaCd, voteResult, formattedDate]);
        return true;
    } catch (error) {
        logger.error(`[DB Error] Failed to save vote for bill ${billId}. Error: ${error.message}`);
        return false;
    }
}


/**
 * [핵심 수집 로직] 여러 페이지를 병렬로 스크레이핑하는 범용 함수 (변경 없음)
 */
async function fastFetchAllPages(monaCd, scraper, endpoint, baseParams, firstPageData = null) {
    const refererUrl = getPoliticianDetailPageUrl(monaCd, '22');
    const responseToUse = firstPageData || await scraper.postData(endpoint, { ...baseParams, pageIndex: 1 }, refererUrl);
    if (!responseToUse?.resultList?.length) return [];

    const allItems = [...responseToUse.resultList];
    const totalPages = responseToUse.paginationInfo.totalPageCount;
    if (totalPages <= 1) return allItems;

    const limit = pLimit(PAGE_CONCURRENT_LIMIT);
    const pagePromises = [];
    for (let pageIndex = 2; pageIndex <= totalPages; pageIndex++) {
        pagePromises.push(limit(async () => {
            const currentParams = { ...baseParams, pageIndex };
            const response = await scraper.postData(endpoint, currentParams, refererUrl);
            const items = response?.resultList || [];
            if (pageIndex < totalPages) await sleep(API_CALL_DELAY_MS);
            return items;
        }));
    }
    const remainingPagesData = await Promise.all(pagePromises);
    remainingPagesData.forEach(pageData => allItems.push(...pageData));
    return allItems;
}


/**
 * [1단계 작업] 한 명의 의원에 대한 모든 데이터를 수집하여 임시 테이블에 저장합니다.
 */
async function collectAndStageData(politician, assemblyAge, pool, politicianNameToMonaCdMap, globalBillStatusMap) {
    const { mona_cd: monaCd, name: politicianName } = politician;
    const scraper = new WebScraper();
    const client = await pool.connect();
    const collectedInfo = {
        bills: 0,
        coProposers: 0,
        votes: 0,
        apiBillCount: 0,
        apiVoteCount: 0
    };

    try {
        await scraper.initialize(getPoliticianDetailPageUrl(monaCd, assemblyAge));

        // --- 법안 수집 로직 ---
        const commonBillParams = { monaCd, age: '22', rowPerPage: ROWS_PER_PAGE, billName: '', procResultCd: '', pageLink: 'doActionRepBill.goPage' };
        const billSources = [
            { kind: BILL_KIND.LAW, type: 'law_rep', endpoint: 'findRepPrpsBill.json', params: { ...commonBillParams, represent: BILL_KIND.LAW.NAME } },
            { kind: BILL_KIND.LAW, type: 'law_co', endpoint: 'findCollaPrpsBill.json', params: { ...commonBillParams, represent: BILL_KIND.LAW.NAME } },
            { kind: BILL_KIND.ETC, type: 'etc_rep', endpoint: 'findRepPrpsEtcBill.json', params: { ...commonBillParams } },
            { kind: BILL_KIND.ETC, type: 'etc_co', endpoint: 'findCollaPrpsEtcBill.json', params: { ...commonBillParams } },
        ];

        let currentApiBillCount = 0;
        let lastApiBillCount = politician.last_bill_api_count || 0;

        for (const source of billSources) {
            const firstPageResponse = await scraper.postData(source.endpoint, { ...source.params, pageIndex: 1 }, getPoliticianDetailPageUrl(monaCd, assemblyAge));
            currentApiBillCount += (firstPageResponse?.paginationInfo?.totalRecordCount || 0);
        }
        collectedInfo.apiBillCount = currentApiBillCount;

        if (currentApiBillCount === lastApiBillCount && currentApiBillCount > 0) {
             logger.info(`[${politicianName}] 법안: 변동 없음 (API: ${currentApiBillCount}건). 스킵합니다.`);
        } else {
            if(currentApiBillCount !== lastApiBillCount) logger.warn(`[${politicianName}] 법안: 변동 감지 (DB: ${lastApiBillCount} -> API: ${currentApiBillCount}). 전체 스캔 시작.`);

            for (const source of billSources) {
                const firstPageResponse = await scraper.postData(source.endpoint, { ...source.params, pageIndex: 1 }, getPoliticianDetailPageUrl(monaCd, assemblyAge));
                const allItems = await fastFetchAllPages(monaCd, scraper, source.endpoint, source.params, firstPageResponse);
                const isRep = source.type.includes('rep');

                for (const bill of allItems) {
                    if (!globalBillStatusMap.has(bill.billId) || globalBillStatusMap.get(bill.billId) !== bill.procResultCd) {
                        const repMonaCd = isRep ? monaCd : (politicianNameToMonaCdMap.get(parseProposerInfo(bill.proposer).names[0]?.replace(/의원$/, '')) || null);
                        await saveToTempBill(client, bill, repMonaCd, source.kind.ID);
                        collectedInfo.bills++;
                        globalBillStatusMap.set(bill.billId, bill.procResultCd);
                    }
                    await saveToTempCoProposer(client, bill.billId, bill.billNo, monaCd, isRep);
                    if (!isRep) collectedInfo.coProposers++;
                }
            }
        }

        // --- 표결 데이터 수집 로직 ---
        const voteParams = { monaCd, pageLink: 'doActionVote.goPage', age: '22', procResultCd: '', bgVoteendDt: '', edVoteendDt: '', resultVoteMod: '', billName: '', rowPerPage: ROWS_PER_PAGE };
        const firstVotePage = await scraper.postData('findAssmVoteResult.json', { ...voteParams, pageIndex: 1 }, getPoliticianDetailPageUrl(monaCd, assemblyAge));

        const apiVoteCount = firstVotePage?.paginationInfo?.totalRecordCount || 0;
        const lastApiVoteCount = politician.last_vote_api_count || 0;

        collectedInfo.apiVoteCount = apiVoteCount;

        if (apiVoteCount === lastApiVoteCount && apiVoteCount > 0) {
            logger.info(`[${politicianName}] 표결: 변동 없음 (API: ${apiVoteCount}건). 스킵합니다.`);
        } else {
            if(apiVoteCount !== lastApiVoteCount) logger.warn(`[${politicianName}] 표결: 변동 감지 (DB: ${lastApiVoteCount} -> API: ${apiVoteCount}). 전체 스캔 시작.`);
            const votes = await fastFetchAllPages(monaCd, scraper, 'findAssmVoteResult.json', voteParams, firstVotePage);

            for (const vote of votes) {
                const billId = extractBillIdFromUrl(vote.billUrl);
                if(billId && vote.billNo) {
                    const success = await saveToTempVote(client, billId, vote.billNo, monaCd, vote.resultVoteMod, vote.voteendDt);
                    if (success) {
                        collectedInfo.votes++;
                    }
                }
            }
        }
    } catch (error) {
        logger.error(`[수집 단계][${politicianName}] 처리 중 오류 발생:`, error);
    } finally {
        if(client) client.release();
    }
    return collectedInfo;
}


/**
 * 메인 실행 함수
 */
async function runBillSync(assemblyAge, limitCount = 0) {
    if (!assemblyAge) { logger.error('Error: 국회 대수(assemblyAge)가 지정되지 않았습니다.'); return; }
    logger.info(`[Bill Sync Batch START] ${assemblyAge}대 국회 법안 데이터 동기화를 시작합니다.`);
    const pool = new pg.Pool(dbConfig);
    const startTime = Date.now();

    const apiBillCountUpdateMap = new Map();
    const apiVoteCountUpdateMap = new Map();

    try {
        let { rows: politicians } = await pool.query(`
            SELECT
                mona_cd,
                name,
                COALESCE(last_vote_api_count, 0) AS last_vote_api_count,
                COALESCE(last_bill_api_count, 0) AS last_bill_api_count
            FROM politicians
            WHERE active_yn = TRUE
            ORDER BY name ASC
        `);
        if (limitCount > 0) {
            logger.warn(`[테스트 모드] ${limitCount}명만 데이터를 수집합니다.`);
            politicians = politicians.slice(0, limitCount);
        }

        const totalPoliticians = politicians.length;
        if (totalPoliticians === 0) { logger.warn('DB에서 처리할 현역 의원 정보를 찾을 수 없습니다.'); return; }

        const politicianNameToMonaCdMap = new Map(politicians.map(p => [p.name, p.mona_cd]));

        logger.info('[준비] DB의 현재 데이터 상태를 로드합니다...');
        const { rows: allBillsInDb } = await pool.query('SELECT bill_id, proc_result_cd FROM bills');
        const globalBillStatusMap = new Map(allBillsInDb.map(b => [b.bill_id, b.proc_result_cd]));
        logger.info(`[준비] DB에서 ${globalBillStatusMap.size}개의 기존 법안 상태 정보를 로드했습니다.`);

        logger.info('[준비] 임시 테이블을 비웁니다...');
        await pool.query('TRUNCATE TABLE temp_bills');
        await pool.query('TRUNCATE TABLE temp_bill_co_proposers');
        await pool.query('TRUNCATE TABLE temp_bill_votes');

        logger.info(`--- [1단계 시작] ${totalPoliticians}명의 의원 정보를 병렬로 수집합니다...`);
        const limit = pLimit(CONCURRENT_POLITICIAN_LIMIT);
        let completedCount = 0;

        const collectionPromises = politicians.map(politician => limit(async () => {
            await sleep(Math.random() * 1000);
            const collected = await collectAndStageData(politician, assemblyAge, pool, politicianNameToMonaCdMap, globalBillStatusMap);

            apiBillCountUpdateMap.set(politician.mona_cd, collected.apiBillCount);
            apiVoteCountUpdateMap.set(politician.mona_cd, collected.apiVoteCount);

            completedCount++;
            const remaining = totalPoliticians - completedCount;

            logger.info(`[수집 진행] ${completedCount}/${totalPoliticians}명 완료 (${politician.name}: 법안 ${collected.bills}, 공동발의 ${collected.coProposers}, 표결 ${collected.votes} 건 임시 저장, 잔여: ${remaining}명)`);
            return collected;
        }));
        await Promise.all(collectionPromises);
        logger.info('--- [1단계 완료] 모든 데이터 수집 완료. ---');

        // --- 2단계 최종 이관 로직 ---
        logger.info('--- [2단계 시작] 임시 테이블의 데이터를 업무 테이블로 이전합니다... ---');
        const client = await pool.connect();
        await client.query('BEGIN');
        let billsAffected = 0, coProposersAffected = 0, votesAffected = 0, placeholdersAffected = 0;
        try {
            const { rows: [billsTempCount] } = await client.query('SELECT COUNT(*) as count FROM temp_bills');
            const { rows: [coProposersTempCount] } = await client.query('SELECT COUNT(*) as count FROM temp_bill_co_proposers');
            const { rows: [votesTempCount] } = await client.query('SELECT COUNT(*) as count FROM temp_bill_votes');
            logger.info('--- 임시 테이블 검증 ---');
            logger.info(`- temp_bills: ${billsTempCount.count} 건`);
            logger.info(`- temp_bill_co_proposers: ${coProposersTempCount.count} 건`);
            logger.info(`- temp_bill_votes: ${votesTempCount.count} 건`);
            logger.info('------------------------');

            // 1. bills 테이블 최종 INSERT/UPDATE
            const billResult = await client.query(`
                INSERT INTO bills (bill_id, bill_no, bill_name, bill_kind_cd, age_cd, age_name, proposer_kind_cd, proposer_name, mona_cd, co_proposer_count, propose_dt, committee, committee_id, proc_result_cd, proc_result_name, link_url)
                SELECT bill_id, bill_no, bill_name, bill_kind_cd, age_cd, age_name, proposer_kind_cd, proposer_name, mona_cd, co_proposer_count, propose_dt, committee, committee_id, proc_result_cd, proc_result_name, link_url FROM temp_bills
                ON CONFLICT (bill_id) DO UPDATE SET
                    bill_name = EXCLUDED.bill_name,
                    proc_result_cd = EXCLUDED.proc_result_cd,
                    proc_result_name = EXCLUDED.proc_result_name,
                    updated_at = NOW()
            `);
            billsAffected = billResult.rowCount;

            // 2. 껍데기 법안 생성
            const placeholderResult = await client.query(`
                INSERT INTO bills (bill_id, bill_no, bill_name, link_url, bill_kind_cd)
                SELECT DISTINCT t.bill_id, t.bill_no, '정보 수집 필요', '', ${BILL_KIND.UNKNOWN.ID}
                FROM temp_bill_votes t
                LEFT JOIN bills b ON t.bill_id = b.bill_id
                WHERE b.bill_id IS NULL
                ON CONFLICT DO NOTHING
            `);
            placeholdersAffected = placeholderResult.rowCount;
            if (placeholdersAffected > 0) {
                logger.warn(`- Placeholder Bills: ${placeholdersAffected} 개의 '정보 없음' 법안을 추가했습니다. (FK 제약 조건 충족 목적)`);
            }

            const coProposerResult = await client.query(`
                INSERT INTO bill_co_proposers (bill_id, bill_no, mona_cd, proposer_yn)
                SELECT bill_id, bill_no, mona_cd, proposer_yn FROM temp_bill_co_proposers
                ON CONFLICT DO NOTHING
            `);
            coProposersAffected = coProposerResult.rowCount;

            const voteResult = await client.query(`
                INSERT INTO bill_votes
                    (bill_id, bill_no, mona_cd, vote_result, vote_date)
                SELECT
                    bill_id, bill_no, mona_cd, vote_result, vote_date
                FROM
                    temp_bill_votes
                ON CONFLICT DO NOTHING
            `);
            votesAffected = voteResult.rowCount;

            // API 원본 카운트 업데이트 로직
            const updatePromises = [];
            for (const [monaCd, apiCount] of apiBillCountUpdateMap.entries()) {
                const updateSql = `UPDATE politicians SET last_bill_api_count = $1 WHERE mona_cd = $2`;
                updatePromises.push(client.query(updateSql, [apiCount, monaCd]));
            }
            for (const [monaCd, apiCount] of apiVoteCountUpdateMap.entries()) {
                const updateSql = `UPDATE politicians SET last_vote_api_count = $1 WHERE mona_cd = $2`;
                updatePromises.push(client.query(updateSql, [apiCount, monaCd]));
            }
            await Promise.all(updatePromises);

            await client.query('COMMIT');
            logger.info('--- [2단계 완료] 데이터 이전 성공. ---');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('--- [2단계 실패] 데이터 이전 중 오류 발생. 롤백되었습니다. ---', error);
        } finally {
            if(client) client.release();
        }
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`\n[Bill Sync Batch SUCCESS] 동기화 완료 (총 소요 시간: ${duration}초)`);
        logger.info(`--- 최종 처리 결과 ---`);
        logger.info(`- 신규/변경 법안: ${billsAffected} 건`);
        logger.info(`- 유령 법안(Placeholder): ${placeholdersAffected} 건`);
        logger.info(`- 신규 공동발의 관계: ${coProposersAffected} 건`);
        logger.info(`- 신규 표결 이력: ${votesAffected} 건`);

    } catch (error) {
        logger.error(`[Bill Sync Batch FAILED] 심각한 오류 발생:`, error);
    } finally {
        await pool.end();
        logger.info(`[Bill Sync Batch END] 배치가 종료되었습니다.`);
    }
}

const ASSEMBLY_AGE_TO_SYNC = process.env.ASSEMBLY_AGE || '22';
const testLimit = parseInt(process.argv[2], 10) || 0;

// cron.schedule('30 23 * * *', () => { runBillSync(ASSEMBLY_AGE_TO_SYNC, testLimit); });
logger.info(`법안 데이터 동기화 배치가 설정되었습니다.`);
runBillSync(ASSEMBLY_AGE_TO_SYNC, testLimit);