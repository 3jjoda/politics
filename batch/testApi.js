// C:\dev\politics\batch\testApiFinal.js (The True Final - with Robust Parsing)

import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import logger from '../utils/logger.js';
import pLimit from 'p-limit';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/**
 * [진단 및 해결] Open API의 모든 페이지를 가져오는, 더 견고해진 함수
 */
async function fetchAllVotesFromOpenApi_Diagnostic(billIdSet) {
    const allVotes = [];
    const limit = pLimit(10);
    
    const promises = Array.from(billIdSet).map(billId => limit(async () => {
        const collectedForThisBill = [];
        let pageIndex = 1;
        let totalPages = 1;

        do {
            try {
                const url = `https://open.assembly.go.kr/portal/openapi/nojepdqqaweusdfbi?AGE=22&BILL_ID=${billId}&pIndex=${pageIndex}&pSize=300`;
                logger.debug(`[VOTE API] Requesting -> ${billId} (Page ${pageIndex})`);
                const response = await axios.get(url, { responseType: 'text' });
                const result = await parseStringPromise(response.data);
                
                // ▼▼▼ [✨핵심 수정✨] 응답 구조가 다를 수 있는 모든 예외 상황을 처리합니다. ▼▼"
                
                // 1. "데이터 없음" 또는 "에러" 응답인지 먼저 확인합니다.
                const resultCode = result.RESULT?.CODE?.[0];
                if (resultCode) {
                    if (resultCode === 'INFO-200') {
                        if (pageIndex === 1) logger.info(`[VOTE API] ℹ️ Info: No vote data exists for ${billId} (INFO-200).`);
                    } else {
                        logger.error(`[VOTE API] ❌ Error from API for ${billId}: ${result.RESULT.MESSAGE[0]} (Code: ${resultCode})`);
                    }
                    break; // "데이터 없음" 또는 에러이므로 이 billId에 대한 작업 중단
                }

                // 2. 정상 응답일 경우에만 데이터 처리를 시도합니다.
                const root = result.nojepdqqaweusdfbi;
                if (!root) {
                    logger.warn(`[VOTE API] ⚠️ Warning: Invalid XML structure for ${billId}. 'nojepdqqaweusdfbi' root element not found.`);
                    break;
                }
                
                const head = root.head?.[0];
                const voteList = root.row;

                if (voteList && Array.isArray(voteList)) {
                    logger.info(`[VOTE API] ✅ Success: Found ${voteList.length} vote records for ${billId} on page ${pageIndex}.`);
                    collectedForThisBill.push(...voteList);
                } else {
                    if (pageIndex > 1) logger.info(`[VOTE API] ℹ️ Info: No more vote data on page ${pageIndex} for ${billId}.`);
                    break;
                }
                
                if (pageIndex === 1 && head?.list_total_count?.[0]) {
                    const totalRecords = parseInt(head.list_total_count[0], 10);
                    totalPages = Math.ceil(totalRecords / 300);
                    logger.info(`[VOTE API] Total pages for ${billId}: ${totalPages} (${totalRecords} records)`);
                }

                if (pageIndex >= totalPages) break;
                
                pageIndex++;
                await sleep(200);
                // ▲▲▲ 여기까지 수정 ▲▲▲

            } catch (error) {
                logger.error(`[VOTE API] ❌ Critical Error processing ${billId} on page ${pageIndex}:`, error.message);
                break;
            }
        } while (true);
        
        return collectedForThisBill;
    }));
    
    const results = await Promise.all(promises);
    return results.flat().filter(Boolean);
}

async function main() {
    logger.info(`--- [Open API Diagnostic Start] ---`);
    
    const testBillIdSet = new Set([
        'PRC_O2N4L1M1U2U0T1T6S1S0R3Y4Z9Y3Y9', // 강경숙: 데이터 있음
        'PRC_R2A3U1V0L2L9C1T7O3V1L2Y6A5U4W6', // 고민정: 데이터 있음
        'PRC_NON_EXISTENT_ID_12345',         // 일부러 없는 ID (INFO-200 예상)
    ]);

    logger.info(`${testBillIdSet.size}개의 법안 ID로 표결 정보 조회를 테스트합니다...`);
    const allVotes = await fetchAllVotesFromOpenApi_Diagnostic(testBillIdSet);
    
    logger.info(`\n--- [Diagnostic Finished] ---`);
    logger.info(`최종적으로 수집된 총 표결 기록 건수: ${allVotes.length}`);
    
    if (allVotes.length > 0) {
        logger.info("✅ 테스트 성공! Open API로부터 모든 페이지의 데이터를 성공적으로 수집했습니다.");
    } else {
        logger.error("❌ 테스트 실패! 여전히 데이터를 가져오지 못하고 있습니다.");
    }
}

main();