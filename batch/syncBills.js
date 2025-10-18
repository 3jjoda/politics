// C:\dev\politics\jobs\syncBills.js (최종 반영 완료 버전)

import cron from 'node-cron';
import mysql from 'mysql2/promise';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { format } from 'date-fns';
import WebScraper from '../utils/webScraper.js';
import pLimit from 'p-limit';
import fs from 'fs'; // 파일 시스템 모듈 추가
import path from 'path'; // 경로 모듈 추가

const CONCURRENT_POLITICIAN_LIMIT = 5;
const PAGE_CONCURRENT_LIMIT = 10;
const ROWS_PER_PAGE = 100;
const API_CALL_DELAY_MS = 150; 
const TOPIC_REVIEW_FILE = path.join(process.cwd(), 'data', 'new_topic_review_list.txt'); // 신규 토픽 파일 경로

// --- [정의] 의안 종류 코드 및 이름 ---
const BILL_KIND = {
    LAW: { ID: 1, NAME: '법률안' },
    ETC: { ID: 2, NAME: '기타의안' },
    UNKNOWN: { ID: 0, NAME: '정보수집필요' } // Placeholder용 코드 추가
};

// --- [정의] Topic 분류 기준 ---
const TOPIC_KEYWORDS = {
    '보건/복지/의료': ['건강보험', '의료', '치매', '환자', '간호', '장애인복지', '노인복지', '영유아보육', '국민연금', '기초연금', '정신건강', '응급의료', '후천성면역결핍', '희귀질환', '돌봄', '보건'],
    '교육/인재/학술': ['교육', '학교', '학생', '대학', '사립학교', '학술', '직업교육', '평생교육', '영재교육', '교원', '학점인정', '과학관', '사관학교', '인재'],
    '노동/고용/자영업': ['근로', '노동조합', '임금', '고용', '소상공인', '자영업', '직능인', '필수노동자', '기간제', '파견근로', '산재', '경력단절', '일자리', '노동'],
    '국토/도시/주택': ['주택', '건축', '도시', '재개발', '도로', '철도', '교통', '부동산', '택지', '주차장', '공동주택', '개발제한구역', '도시재생', '항공', '공항', '물류', '철도안전'],
    '환경/기후/에너지': ['환경', '기후', '탄소', '에너지', '원자력', '폐기물', '소음', '물관리', '석면', '대기', '재활용', '오존층', '토양환경', '하천', '해양환경', '수소'],
    '농림축산/수산/해양': ['농지', '농산물', '어촌', '수산', '축산', '산림', '농림어업', '양곡', '낙농', '김산업', '종자산업', '양봉', '임업', '가축', '어선', '해양', '수산식품'],
    '조세/재정/금융': ['조세', '세법', '금융', '보험', '국세', '지방세', '국채', '예금자', '자산관리', '신용보증', '증권거래세', '상속세', '법인세', '부가가치세', '주세'],
    '산업/기술/R&D': ['산업', '기술', '과학', '정보통신', '반도체', 'AI', '인공지능', '벤처기업', '중소기업', '기술혁신', '지식재산', '소재ㆍ부품ㆍ장비', '디지털', '컴퓨팅', '로봇', '데이터베이스'],
    '행정/공공/사법': ['공무원', '지방자치', '공공기관', '민원', '행정심판', '행정절차', '사법', '법원조직', '헌법재판소', '검찰청', '감사원', '공직자윤리', '국민권익', '인사청문회', '경찰'],
    '안보/국방/병무': ['군인', '군사', '국방', '병역', '군형법', '예비군', '군사시설', '방위사업', '군검찰', '국가안보', '군포로', '국군'],
    '문화/체육/예술': ['문화재', '문화', '예술', '체육', '영화', '미디어', '방송', '박물관', '만화', '태권도', '이스포츠', '국악', '한복', '스포츠', '콘텐츠'],
    '안전/재난/소방': ['안전관리', '재난', '소방', '화재', '응급의료', '승강기안전', '방사능', '위험물', '경비업', '지진', '119', '사격장', '급경사지'],
    '통일/외교/남북': ['북한', '남북교류', '통일', '재외국민', '외교', '위안부', '강제동원', '북한이탈주민', '판문점', '개성공단', '한미동맹', '일본정부'],
    '정치/선거/규제': ['공직선거', '국회법', '국민투표', '정당', '규제', '특별검사', '징계안', '탄핵소추', '윤석열', '김건희', '비상계엄', '헌법', '대통령', '사법농단'],
    '유통/소비자/공정': ['유통', '소비자', '공정거래', '하도급', '방문판매', '담배', '화장품', '대리점거래', '경품', '상품권', '약관', '전자상거래', '독점규제', '집단소송'],
    '99': ['일부개정법률안', '전부개정법률안', '법률안', '특별법안', '기본법안', '폐지법률안', '결의안'] // 기타/일반법/특별 및 가장 흔한 일반 명칭
};


