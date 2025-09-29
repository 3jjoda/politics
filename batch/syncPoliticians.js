import cron from 'node-cron';
import axios from 'axios';
import mysql from 'mysql2/promise';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';

// API 호출을 위한 기본 설정
const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY;
// [중요] 본인의 Service ID로 교체해야 합니다.
const YOUR_SERVICE_ID = 'nwvrqwxyaytdsfvhu'; // 예시 ID입니다.
const API_URL = `https://open.assembly.go.kr/portal/openapi/${YOUR_SERVICE_ID}`;

/**
 * 열린국회정보포털 API에서 현직 국회의원 목록을 가져오는 함수
 */
async function fetchPoliticiansFromAPI() {
    try {
        const response = await axios.get(API_URL, {
            params: {
                KEY: API_KEY,
                // [수정됨] 이전에 성공했던 파라미터(소문자 type)로 수정
                type: 'json',
                pIndex: 1,
                pSize: 500
            }
        });

        if (response.data && response.data[YOUR_SERVICE_ID]) {
            return response.data[YOUR_SERVICE_ID][1].row;
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
 * DB에 국회의원 정보를 'Bulk Upsert'하는 함수 (모든 컬럼対応)
 */
async function upsertPoliticiansToDB(pool, politicians) {
    const connection = await pool.getConnection();
    try {
        const start = Date.now();
        
        const [parties] = await connection.execute('SELECT party_id, party_nm FROM parties');
        const partyMap = new Map(parties.map(p => [p.PARTY_NM, p.PARTY_ID]));

        const records = [];
        for (const p of politicians) {
            const party_id = partyMap.get(p.POLY_NM) || null;
            if (!party_id) {
                logger.warn(`'${p.POLY_NM}' 정당을 DB에서 찾을 수 없어 의원(${p.HG_NM}) 데이터는 건너뜁니다.`);
                continue;
            }
            
            // [수정됨] API의 모든 컬럼을 순서에 맞게 배열에 추가
            records.push([
                p.MONA_CD, p.NAME, p.HJ_NM, p.ENG_NM, p.BTH_GBN_NM, p.BTH_DATE,
                p.JOB_RES_NM, party_id, p.POLY_NM, p.ORIG_NM, p.ELECT_GBN_NM, p.CMITS,
                p.REELE_GBN_NM, p.SEX_GBN_NM, p.TEL_NO, p.E_MAIL, p.HOMEPAGE,
                p.STAFF, p.SECRETARY, p.SECRETARY2, p.MEM_TITLE, p.ASSEM_ADDR,
                new Date() // INS_DATETIME 용
            ]);
        }
        
        if (records.length === 0) {
            logger.info("[배치] 업데이트할 의원 데이터가 없습니다.");
            connection.release();
            return;
        }

        // [수정됨] SQL 문에 모든 컬럼 추가 및 안정적인 Bulk Insert 방식으로 변경
        const sql = `
            INSERT INTO politicians (
                mona_cd, name, hj_nm, eng_nm, bth_gbn_nm, birthday,
                job_res_nm, party_id, party_name, electoral_district, elect_gbn_nm, cmits,
                reele_gbn_nm, sex_gbn_nm, tel_no, e_mail, homepage,
                staff, secretary, secretary2, mem_title, assem_addr, ins_datetime
            )
            VALUES ?
            ON DUPLICATE KEY UPDATE
                name = VALUES(name), hj_nm = VALUES(hj_nm), eng_nm = VALUES(eng_nm), 
                bth_gbn_nm = VALUES(bth_gbn_nm), birthday = VALUES(birthday), job_res_nm = VALUES(job_res_nm), 
                party_id = VALUES(party_id), party_name = VALUES(poly_nm), electoral_district = VALUES(electoral_district), 
                elect_gbn_nm = VALUES(elect_gbn_nm), cmits = VALUES(cmits), reele_gbn_nm = VALUES(reele_gbn_nm), 
                sex_gbn_nm = VALUES(sex_gbn_nm), tel_no = VALUES(tel_no), e_mail = VALUES(e_mail), 
                homepage = VALUES(homepage), staff = VALUES(staff), secretary = VALUES(secretary), 
                secretary2 = VALUES(secretary2), mem_title = VALUES(mem_title), assem_addr = VALUES(assem_addr), 
                upd_datetime = NOW()
        `;
        
        const [result] = await connection.query(sql, [records]);
        
        const totalProcessed = records.length;
        // INSERT는 1, UPDATE는 2가 더해지므로 (affectedRows - total) = updated
        const updatedCount = result.affectedRows - totalProcessed;
        const insertedCount = totalProcessed - updatedCount;

        const duration = Date.now() - start;
        logger.info(`[배치 성공] 신규 추가: ${insertedCount}건, 정보 업데이트: ${updatedCount}건 /* ${duration}ms */`);

    } catch (error) {
        logger.error('[배치 실패] DB 작업 중 오류 발생:', error);
    } finally {
        connection.release();
    }
}

async function runSync() {
    logger.info('[배치 시작] 국회의원 데이터 동기화를 시작합니다.');
    const pool = mysql.createPool(dbConfig);
    const politiciansFromAPI = await fetchPoliticiansFromAPI();
    if (politiciansFromAPI && politiciansFromAPI.length > 0) {
        await upsertPoliticiansToDB(pool, politiciansFromAPI);
    }
    await pool.end();
    logger.info('[배치 종료] 국회의원 데이터 동기화가 완료되었습니다.');
}

cron.schedule('0 4 * * *', () => { runSync(); }, { scheduled: true, timezone: "Asia/Seoul" });
logger.info('국회의원 데이터 동기화 배치가 설정되었습니다. (매일 새벽 4시 실행)');

// 즉시 실행하려면 아래 코드의 주석을 해제하세요.
// runSync();