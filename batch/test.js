// testApiCall.js
import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import WebScraper from '../utils/webScraper.js'; // WebScraper 모듈 임포트

const API_BASE_URL = 'https://www.assembly.go.kr/portal/assm/assmPrpl/';

const TEST_ASSEMBLY_AGE = '22';
const TEST_ROWS_PER_PAGE = 10;

// WebScraper 인스턴스 생성
const scraper = new WebScraper();

async function runTest() {
    logger.info('[API Test START] 단일 의원, 단일 API 호출 테스트를 시작합니다.');
    const pool = new pg.Pool(dbConfig);
    const client = await pool.connect();

    try {
        // DB에서 첫 번째 의원 정보 가져오기
        const { rows: politicians } = await client.query('SELECT mona_cd, name FROM politicians WHERE active_yn = TRUE LIMIT 1');

        if (politicians.length === 0) {
            logger.warn('테스트할 정치인 정보가 없습니다. politicians 테이블을 먼저 채워주세요.');
            return;
        }

        const testPolitician = politicians[0];
        const monaCd = testPolitician.mona_cd; // DB에서 가져온 컬럼 이름 그대로 사용
        logger.info(`테스트 대상 의원: ${testPolitician.name} (${monaCd})`);

        // 초기 페이지 로드 및 CSRF 토큰/쿠키 획득 (Referer URL 기반)
        const initialPageUrl = `https://www.assembly.go.kr/portal/assm/assmPrpl/prplMst.do?monaCd=${monaCd}&st=${TEST_ASSEMBLY_AGE}&viewType=CONTBODY&tabId=repbill`;
        const initialized = await scraper.initialize(initialPageUrl);
        if (!initialized) {
            logger.error('[API Test FAILED] Scraper 초기화 실패.');
            return;
        }

        // 대표 발의 법안 API 호출 테스트
        logger.info(`[테스트] ${testPolitician.name} 의원의 대표 발의 법안을 가져오는 중...`);
        // const apiResponse = await scraper.postData(
        //     'findRepPrpsBill.json',
        //     {
        //         monaCd: monaCd,
        //         age: TEST_ASSEMBLY_AGE,
        //         pageIndex: 1,
        //         rowPerPage: TEST_ROWS_PER_PAGE,
        //         pageLink: 'doActionRepBill.goPage',
        //         represent: '법률안',
        //         procResultCd: '',
        //         billName: ''
        //     },
        //     initialPageUrl // Referer URL로 초기 페이지 URL 전달
        // );
        // const apiResponse = await scraper.postData(
        //     'findCollaPrpsBill.json',
        //     {
        //         monaCd: monaCd,
        //         age: TEST_ASSEMBLY_AGE,
        //         pageIndex: 1,
        //         rowPerPage: TEST_ROWS_PER_PAGE,
        //         pageLink: 'doActionRepBill.goPage',
        //         represent: '법률안',
        //         procResultCd: '',
        //         billName: ''
        //     },
        //     initialPageUrl // Referer URL로 초기 페이지 URL 전달
        // );
        const apiResponse = await scraper.postData(
            'findAssmVoteResult.json',
            {
                monaCd: monaCd,
                age: TEST_ASSEMBLY_AGE,
                pageIndex: 1,
                rowPerPage: TEST_ROWS_PER_PAGE,
                pageLink: 'doActionRepBill.goPage',
                represent: '법률안',
                procResultCd: '',
                billName: ''
            },
            initialPageUrl // Referer URL로 초기 페이지 URL 전달
        );

        if (apiResponse && apiResponse.resultList) {
            logger.info(`API 호출 성공! 총 페이지: ${apiResponse.paginationInfo.totalPageCount}, 총 레코드: ${apiResponse.paginationInfo.totalRecordCount}`);
            logger.info('첫 번째 법안 데이터 예시:', JSON.stringify(apiResponse.resultList[0], null, 2));
            logger.info('[API Test SUCCESS] 테스트가 성공적으로 완료되었습니다.');
        } else {
            logger.error('[API Test FAILED] API 응답이 없거나, resultList가 비어있습니다. 자세한 에러 로그를 확인하세요.');
        }

    } catch (error) {
        logger.error('[API Test FAILED] 테스트 중 예상치 못한 오류 발생:', error);
    } finally {
        if (client) {
            client.release();
        }
        await pool.end();
        logger.info('[API Test END] 테스트가 종료되었습니다.');
    }
}

runTest();