// --- 유틸리티 함수 ---
function getPoliticianDetailPageUrl(monaCd, age) { return `https://www.assembly.go.kr/portal/assm/assmPrpl/prplMst.do?monaCd=${monaCd}&st=${age}&viewType=CONTBODY&tabId=repbill`; }
async function callAssemblyApiWithScraper(endpoint, params, refererUrl, scraperInstance) { return scraperInstance.postData(endpoint, params, refererUrl); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function extractBillIdFromUrl(url) { const match = url.match(/billId=([^&]+)/); return match ? match[1] : null; }
function parseProposerInfo(proposerText) { if (!proposerText) return { proposerName: null, coProposerCount: 0, names: [] }; const nameMatch = proposerText.match(/^([^등]+?)(?:의원|$)/); const coProposerCountMatch = proposerText.match(/등 (\d+)인/); const proposerName = nameMatch ? nameMatch[1].trim() + '의원' : proposerText.split('등')[0].trim(); const coProposerCount = coProposerCountMatch ? parseInt(coProposerCountMatch[1]) : 0; const names = proposerName.split('ㆍ').map(n => n.trim()); return { proposerName, coProposerCount, names }; }

// --- [신규 기능] 토픽 분류 및 검토 파일 저장 ---
function classifyTopic(billName) {
    for (const topic in TOPIC_KEYWORDS) {
        for (const keyword of TOPIC_KEYWORDS[topic]) {
            if (billName.includes(keyword)) {
                return topic; 
            }
        }
    }
    // 키워드에 없는 경우 '기타'로 분류
    return '기타/일반법/특별';
}

async function logNewTopicForReview(billId, billNo, billName) {
    // data 디렉토리가 없으면 생성
    const dir = path.dirname(TOPIC_REVIEW_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const logEntry = `[${timestamp}] [${billId}] [${billNo}] 신규 토픽 검토 필요: ${billName}\n`;

    try {
        fs.appendFileSync(TOPIC_REVIEW_FILE, logEntry);
    } catch (error) {
        logger.error(`[File Write Error] 신규 토픽 파일 저장 실패: ${error.message}`);
    }
}

// --- 임시 테이블 저장 전용 함수 ---
async function saveToTempBill(connection, bill, proposerMonaCd, billKindId) {
    const { proposerName, coProposerCount } = parseProposerInfo(bill.proposer);
    // ✅ Topic 분류 후 저장
    const billTopic = classifyTopic(bill.billName);
    
    if (billTopic === '기타/일반법/특별') {
        // 신규 토픽 검토 필요시 파일에 로깅 (PK가 아닌 고유 bill_id 기준)
        await logNewTopicForReview(bill.billId, bill.billNo, bill.billName); 
    }

    // ✅ SQL에 bill_topic 컬럼 추가
    const sql = `INSERT INTO temp_bills (bill_id, bill_no, bill_name, bill_kind_cd, age_cd, age_name, proposer_kind_cd, proposer_name, mona_cd, co_proposer_count, propose_dt, committee, committee_id, proc_result_cd, proc_result_name, link_url, bill_topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE bill_id = VALUES(bill_id)`;
    const values = [bill.billId, bill.billNo, bill.billName, billKindId, bill.age, bill.ageNm, bill.proposerKindCd, proposerName, proposerMonaCd, coProposerCount, bill.proposeDt, bill.currCommittee, bill.currCommitteeId, bill.procResultCd, bill.procResultNm, bill.billLinkUrl, billTopic];
    await connection.execute(sql, values);
}
async function saveToTempCoProposer(connection, billId, billNo, monaCd, isRepresentative) { const sql = `INSERT INTO temp_bill_co_proposers (bill_id, bill_no, mona_cd, proposer_yn) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE bill_id=bill_id`; await connection.execute(sql, [billId, billNo, monaCd, isRepresentative ? 1 : 0]); }
async function saveToTempVote(connection, billId, billNo, monaCd, voteResult, voteDate) { 
    try {
        const sql = `INSERT IGNORE INTO temp_bill_votes (bill_id, bill_no, mona_cd, vote_result, vote_date) VALUES (?, ?, ?, ?, ?)`;
        const formattedDate = (voteDate && voteDate.trim() !== '') ? format(new Date(voteDate), 'yyyy-MM-dd') : null;
        await connection.execute(sql, [billId, billNo, monaCd, voteResult, formattedDate]); 
        return true; 
    } catch (error) {
        // 이 단계의 에러는 DB의 PK 중복 외에 발생하면 안됨.
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
            if (pageIndex < totalPages) await sleep(API_CALL_DELAY_MS); // API 호출 간 딜레이
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
    const connection = await pool.getConnection();
    const collectedInfo = { 
        bills: 0, 
        coProposers: 0, 
        votes: 0, 
        apiBillCount: 0, // 법안 API 원본 건수
        apiVoteCount: 0  // 표결 API 원본 건수 
    };

    try {
        await connection.query("SET NAMES 'utf8mb4'");
        await scraper.initialize(getPoliticianDetailPageUrl(monaCd, assemblyAge));

        // --- 법안 수집 로직 (대표/공동 발의) ---
        const commonBillParams = { monaCd, age: '', rowPerPage: ROWS_PER_PAGE, billName: '', procResultCd: '', pageLink: 'doActionRepBill.goPage' };
        const billSources = [
            { kind: BILL_KIND.LAW, type: 'law_rep', endpoint: 'findRepPrpsBill.json', params: { ...commonBillParams, represent: BILL_KIND.LAW.NAME } },
            { kind: BILL_KIND.LAW, type: 'law_co', endpoint: 'findCollaPrpsBill.json', params: { ...commonBillParams, represent: BILL_KIND.LAW.NAME } },
            { kind: BILL_KIND.ETC, type: 'etc_rep', endpoint: 'findRepPrpsEtcBill.json', params: { ...commonBillParams } },
            { kind: BILL_KIND.ETC, type: 'etc_co', endpoint: 'findCollaPrpsEtcBill.json', params: { ...commonBillParams } },
        ];

        let currentApiBillCount = 0;
        let lastApiBillCount = politician.last_bill_api_count || 0; 

        // API 카운트 합산 및 변동 감지
        for (const source of billSources) {
            const firstPageResponse = await scraper.postData(source.endpoint, { ...source.params, pageIndex: 1 }, getPoliticianDetailPageUrl(monaCd, assemblyAge));
            currentApiBillCount += (firstPageResponse?.paginationInfo?.totalRecordCount || 0);
        }
        collectedInfo.apiBillCount = currentApiBillCount; 

        if (currentApiBillCount === lastApiBillCount && currentApiBillCount > 0) {
             logger.info(`[${politicianName}] 법안: 변동 없음 (API: ${currentApiBillCount}건). 스킵합니다.`);
        } else {
            if(currentApiBillCount !== lastApiBillCount) logger.warn(`[${politicianName}] 법안: 변동 감지 (DB: ${lastApiBillCount} -> API: ${currentApiBillCount}). 전체 스캔 시작.`);
            
            // --- 변동 감지 시 전체 데이터 수집 및 임시 테이블 저장 ---
            for (const source of billSources) {
                const firstPageResponse = await scraper.postData(source.endpoint, { ...source.params, pageIndex: 1 }, getPoliticianDetailPageUrl(monaCd, assemblyAge));
                const allItems = await fastFetchAllPages(monaCd, scraper, source.endpoint, source.params, firstPageResponse);
                const isRep = source.type.includes('rep');

                for (const bill of allItems) {
                    if (!globalBillStatusMap.has(bill.billId) || globalBillStatusMap.get(bill.billId) !== bill.procResultCd) {
                        const repMonaCd = isRep ? monaCd : (politicianNameToMonaCdMap.get(parseProposerInfo(bill.proposer).names[0]?.replace(/의원$/, '')) || null);
                        await saveToTempBill(connection, bill, repMonaCd, source.kind.ID);
                        collectedInfo.bills++;
                        globalBillStatusMap.set(bill.billId, bill.procResultCd);
                    }
                    await saveToTempCoProposer(connection, bill.billId, bill.billNo, monaCd, isRep);
                    if (!isRep) collectedInfo.coProposers++;
                }
            }
        }
        
        // --- 표결 데이터 수집 로직 ---
        const voteParams = { monaCd, pageLink: 'doActionVote.goPage', age: '', procResultCd: '', bgVoteendDt: '', edVoteendDt: '', resultVoteMod: '', billName: '', rowPerPage: ROWS_PER_PAGE };
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
                    const success = await saveToTempVote(connection, billId, vote.billNo, monaCd, vote.resultVoteMod, vote.voteendDt);
                    if (success) {
                        collectedInfo.votes++;
                    }
                }
            }
        }
    } catch (error) {
        logger.error(`[수집 단계][${politicianName}] 처리 중 오류 발생:`, error);
    } finally {
        if(connection) connection.release();
    }
    return collectedInfo;
}


