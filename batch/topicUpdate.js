// C:\dev\politics\jobs\updateBillTopics.js (진행률 로깅 반영)

import mysql from 'mysql2/promise';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import pLimit from 'p-limit';
import fs from 'fs'; 
import path from 'path'; 
import { format } from 'date-fns'; // format is not defined 에러 해결

// --- [정의] 상수 및 키워드 (syncBills.js와 동일해야 함) ---
const CONCURRENT_UPDATE_LIMIT = 50; // 동시 업데이트 개수 설정
const TOPIC_REVIEW_FILE = path.join(process.cwd(), 'data', 'new_topic_review_list_review.txt'); 

const TOPIC_KEYWORDS = {
    '보건/복지/의료': ['국민건강보험', '의료', '치매', '환자', '간호', '장애인복지', '노인복지', '영유아보육', '국민연금', '기초연금', '정신건강', '응급의료', '후천성면역결핍', '희귀질환', '돌봄', '보건', '요양', '간호법', '소아청소년', '산모', '자살예방', '의료급여', '치매관리', '장기요양', '복지', '약사법', '건강', '구강보건', '노인복지법', '동물보호', '은둔형 외톨이', '장애인권리보장', '아토피질환', '장애인권리보장법', '장애인활동지원'],
    '교육/인재/학술': ['교육', '학교', '학생', '대학', '사립학교', '학술', '직업교육', '평생교육', '영재교육', '교원', '학점인정', '과학관', '사관학교', '인재', '교과용', '변호사시험', '만 나이', '청소년활동', '한국교육학술정보원', '한국대학교육협의회', '기초학력', '과학기술인', '연구개발', '이공계', '지방교육자치', '이공계지원', '교원의 지위', '유아교육', '군인사관학교', '대학도서관', '교육시설', '교육환경', '학교급식', '학원', '특수교육', '학교폭력', '자퇴', '학력', '독학'],
    '노동/고용/자영업': ['근로', '노동조합', '임금', '고용', '소상공인', '자영업', '직능인', '필수노동자', '기간제', '파견근로', '산재', '경력단절', '일자리', '노동', '최저임금', '근로자직업능력', '남녀고용평등', '채용', '근로자의 날', '퇴직급여', '임금채권', '실업자', '노동소송', '외국인근로자', '플랫폼종사자', '노동'],
    '국토/도시/주택': ['주택', '건축', '도시', '재개발', '도로', '철도', '교통', '부동산', '택지', '주차장', '공동주택', '개발제한구역', '도시재생', '항공', '공항', '물류', '철도안전', '항만', '도선', '유료도로', '토지', '지적', '공간정보', '대심도', '도시철도', '건설기계', '주거약자', '유통시설', '민간임대주택', '스마트워크', '도심', '택시', '승강기', '측량', '공인중개사', '건축물', '노후계획도시', '신항만'],
    '환경/기후/에너지': ['환경', '기후', '탄소', '에너지', '원자력', '폐기물', '자원순환', '소음', '대기', '물관리', '석면', '재활용', '오존층', '토양환경', '하천', '해양환경', '수소', '방사선', '녹색성장', '자연환경', '친환경', '유해화학물질', '수도권 대기', '댐건설', '광업', '배터리', '수질', '산지관리', '바이오가스', '녹색건축', '지하수', '해양폐기물', '유류오염', '미세플라스틱', '태양광', '해상풍력', '액화천연가스'],
    '농림축산/수산/해양': ['농지', '농산물', '어촌', '수산', '축산', '산림', '농림어업', '양곡', '낙농', '김산업', '종자산업', '양봉', '임업', '가축', '어선', '해양', '수산식품', '수산자원', '농어촌', '농업재해', '농어업회의소', '수산업협동조합', '한우', '목재', '간척지', '농약', '양식', '갯벌', '농업인', '토종닭', '식물방역', '소금산업', '광업', '한약이력추적', '수산직접지불제'],
    '조세/재정/금융': ['조세', '세법', '금융', '보험', '국세', '지방세', '국채', '예금자', '자산관리', '신용보증', '증권거래세', '상속세', '법인세', '부가가치세', '주세', '특정 금융거래', '은행법', '지방재정', '복권기금', '한국은행', '신용', '부담금', '개별소비세', '공공자금', '소득세법', '전자금융거래', '화폐', '투자회사', '파산', '채권', '예금자보호', '부정수표'],
    '산업/기술/R&D': ['산업', '기술', '과학', '정보통신', '반도체', 'AI', '인공지능', '벤처기업', '중소기업', '기술혁신', '지식재산', '소재ㆍ부품ㆍ장비', '디지털', '클라우드', '로봇', '데이터베이스', '특허', '디자인', '정부출연', '뿌리산업', '메타버스', '소프트웨어', '광융합', '초전도', '전기사업', '무역', '해외자원', '기술보증', '엔지니어링', '광물자원공사', '공장설립', '빅데이터'],
    '행정/공공/사법': ['공무원', '지방자치', '공공기관', '민원', '행정심판', '행정절차', '사법', '법원', '헌법재판소', '검찰', '감사원', '공직자윤리', '국민권익', '경찰', '징벌적배상', '정부조직', '주민등록', '민방위', '전자정부', '공익신고자', '부패방지', '지방행정동우회', '지방공기업', '국가공무원', '지방공무원', '공익법인', '공정채용', '법률구조', '법무사', '세무사', '통계법', '헌법재판소법', '국무총리', '국무위원', '정부위원', '출석요구', '운영위원장', '사임'],
    '안보/국방/병무': ['군인', '군사', '국방', '병역', '군형법', '예비군', '군사시설', '방위사업', '군검찰', '국가안보', '군포로', '국군', '군복', '총포', '비상대비', '통합방위', '주한미군', '병무', '군사기밀', '군용', '군수품', '군사경찰', '전투경찰대', '군인사법', '군사기지', '군복무'],
    '문화/체육/예술': ['문화재', '문화', '예술', '체육', '영화', '미디어', '방송', '박물관', '만화', '태권도', '이스포츠', '국악', '한복', '스포츠', '콘텐츠', '독서문화', '음악산업', '문화산업진흥', '무형문화재', '도서관', '공연', '애니메이션', '바둑', '게임산업', '문화유산', '박물관', '체육시설', '문화교류', '신문', '동물원', '식물원'],
    '안전/재난/소방': ['안전관리', '재난', '소방', '화재', '응급의료', '승강기안전', '방사능', '위험물', '경비업', '지진', '119', '사격장', '급경사지', '수상레저', '재해', '석면피해', '해사안전', '교통안전', '경범죄', '긴급구호', '다중이용업소', '화학물질', '전기통신금융사기', '가습기살균제', '소방장비', '경비업', '전기안전', '총포', '안전관리'],
    '통일/외교/남북': ['북한', '남북교류', '통일', '재외국민', '외교', '위안부', '강제동원', '북한이탈주민', '판문점', '개성공단', '한미동맹', '일본정부', '남북관계', '북핵', '미얀마', '우크라이나', '쿠르드', '해외이주', '국제연합', '대일항쟁기', '겨레말큰사전', '남북협력기금', '독립유공자', '6·25', '종전선언', '역사왜곡', '한·아랍재단'],
    '정치/선거/규제': ['공직선거', '국회법', '국민투표', '정당', '규제', '특별검사', '징계안', '탄핵소추', '윤석열', '김건희', '비상계엄', '헌법', '대통령', '사법농단', '선거관리위원회', '정치자금', '인사청문', '법무부장관', '국회의원(징계)', '대통령직인수', '행정안전부장관', '공직자', '공직선거법', '고위공직자범죄수사처', '개헌절차', '국회운영위원장', '국무총리', '국무위원', '정부위원', '출석요구', '국가법안', '국회상설소위원회', '국민참여', '국민공휴일', '정치', '선거', '사임의 건', '의사일정', '출석요구', '국민소환', '특별감찰관'],
    '유통/소비자/공정': ['유통', '소비자', '공정거래', '하도급', '방문판매', '담배', '화장품', '대리점거래', '경품', '상품권', '약관', '전자상거래', '독점규제', '집단소송', '대규모유통업', '온라인플랫폼', '할부거래', '수입식품', '마약류', '전자상거래 등에서의 소비자보호', '소비자보호', '담배사업', '상표법', '지적재산'],
    '99': ['일부개정법률안', '전부개정법률안', '법률안', '특별법안', '기본법안', '폐지법률안', '결의안', '징계안'] 
};


