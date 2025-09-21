import cron from 'node-cron';
import axios from 'axios';
import mysql from 'mysql2/promise'; // Promise 기반으로 비동기 처리를 쉽게 하기 위함
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';

// API 호출을 위한 기본 설정
const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY; // .env 파일에 API 키 추가 필요!
const API_URL = 'https://open.assembly.go.kr/portal/openapi/getMemberCurrStateList';

/**
 * 열린국회정보포털 API에서 현직 국회의원 목록을 가져오는 함수
 */
async function fetchPoliticiansFromAPI() {
    try {
        const response = await axios.get(API_URL, {
            params: {
                KEY: API_KEY,
                Type: 'json',
                pIndex: 1,      // 첫 번째 페이지
                pSize: 500      // 충분히 큰 숫자로 한번에 모든 데이터 가져오기
            }
        });

        // API 응답 구조에 따라 실제 데이터가 있는 경로를 정확히 지정해야 합니다.
        // 예시: response.data.getMemberCurrStateList[1].row
        if (response.data && response.data.getMemberCurrStateList) {
            return response.data.getMemberCurrStateList[1].row;
        } else {
            logger.error('API 응답에서 유효한 데이터를 찾을 수 없습니다.');
            logger.error('실제 API 응답:', JSON.stringify(response.data, null, 2));
            return [];
        }
    } catch (error) {
        logger.error('API 호출 중 오류 발생:', error.message);
        return [];
    }
}

/**
 * DB에 국회의원 정보를 'Upsert' (Update or Insert) 하는 함수
 * @param {mysql.Pool} pool - DB 커넥션 풀
 * @param {Array} politicians - API로부터 받아온 의원 목록
 */
async function upsertPoliticiansToDB(pool, politicians) {
    let insertedCount = 0;
    let updatedCount = 0;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        for (const politician of politicians) {
            const {
                MONA_CD: mona_cd,
                HG_NM: name,
                POLY_NM: party_name,
                ORIG_NM: electoral_district,
                BTH_DATE: birthday
            } = politician;

            const sql = `
                INSERT INTO Politicians (MONA_CD, NAME, PARTY_ID, ELECTORAL_DISTRICT, BIRTHDAY)
                VALUES (?, ?, (SELECT PARTY_ID FROM PARTIES WHERE PARTY_NAME = ?), ?, ?)
                ON DUPLICATE KEY UPDATE
                    NAME = VALUES(NAME),
                    PARTY_ID = (SELECT PARTY_ID FROM PARTIES WHERE PARTY_NAME = ?),
                    ELECTORAL_DISTRICT = VALUES(ELECTORAL_DISTRICT),
                    BIRTHDAY = VALUES(BIRTHDAY)
            `;
            
            // party_id를 찾기 위해 party_name을 두 번 사용합니다.
            const params = [mona_cd, name, party_name, electoral_district, birthday, party_name];
            
            const [result] = await connection.execute(sql, params);

            if (result.affectedRows === 1) {
                insertedCount++;
            } else if (result.affectedRows === 2) { // ON DUPLICATE KEY UPDATE 시 2가 반환됨
                updatedCount++;
            }
        }

        await connection.commit();
        logger.info(`[배치 성공] 신규 추가: ${insertedCount}명, 정보 업데이트: ${updatedCount}명`);

    } catch (error) {
        await connection.rollback();
        logger.error('[배치 실패] DB 작업 중 오류 발생:', error.message);
    } finally {
        connection.release();
    }
}

/**
 * 전체 동기화 작업을 실행하는 메인 함수
 */
async function runSync() {
    logger.info('[배치 시작] 국회의원 데이터 동기화를 시작합니다.');
    
    // DB 커넥션 풀 생성
    const pool = mysql.createPool(dbConfig);
    
    // 1. API에서 데이터 가져오기
    const politiciansFromAPI = await fetchPoliticiansFromAPI();
    
    if (politiciansFromAPI.length > 0) {
        // 2. DB에 데이터 동기화하기
        await upsertPoliticiansToDB(pool, politiciansFromAPI);
    }
    
    // 작업 완료 후 커넥션 풀 닫기
    await pool.end();
    logger.info('[배치 종료] 국회의원 데이터 동기화가 완료되었습니다.');
}

// ==== 스케줄러 설정 ====
// 매일 새벽 4시에 runSync 함수를 실행하도록 스케줄링합니다.
cron.schedule('0 4 * * *', () => {
    runSync();
}, {
    scheduled: true,
    timezone: "Asia/Seoul"
});

logger.info('국회의원 데이터 동기화 배치가 설정되었습니다. (매일 새벽 4시 실행)');

// (선택) 서버 시작 시 한번 즉시 실행하고 싶을 때
runSync();