/**
 * 메인 실행 함수
 */
async function runBillSync(assemblyAge, limitCount = 0) {
    if (!assemblyAge) { logger.error('Error: 국회 대수(assemblyAge)가 지정되지 않았습니다.'); return; }
    logger.info(`[Bill Sync Batch START] ${assemblyAge}대 국회 법안 데이터 동기화를 시작합니다.`);
    const pool = mysql.createPool(dbConfig);
    const startTime = Date.now();
    
    const apiBillCountUpdateMap = new Map();
    const apiVoteCountUpdateMap = new Map();
    let politiciansToUpdate = []; // 업데이트할 의원 목록 (API 카운트 업데이트용)

    try {
        // ✅ politicians 쿼리 수정: last_bill_api_count 컬럼 포함
        let [politicians] = await pool.execute('SELECT mona_cd, name, last_vote_api_count, last_bill_api_count FROM politicians WHERE active_yn = TRUE ORDER BY name ASC');
        if (limitCount > 0) {
            logger.warn(`[테스트 모드] ${limitCount}명만 데이터를 수집합니다.`);
            politicians = politicians.slice(0, limitCount);
        }
        politiciansToUpdate = [...politicians]; // 전체 의원 목록 복사

        const totalPoliticians = politicians.length;
        if (totalPoliticians === 0) { logger.warn('DB에서 처리할 현역 의원 정보를 찾을 수 없습니다.'); return; }
        
        const politicianNameToMonaCdMap = new Map(politicians.map(p => [p.name, p.mona_cd]));
        
        logger.info('[준비] DB의 현재 데이터 상태를 로드합니다...');
        const [allBillsInDb] = await pool.execute('SELECT bill_id, proc_result_cd FROM bills');
        const globalBillStatusMap = new Map(allBillsInDb.map(b => [b.bill_id, b.proc_result_cd]));
        logger.info(`[준비] DB에서 ${globalBillStatusMap.size}개의 기존 법안 상태 정보를 로드했습니다.`);
        
        // 기존 DB 저장 건수 로드 (변동 감지 외의 용도 - 로그 등에 사용)
        // 이 부분의 로직은 생략되었습니다. (existingCounts 로직)
        
        logger.info('[준비] 임시 테이블을 비웁니다...');
        await pool.execute('TRUNCATE TABLE temp_bills');
        await pool.execute('TRUNCATE TABLE temp_bill_co_proposers');
        await pool.execute('TRUNCATE TABLE temp_bill_votes');

        logger.info(`--- [1단계 시작] ${totalPoliticians}명의 의원 정보를 병렬로 수집합니다...`);
        const limit = pLimit(CONCURRENT_POLITICIAN_LIMIT);
        let completedCount = 0; // ✅ 잔여 의원 카운트 변수 초기화
        
        const collectionPromises = politicians.map(politician => limit(async () => {
            await sleep(Math.random() * 1000);
            const collected = await collectAndStageData(politician, assemblyAge, pool, politicianNameToMonaCdMap, globalBillStatusMap);
            
            apiBillCountUpdateMap.set(politician.mona_cd, collected.apiBillCount);
            apiVoteCountUpdateMap.set(politician.mona_cd, collected.apiVoteCount);

            completedCount++;
            const remaining = totalPoliticians - completedCount; // ✅ 잔여 의원 계산
            
            logger.info(`[수집 진행] ${completedCount}/${totalPoliticians}명 완료 (${politician.name}: 법안 ${collected.bills}, 공동발의 ${collected.coProposers}, 표결 ${collected.votes} 건 임시 저장, 잔여: ${remaining}명)`); // ✅ 잔여 의원 로깅 추가
            return collected;
        }));
        await Promise.all(collectionPromises);
        logger.info('--- [1단계 완료] 모든 데이터 수집 완료. ---');

        logger.info('--- [2단계 시작] 임시 테이블의 데이터를 업무 테이블로 이전합니다... ---');
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        let billsAffected = 0, coProposersAffected = 0, votesAffected = 0, placeholdersAffected = 0;
        try {
            await connection.query("SET NAMES 'utf8mb4'");

            const [[billsTempCount]] = await connection.execute('SELECT COUNT(*) as count FROM temp_bills');
            const [[coProposersTempCount]] = await connection.execute('SELECT COUNT(*) as count FROM temp_bill_co_proposers');
            const [[votesTempCount]] = await connection.execute('SELECT COUNT(*) as count FROM temp_bill_votes');
            logger.info('--- 임시 테이블 검증 ---');
            logger.info(`- temp_bills: ${billsTempCount.count} 건`);
            logger.info(`- temp_bill_co_proposers: ${coProposersTempCount.count} 건`);
            logger.info(`- temp_bill_votes: ${votesTempCount.count} 건`);
            logger.info('------------------------');

            const [billResult] = await connection.execute(`
                INSERT INTO bills (bill_id, bill_no, bill_name, bill_kind_cd, age_cd, age_name, proposer_kind_cd, proposer_name, mona_cd, co_proposer_count, propose_dt, committee, committee_id, proc_result_cd, proc_result_name, link_url, bill_topic)
                SELECT bill_id, bill_no, bill_name, bill_kind_cd, age_cd, age_name, proposer_kind_cd, proposer_name, mona_cd, co_proposer_count, propose_dt, committee, committee_id, proc_result_cd, proc_result_name, link_url, bill_topic FROM temp_bills
                ON DUPLICATE KEY UPDATE
                    bill_name = VALUES(bill_name), proc_result_cd = VALUES(proc_result_cd), proc_result_name = VALUES(proc_result_name), bill_topic = VALUES(bill_topic), updated_at = NOW()
            `);
            billsAffected = billResult.affectedRows;
            
            // 껍데기 법안 생성 (bill_no 반영)
            const [placeholderResult] = await connection.execute(`
                INSERT IGNORE INTO bills (bill_id, bill_no, bill_name, link_url, bill_kind_cd)
                SELECT DISTINCT t.bill_id, t.bill_no, '정보 수집 필요', '', ${BILL_KIND.UNKNOWN.ID}
                FROM temp_bill_votes t
                LEFT JOIN bills b ON t.bill_id = b.bill_id
                WHERE b.bill_id IS NULL
            `);
            placeholdersAffected = placeholderResult.affectedRows;
            if (placeholdersAffected > 0) {
                logger.warn(`- Placeholder Bills: ${placeholdersAffected} 개의 '정보 없음' 법안을 추가했습니다. (FK 제약 조건 충족 목적)`);
            }
            
            const [coProposerResult] = await connection.execute(`
                INSERT IGNORE INTO bill_co_proposers (bill_id, bill_no, mona_cd, proposer_yn)
                SELECT bill_id, bill_no, mona_cd, proposer_yn FROM temp_bill_co_proposers
            `);
            coProposersAffected = coProposerResult.affectedRows;

            const [voteResult] = await connection.execute(`
                INSERT IGNORE INTO bill_votes 
                    (bill_id, bill_no, mona_cd, vote_result, vote_date)
                SELECT 
                    bill_id, bill_no, mona_cd, vote_result, vote_date 
                FROM 
                    temp_bill_votes
            `);
            votesAffected = voteResult.affectedRows;
            
            // ✅ API 원본 카운트 업데이트 로직 (2가지 컬럼 분리 업데이트)
            const updatePromises = [];
            for (const [monaCd, apiCount] of apiBillCountUpdateMap.entries()) {
                const updateSql = `UPDATE politicians SET last_bill_api_count = ? WHERE mona_cd = ?`;
                updatePromises.push(connection.execute(updateSql, [apiCount, monaCd]));
            }
            for (const [monaCd, apiCount] of apiVoteCountUpdateMap.entries()) {
                const updateSql = `UPDATE politicians SET last_vote_api_count = ? WHERE mona_cd = ?`;
                updatePromises.push(connection.execute(updateSql, [apiCount, monaCd]));
            }
            await Promise.all(updatePromises);

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
runBillSync(ASSEMBLY_AGE_TO_SYNC, testLimit);