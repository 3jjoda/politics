import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * [1단계] 위원회-주제 매핑 테이블
 * (이하 COMMITTEE_TOPIC_MAP 정의는 이전과 동일)
 */
const COMMITTEE_TOPIC_MAP = new Map([
    // 1: 보건/복지/의료
    ['보건복지위원회', 1],
    ['보건복지가족위원회', 1],
    ['여성가족위원회', 1],
    ['저출산고령화대책특별위원회', 1],
    ['아동·여성대상 성폭력 대책 특별위원회', 1],
    ['성평등가족위원회', 1],
    ['국회 코로나19 대책 특별위원회', 1],
    ['장애인에 대한 성폭력 등 인권침해 방지대책특별위원회', 1],
    ['여성위원회', 1],

    // 2: 교육/인재/학술
    ['교육위원회', 2],
    ['교육과학기술위원회', 2],

    // 4: 국토/도시/주택
    ['국토교통위원회', 4],
    ['국토해양위원회', 4],

    // 5: 환경/기후/에너지
    ['기후변화대책특별위원회', 5],
    ['공항·발전소·액화천연가스인수기지주변대책특별위원회', 5],
    ['기후위기 특별위원회', 5],
    ['가습기살균제 사고 진상규명과 피해구제 및 재발방지 대책마련을 위한 국정조사특별위원회', 5],
    ['기후변화대응·녹색성장특별위원회', 5],
    ['미세먼지 대책 특별위원회', 5],

    // 6: 농림축산/수산/해양
    ['농림축산식품해양수산위원회', 6],
    ['농림수산식품위원회', 6],
    ['가축전염병예방법개정특별위원회', 6],

    // 7: 조세/재정/금융
    ['기획재정위원회', 7],

    // 8: 산업/기술/R&D
    ['산업통상자원중소벤처기업위원회', 8],
    ['과학기술정보방송통신위원회', 8],
    ['미래창조과학방송통신위원회', 8],
    ['산업통상자원위원회', 8],
    ['지식경제위원회', 8],
    ['세계박람회지원특별위원회', 8],
    ['국회 2030 부산세계박람회 유치지원 특별위원회', 8],

    // 9: 행정/공공/사법
    ['법제사법위원회', 9],
    ['행정안전위원회', 9],
    ['안전행정위원회', 9],
    ['사법제도개혁특별위원회', 9],
    ['공무원연금개혁 특별위원회', 9],
    ['지방행정체제개편특별위원회', 9],
    ['사법개혁 특별위원회', 9],

    // 10: 안보/국방/병무
    ['국방위원회', 10],
    ['정보위원회', 10],

    // 11: 문화/체육/예술
    ['문화체육관광위원회', 11],
    ['평창동계올림픽 및 국제경기대회지원특별위원회', 11],
    ['국제경기대회개최 및 유치지원특별위원회', 11],
    ['국제경기대회(세계육상선수권대회, 아시아경기대회, 포뮬러원국제자동차경주대회)지원특별위원회', 11],
    ['평창동계올림픽 및 국제경기대회지원 특별위원회', 11],
    ['2025 아시아태평양경제협력체(APEC) 정상회의 지원 특별위원회', 11],

    // 12: 안전/재난/소방
    ['12.29여객기참사진상규명과피해자및유가족의피해구제를위한특별위원회', 12],
    ['산불피해지원대책 특별위원회', 12],

    // 13: 통일/외교/남북
    ['외교통일위원회', 13],
    ['외교통상통일위원회', 13],

    // 14: 정치/선거/규제
    ['정치개혁특별위원회', 14],
    ['정치개혁 특별위원회', 14],
    ['헌법개정 및 정치개혁 특별위원회', 14],

    // 991: 국회/행정절차
    ['국회운영위원회', 991],
    ['예산결산특별위원회', 991],
    ['윤리특별위원회', 991],
    ['본회의', 991],
    ['국회법및국회상임위원회위원정수에관한규칙개정특별위원회', 991],
    ['국회상임위원회 위원 정수에 관한 규칙 개정 특별위원회', 991],
    ['국회상임위원회 위원정수에 관한 규칙 개정 특별위원회', 991],

    // 992: 정치/외교 이벤트
    ['윤석열정부의비상계엄선포를통한내란혐의진상규명국정조사특별위원회', 992],
    ['용산 이태원 참사 진상규명과 재발방지를 위한 국정조사특별위원회', 992],
    ['박근혜정부의최순실등민간인에의한국정농단의혹사건진상규명을위한국정조사특별위원회', 992]
]);


