// C:\dev\politics\batch\testFullData.js (The True Final - Scraping Only & Correct Payload)

import WebScraper from '../utils/webScraper.js';
import logger from '../utils/logger.js';
import pLimit from 'p-limit';

const CONCURRENT_LIMIT = 5;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

const TEST_POLITICIANS = [
    { name: '강경숙', mona_cd: 'T2T8225E', law_rep: 58, etc_rep: 3, law_co: 512, etc_co: 33, votes: 650 },
    { name: '강대식', mona_cd: 'L2I9861C', law_rep: 160, etc_rep: 0, law_co: 1461, etc_co: 124, votes: 3023 },
    { name: '권성동', mona_cd: 'GDG1847Z', law_rep: 185, etc_rep: 13, law_co: 2610, etc_co: 324, votes: 4925 },
    { name: '고민정', mona_cd: 'WCD5518S', law_rep: 80, etc_rep: 4, law_co: 613, etc_co: 225, votes: 3557 },
    { name: '김성환', mona_cd: 'XSP20229', law_rep: 54, etc_rep: 2, law_co: 1329, etc_co: 259, votes: 4369 },
];

/**
 * [검증 완료] 모든 페이지를 스크레이핑하는 범용 함수
 */
async function fetchAllScrapedPages(monaCd, scraper, endpoint, baseParams) {
    const allItems = [];
    let pageIndex = 1;
    let totalPages = 1;
    do {
        const refererUrl = `https://www.assembly.go.kr/portal/assm/assmPrpl/prplMst.do?monaCd=${monaCd}&st=22`;
        const currentParams = { ...baseParams, pageIndex };
        const response = await scraper.postData(endpoint, currentParams, refererUrl);

        if (!response?.resultList?.length) break;
        
        allItems.push(...response.resultList);
        totalPages = response.paginationInfo.totalPageCount;

        if (pageIndex >= totalPages) break;
        
        pageIndex++;
        await sleep(200);
    } while (true);
    return allItems;
}


/**
 * 한 명의 의원에 대한 전체 데이터 수집 작업을 하나로 묶은 '작업 단위' 함수
 */
async function processPolitician(politician) {
    const { name, mona_cd: monaCd } = politician;
    logger.info(`--- [${name}] 작업 시작 ---`);
    
    const scraper = new WebScraper();
    
    try {
        await scraper.initialize(`https://www.assembly.go.kr/portal/assm/assmPrpl/prplMst.do?monaCd=${monaCd}&st=22`);

        const commonBillParams = { monaCd, age: '', rowPerPage: 100, billName: '', procResultCd: '', pageLink: 'doActionRepBill.goPage' };
        
        // 1. 법안/기타의안 정보 수집
        const lawRepBills = await fetchAllScrapedPages(monaCd, scraper, 'findRepPrpsBill.json', { ...commonBillParams, represent: '법률안' });
        const lawCoBills = await fetchAllScrapedPages(monaCd, scraper, 'findCollaPrpsBill.json', { ...commonBillParams, represent: '법률안' });
        const etcRepBills = await fetchAllScrapedPages(monaCd, scraper, 'findRepPrpsEtcBill.json', { ...commonBillParams });
        const etcCoBills = await fetchAllScrapedPages(monaCd, scraper, 'findCollaPrpsEtcBill.json', { ...commonBillParams });

        // ▼▼▼ [✨핵심 수정✨] '표결' API를 위한 정확한 파라미터를 사용합니다. ▼▼▼
        const voteParams = {
            pageLink: 'doActionVote.goPage',
            age: '',
            procResultCd: '',
            bgVoteendDt: '',
            edVoteendDt: '',
            resultVoteMod: '',
            billName: '',
            monaCd: monaCd,
            rowPerPage: 100
        };
        const votes = await fetchAllScrapedPages(monaCd, scraper, 'findAssmVoteResult.json', voteParams);
        // ▲▲▲ 여기까지 수정 ▲▲▲
        
        // 2. 최종 결과 검증
        const results = {
            '법률안(대표)': { collected: lawRepBills.length, expected: politician.law_rep },
            '법률안(공동)': { collected: lawCoBills.length, expected: politician.law_co },
            '기타의안(대표)': { collected: etcRepBills.length, expected: politician.etc_rep },
            '기타의안(공동)': { collected: etcCoBills.length, expected: politician.etc_co },
            '표결': { collected: votes.length, expected: politician.votes },
        };

        let isSuccess = true;
        for (const [key, value] of Object.entries(results)) {
            const match = value.collected === value.expected;
            logger.info(`[${name}] ${key}: ${value.collected}건 수집 (예상: ${value.expected}) ${match ? '✅' : '❌'}`);
            if (!match) isSuccess = false;
        }
        
        if (isSuccess) { 
            logger.info(`--- [${name}] 작업 성공 ---`);
        } else { 
            logger.error(`--- [${name}] 작업 실패: 데이터 건수 불일치 ---`);
        }

    } catch (error) {
        logger.error(`--- [${name}] 작업 실패 ---`, error.message);
    }
}


async function main() {
    logger.info(`--- [Final Test Start] ${CONCURRENT_LIMIT}개의 작업을 동시에 테스트합니다. ---`);
    const limit = pLimit(CONCURRENT_LIMIT);

    const promises = TEST_POLITICIANS.map(politician => {
        return limit(async () => {
            await sleep(Math.random() * 1000); 
            return processPolitician(politician);
        });
    });

    await Promise.all(promises);
    logger.info('\n--- [Final Test Finished] 모든 병렬 작업이 완료되었습니다. ---');
}

main();