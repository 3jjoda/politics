import cron from 'node-cron';
import axios from 'axios';
import mysql from 'mysql2/promise';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';

// API 호출을 위한 기본 설정
const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY;
const API_URL = 'https://open.assembly.go.kr/portal/openapi/nwvrqwxyaytdsfvhu';
// URL에서 Service ID를 추출 (코드의 유연성을 위해)
const SERVICE_ID = API_URL.split('/').pop();

/**
 * 열린국회정보포털 API에서 현직 국회의원 목록을 가져오는 함수
 */
async function fetchPoliticiansFromAPI() {
    try {
        const response = await axios.get(API_URL, {
            params: {
                KEY: API_KEY,
                Type: 'json', // 성공한 URL의 파라미터(대문자 T)를 그대로 사용
                pIndex: 1,
                pSize: 500
            }
        });

        // ===== [수정됨] 실제 응답 데이터 경로로 변경 =====
        if (response.data && response.data[SERVICE_ID]) {
            // response.data['nwvrqwxyaytdsfvhu'][1].row 경로의 데이터를 반환
            return response.data[SERVICE_ID][1].row;
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
 * DB에 국회의원 정보를 'Bulk Upsert' 하고, Insert/Update 건수를 분리하여 기록하는 함수
 */
async function upsertPoliticiansToDB(pool, politicians) {
    const connection = await pool.getConnection();
    try {
        const start = Date.now();

        const [parties] = await connection.execute('SELECT PARTY_ID, PARTY_NAME FROM PARTIES');
        const partyMap = new Map();
        parties.forEach(party => partyMap.set(party.PARTY_NAME, party.PARTY_ID));

        const valueClauses = [];
        const params = [];

        for (const politician of politicians) {
            const {
                MONA_CD: mona_cd,
                HG_NM: name,
                ENG_NM: eng_name,
                POLY_NM: party_name,
                ORIG_NM: electoral_district,
                BTH_DATE: birthday
            } = politician;

            const party_id = partyMap.get(party_name) || null;
            if (!party_id) {
                logger.warn(`'${party_name}' 정당을 찾을 수 없어 의원(${name}) 데이터는 건너뜁니다.`);
                continue;
            }

            // [수정됨] VALUES 절의 ? 개수를 6개로 수정
            valueClauses.push('(?, ?, ?, ?, ?, ?)');
            // [수정됨] params에 eng_name 추가 (총 6개)
            params.push(mona_cd, name, eng_name, party_id, electoral_district, birthday);
        }
        
        if (valueClauses.length === 0) {
            logger.info("[배치] 업데이트할 의원 데이터가 없습니다.");
            connection.release();
            return;
        }

        // [수정됨] SQL 문을 파라미터 개수에 맞게 최종 수정
        const sql = `
            INSERT INTO POLITICIANS (MONA_CD, NAME, ENG_NM, PARTY_ID, ELECTORAL_DISTRICT, BIRTHDAY, INS_DATETIME)
            VALUES ${valueClauses.map(clause => clause.replace(')', ', NOW())')).join(', ')}
            ON DUPLICATE KEY UPDATE
                NAME = VALUES(NAME),
                ENG_NM = VALUES(ENG_NM),
                PARTY_ID = VALUES(PARTY_ID),
                ELECTORAL_DISTRICT = VALUES(ELECTORAL_DISTRICT),
                BIRTHDAY = VALUES(BIRTHDAY),
                UPD_DATETIME = NOW()
        `;

        // Bulk Insert를 위해 params 배열을 재구성합니다.
        // valueClauses를 수정했으므로, 6개의 파라미터를 그대로 사용합니다.
        const [result] = await connection.execute(sql, params);

        const totalProcessed = valueClauses.length;
        const affectedRows = result.affectedRows;
        
        const updatedCount = affectedRows - totalProcessed;
        const insertedCount = totalProcessed - updatedCount;

        const duration = Date.now() - start;
        const timeTag = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`;

        logger.info(`[배치 성공] 신규 추가: ${insertedCount}건, 정보 업데이트: ${updatedCount}건 /* ${timeTag} */`);

    } catch (error) {
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
    
    const pool = mysql.createPool(dbConfig);
    
    const politiciansFromAPI = await fetchPoliticiansFromAPI();
    
    if (politiciansFromAPI && politiciansFromAPI.length > 0) {
        // [중요] Parties 테이블에 API에 있는 정당 이름들이 미리 들어가 있어야 합니다.
        // 예: '국민의힘', '더불어민주당' 등
        await upsertPoliticiansToDB(pool, politiciansFromAPI);
    }
    
    await pool.end();
    logger.info('[배치 종료] 국회의원 데이터 동기화가 완료되었습니다.');
}

// ==== 스케줄러 설정 ====
cron.schedule('0 4 * * *', () => {
    runSync();
}, {
    scheduled: true,
    timezone: "Asia/Seoul"
});

logger.info('국회의원 데이터 동기화 배치가 설정되었습니다. (매일 새벽 4시 실행)');

// 즉시 실행
runSync();