// C:\dev\web\politics\jobs\syncMissingBillDetails.js (최종 운영 버전)

import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import pLimit from 'p-limit';
import axios from 'axios';
import { format } from 'date-fns';

// ✅ 환경 설정 (고객님의 환경 변수에서 KEY를 로드합니다. 테스트에서는 하드코딩된 값이었음)
const SERVICE_KEY = process.env.OPEN_ASSEMBLY_API_KEY;
const DETAIL_API_ENDPOINT = 'https://open.assembly.go.kr/portal/openapi/';
const SERVICE_ID = 'ALLBILL';
const CONCURRENT_LIMIT = 10;
const INFO_REQUIRED_CODE = 999;

// --- 유틸리티 함수 ---
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// API 응답에서 날짜 형식 'YYYYMMDD'를 'YYYY-MM-DD'로 변환
function formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return null;
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

// --- API 호출 함수 (GET 요청 확정 및 Service ID/Key 사용) ---
async function fetchBillDetails(billNo, ageCd) {
    const fullUrl = `${DETAIL_API_ENDPOINT}${SERVICE_ID}`;

    // ✅ GET 요청의 params 객체에 모든 필수 인자 포함
    const params = {
        KEY: SERVICE_KEY,
        BILL_NO: billNo,
        Type: 'json',
        pIndex: 1,
        pSize: 1, // 단건 조회
        // ageCd는 필요 없는 것으로 판단했으나, API가 요구할 경우를 대비하여 추가 가능
        // ...(ageCd && { AGE: ageCd })
    };

    try {
        const response = await axios.get(fullUrl, {
            params: params,
            timeout: 5000
        });

        const result = response.data;

        // --- 1. 응답 헤더(head) 검증 ---
        const head = result.ALLBILL[0].head[1].RESULT;
        const resultCode = head.CODE;
        const resultMessage = head.MESSAGE;

        if (resultCode !== 'INFO-000') {
            if (resultCode !== 'INFO-200') {
                logger.warn(`[API ERROR] BILL_NO ${billNo}. Code: ${resultCode}. Msg: ${resultMessage}`);
            }
            return null; // 데이터가 없거나 에러
        }

        // --- 2. 데이터 유효성 검증 (INFO-000, 즉 정상 데이터가 있을 때만 실행) ---
        if (result.ALLBILL[1].row && result.ALLBILL[1].row.length > 0) {
            // ✅ API 필드명(대문자)에 맞춰 데이터 추출
            const data = result.ALLBILL[1].row[0];

            // billKindCd를 1 또는 2의 INT 코드로 변환
            let billKindCd = null;
            if (data.BILL_KND === '법률안') billKindCd = 1;
            else if (data.BILL_KND === '기타의안') billKindCd = 2;

            return {
                billName: data.BILL_NM,
                billKindCd: billKindCd,
                ageCd: data.AGE_CD || data.ERACO, // AGE_CD 또는 ERACO 사용
                ageName: data.AGE_NM || data.ERACO,
                proposerKindCd: data.PPSR_KND,
                proposerName: data.PPSR_NM,
                monaCd: data.MONA_CD || null,
                coProposerCount: parseInt(data.CO_PPSR_CNT, 10) || 0,
                proposeDt: formatDate(data.PPSL_DT),
                committee: data.JRCMIT_NM,
                committeeId: data.JRCMIT_ID || null,
                procResultCd: data.RGS_CONF_RSLT || data.LAW_PROC_RSLT || null,
                procResultName: data.RGS_CONF_NM || data.LAW_PROC_RSLT || null,
                linkUrl: data.LINK_URL,
            };
        }
        return null; // INFO-000이지만 row가 비어있는 경우

    } catch (error) {
        logger.error(`[HTTP FAIL] BILL_NO: ${billNo}. Error: ${error.message}`);
        return null;
    }
}

// --- 메인 배치 로직 ---
async function runMissingDetailSync() {
    logger.info(`[Missing Detail Sync START] 누락 법안 상세 정보 보완을 시작합니다. (GET Mode)`);
    const pool = new pg.Pool(dbConfig);
    const startTime = Date.now();
    let totalUpdated = 0;

    try {
        // 1. 껍데기 법안 대상 목록 조회 (bill_topic_cd = 999)
        const { rows: code999 } = await pool.query("SELECT code_id FROM codes WHERE group_code = 'BILL_TOPIC' AND code_id = 999");
        const INFO_REQUIRED_CODE_ID = code999.length > 0 ? code999[0].code_id : INFO_REQUIRED_CODE;

        // age_cd도 함께 가져옴 (fetchBillDetails에 전달하여 API 안정성 확보)
        const { rows: missingBills } = await pool.query(`
            SELECT bill_id, bill_no, age_cd
            FROM bills
            WHERE bill_topic_cd = $1
            AND bill_no IS NOT NULL AND bill_topic_cd = 999
        `, [INFO_REQUIRED_CODE_ID]);

        const totalMissing = missingBills.length;
        if (totalMissing === 0) {
            logger.info('처리할 누락 법안이 없습니다. 종료합니다.');
            return;
        }
        logger.warn(`총 ${totalMissing}개의 누락 법안 상세 정보를 보완합니다. (동시 호출: ${CONCURRENT_LIMIT})`);

        const limit = pLimit(CONCURRENT_LIMIT);
        const updatePromises = [];
        let billsProcessed = 0;

        // 2. 병렬 API 호출 및 DB 업데이트
        for (const bill of missingBills) {
            updatePromises.push(limit(async () => {
                await sleep(Math.random() * 200);
                const details = await fetchBillDetails(bill.bill_no, bill.age_cd);

                if (details && details.billName) {
                    // 3. 데이터 UPDATE (Topic 재분류를 위해 NULL로 초기화)
                    const updateResult = await pool.query(`
                        UPDATE bills
                        SET bill_name = $1, bill_kind_cd = $2, age_cd = $3, age_name = $4,
                            proposer_kind_cd = $5, proposer_name = $6, mona_cd = $7,
                            co_proposer_count = $8, propose_dt = $9, committee = $10,
                            committee_id = $11, proc_result_cd = $12, proc_result_name = $13,
                            link_url = $14, bill_topic_cd = NULL
                        WHERE bill_id = $15
                    `, [
                        details.billName, details.billKindCd, details.ageCd, details.ageName,
                        details.proposerKindCd, details.proposerName, details.monaCd,
                        details.coProposerCount, details.proposeDt, details.committee,
                        details.committeeId, details.procResultCd, details.procResultName,
                        details.linkUrl, bill.bill_id
                    ]);

                    if (updateResult.rowCount > 0) {
                        logger.info(`[UPDATE SUCCESS] Bill ${bill.bill_no}: ${details.billName} 상세 정보 보완 완료.`);
                        totalUpdated++;
                    }
                } else {
                     logger.warn(`[SKIP/FAIL] Bill ${bill.bill_no}: API 데이터 누락 또는 호출 실패.`);
                }

                billsProcessed++;
                if (billsProcessed % 100 === 0 || billsProcessed === totalMissing) {
                    logger.info(`[진행률] 처리 완료: ${billsProcessed}건, 잔여: ${totalMissing - billsProcessed}건`);
                }
            }));
        }

        await Promise.all(updatePromises);

        logger.info(`[Missing Detail Sync END] 총 ${totalMissing}건 중 ${totalUpdated}건 보완 완료.`);

    } catch (error) {
        logger.error(`[Missing Detail Sync FAILED] 심각한 오류 발생:`, error);
    } finally {
        await pool.end();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`총 소요 시간: ${duration}초`);
    }
}

runMissingDetailSync();