/**
 * 메인 실행 함수
 */
async function runCommitteeUpdate() {
    logger.info('[1차 배치 START] 위원회(committee) 기준 일괄 분류를 시작합니다.');
    const pool = new pg.Pool(dbConfig);
    const startTime = Date.now();
    let totalUpdated = 0;

    const TARGET_CODES = 'bill_topic_cd IS NULL OR bill_topic_cd = 993 OR bill_topic_cd = 998';
    let keywordTargetCount = 0;
    try {
        logger.info('[1차 배치] 1:1 매핑 및 991/992 분류를 시작합니다...');

        for (const [committeeName, topicCode] of COMMITTEE_TOPIC_MAP.entries()) {

            // [!!! 수정됨 !!!] Map의 Key(committeeName)도 TRIM 하여 비교 안전성 확보
            const cleanCommitteeName = committeeName.trim();

            const result = await pool.query(
                `UPDATE bills
                 SET bill_topic_cd = $1
                 WHERE TRIM(committee) = $2
                   AND (${TARGET_CODES})`,
                [topicCode, cleanCommitteeName] // 수정된 cleanCommitteeName 사용
            );

            if (result.rowCount > 0) {
                logger.info(`- [${cleanCommitteeName}] $\rightarrow$ 코드 [${topicCode}] (${result.rowCount}건 처리)`);
                totalUpdated += result.rowCount;
            }
        }
        logger.info('[1차 배치] 1:1 매핑 분류 완료.');

        // 4. 2차 분류 대상(키워드)이 될 위원회 목록 집계 (로깅용)
        const { rows: unprocessedRows } = await pool.query(
            `SELECT DISTINCT TRIM(committee) as committee, COUNT(*) as count
             FROM bills
             WHERE ${TARGET_CODES}
             GROUP BY TRIM(committee)`
        );

        logger.warn('\n--- [2차 배치 대상] ---');
        logger.warn('1차 분류에서 제외된 위원회 목록 (2차 키워드 분류 대상):');

        for (const row of unprocessedRows) {
            // 1:1 매핑에 없었던 위원회들
            if (row.committee && !COMMITTEE_TOPIC_MAP.has(row.committee)) {
                logger.warn(`- ${row.committee}: ${row.count}건`);
                keywordTargetCount += row.count;
            } else if (!row.committee) {
                 logger.error(`- [위원회 NULL 또는 공백]: ${row.count}건 (확인 필요)`);
            }
        }
        logger.warn(`(총 ${keywordTargetCount}건의 법안이 2차 키워드 분류 대상입니다.)`);
        logger.warn(`------------------------\n`);


    } catch (error) {
        logger.error('[1차 배치 FAILED] 심각한 오류 발생:', error);
    } finally {
        await pool.end();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`\n[1차 배치 SUCCESS] 총 ${totalUpdated}건의 법안이 위원회 기준으로 분류되었습니다.`);
        logger.warn(`이제 ${keywordTargetCount}건의 법안에 대해 [2차 배치 (topicUpdate.js)]를 실행해야 합니다.`);
        logger.info(`총 소요 시간: ${duration}초`);
        logger.info('[1차 배치 END]');
    }
}

// 배치 실행
runCommitteeUpdate();