// --- 유틸리티 함수 ---

function classifyTopic(billName) {
    // 1. 법안명 전처리: 소문자 변환 및 일반적인 꼬리말 제거
    let processedName = billName.toLowerCase();
    processedName = processedName.replace(/일부개정법률안|전부개정법률안|법률안|특별법안|기본법안|폐지법률안|결의안|징계안|등에 관한 법률|에 관한 법률/g, ''); 

    for (const topic in TOPIC_KEYWORDS) {
        for (const keyword of TOPIC_KEYWORDS[topic]) {
            // 2. 키워드도 소문자로 변환하여 비교
            if (processedName.includes(keyword.toLowerCase())) {
                return topic; 
            }
        }
    }
    return '기타/일반법/특별';
}

async function logNewTopicForReview(billId, billName) {
    const dir = path.dirname(TOPIC_REVIEW_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const logEntry = `[${timestamp}] [${billId}] 신규 토픽 검토 필요: ${billName}\n`; 

    try {
        fs.appendFileSync(TOPIC_REVIEW_FILE, logEntry);
    } catch (error) {
        logger.error(`[File Write Error] 신규 토픽 파일 저장 실패: ${error.message}`);
    }
}


/**
 * 메인 실행 함수
 */
async function runTopicUpdate() {
    logger.info(`[Topic Update Batch START] bills 테이블 bill_topic 컬럼 일괄 업데이트를 시작합니다.`);
    const pool = mysql.createPool(dbConfig);
    const startTime = Date.now();
    let totalUpdated = 0;
    let newTopicCount = 0;
    
    // ✅ 처리 건수 로깅을 위한 변수
    let billsProcessed = 0;

    try {
        // 1. bills 테이블의 모든 bill_id와 bill_name을 가져옵니다.
        //    (Topic이 NULL인 행만 처리하여 이미 분류된 데이터를 다시 읽지 않도록 최적화)
        const [allBills] = await pool.execute(`
            SELECT bill_id, bill_name 
            FROM bills
            WHERE bill_name != '정보 수집 필요' AND (bill_topic IS NULL OR bill_topic = '기타/일반법/특별') 
        `);

        const totalBillsToProcess = allBills.length;
        if (totalBillsToProcess === 0) {
            logger.info('새로 처리할 법안이 없거나 이미 모두 분류되었습니다. 종료합니다.');
            return;
        }

        logger.info(`총 ${totalBillsToProcess}개의 법안에 대해 Topic 분류를 시작합니다. (동시 업데이트: ${CONCURRENT_UPDATE_LIMIT})`);
        
        const limit = pLimit(CONCURRENT_UPDATE_LIMIT);
        const updatePromises = [];

        // 2. 각 법안에 대해 Topic 분류 및 업데이트 실행
        for (const bill of allBills) {
            updatePromises.push(limit(async () => {
                const newTopic = classifyTopic(bill.bill_name);
                
                // 3. 신규 토픽 검토 대상 로깅
                if (newTopic === '기타/일반법/특별' && !bill.bill_name.includes('일부개정법률안')) {
                    await logNewTopicForReview(bill.bill_id, bill.bill_name);
                    newTopicCount++;
                }

                // 4. DB UPDATE 실행
                const [updateResult] = await pool.execute(`
                    UPDATE bills
                    SET bill_topic = ?
                    WHERE bill_id = ?
                `, [newTopic, bill.bill_id]);

                if (updateResult.affectedRows > 0) {
                    totalUpdated++;
                }
                
                // ✅ 처리 건수 업데이트 및 잔여 건수 로깅
                billsProcessed++;
                if (billsProcessed % 1000 === 0 || billsProcessed === totalBillsToProcess) { // 1,000건 단위로 로그 출력
                    const remaining = totalBillsToProcess - billsProcessed;
                    logger.info(`[진행률] 처리 완료: ${billsProcessed}건, 잔여: ${remaining}건`);
                }
            }));
        }

        await Promise.all(updatePromises);

        logger.info(`[Topic Update Batch SUCCESS] 일괄 업데이트 완료.`);
        logger.info(`- 총 처리 법안 수: ${totalBillsToProcess}건`);
        logger.info(`- Topic 업데이트 성공 수: ${totalUpdated}건`);
        logger.warn(`- 신규 토픽 검토 필요 건수: ${newTopicCount}건 ( ${TOPIC_REVIEW_FILE} 파일 확인 요망)`);

    } catch (error) {
        logger.error(`[Topic Update Batch FAILED] 심각한 오류 발생:`, error);
    } finally {
        await pool.end();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`총 소요 시간: ${duration}초`);
        logger.info(`[Topic Update Batch END]`);
    }
}

// 스크립트 실행
runTopicUpdate();