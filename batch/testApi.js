// C:\dev\web\politics\jobs\testApi.js (GET 요청 확정 및 JSON 경로 수정)

import 'dotenv/config';
import axios from 'axios';
import logger from '../utils/logger.js'; 

const SERVICE_KEY = process.env.OPEN_ASSEMBLY_API_KEY; 
const DETAIL_API_ENDPOINT = 'https://open.assembly.go.kr/portal/openapi/'; 
const SERVICE_ID = 'ALLBILL'; 
const TEST_BILL_NO = '2004026';

// API 응답에서 날짜 형식 'YYYYMMDD'를 'YYYY-MM-DD'로 변환
function formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return null;
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

async function runTest() {
    logger.info(`[API TEST START] BILL_NO: ${TEST_BILL_NO}에 대한 GET 호출을 시도합니다.`);
    logger.info(`[API TEST START] SERVICE_KEY: ${SERVICE_KEY}`); 

    const fullUrl = `${DETAIL_API_ENDPOINT}${SERVICE_ID}`;
    
    try {
        const response = await axios.get(fullUrl, { 
            params: {
                KEY: SERVICE_KEY,
                Type: 'json',
                pIndex: 1,
                pSize: 1, // 단건 조회를 위해 1로 설정
                BILL_NO: TEST_BILL_NO,
            },
            timeout: 5000 
        });
        
        const result = response.data;
        
        // --- 1. 응답 헤더(head) 검증 ---
        // 경로 수정: ALLBILL[0].head[1].RESULT 객체 접근
        const head = result.ALLBILL[0].head[1].RESULT;
        
        const resultCode = head.CODE;
        const resultMessage = head.MESSAGE;

        const parseHead = JSON.stringify(head); // 로깅용
        
        logger.info(`head: ${parseHead}`);
        
        if (resultCode !== 'INFO-000') {
            logger.warn(`[TEST WARNING] 호출은 성공했으나 데이터 오류 발생. Code: ${resultCode}. Msg: ${resultMessage}`);
            return;
        }

        // --- 2. 데이터 유효성 검증 ---
        if (result.ALLBILL[1].row && result.ALLBILL[1].row.length > 0) {
            const data = result.ALLBILL[1].row[0];
            
            logger.info(`\n\n✅ [API TEST SUCCESS] 데이터 수신 완료.`);
            logger.info(` - 법안 번호: ${data.BILL_NO}`);
            logger.info(` - 법안 이름: ${data.BILL_NM}`);
            logger.info(` - 제안 일자: ${formatDate(data.PROPOSE_DT)}`);
            logger.info(` - 처리 결과: ${data.PROC_RESULT_NM}`);
            logger.info(` - 원본 데이터 (JSON): ${JSON.stringify(data).substring(0, 200)}...`);
            
        } else {
            logger.warn(`[TEST WARNING] INFO-000이 리턴되었으나 row 데이터가 비어있습니다.`);
        }

    } catch (error) {
        logger.error(`[TEST FAIL] HTTP 통신 실패. Error: ${error.message}`);
    } finally {
        logger.info(`[API TEST END]`);
    }
}

runTest();