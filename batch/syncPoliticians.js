import cron from 'node-cron';
import axios from 'axios'; // API 호출을 위해 axios는 다시 사용합니다.
import mysql from 'mysql2/promise';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';

// API 호출을 위한 기본 설정
const API_KEY = process.env.OPEN_ASSEMBLY_API_KEY;
const YOUR_SERVICE_ID = 'nwvrqwxyaytdsfvhu'; // 본인의 Service ID로 교체 필요
const API_URL = `https://open.assembly.go.kr/portal/openapi/`; // 서비스 ID는 호출 시점에 URL 뒤에 붙임

// 국회의원 유형 코드 하드코딩
const POLITICIAN_TYPE_NATIONAL_ASSEMBLY = 102; 

/**
 * 열린국회정보포털 API에서 현직 국회의원 목록을 가져오는 함수
 */
async function fetchPoliticiansFromAPI() {
    try {
        const fullApiUrl = `${API_URL}${YOUR_SERVICE_ID}`; // 서비스 ID를 API_URL 뒤에 추가
        const response = await axios.get(fullApiUrl, { // axios 사용
            params: {
                KEY: API_KEY,
                type: 'json',
                pIndex: 1,
                pSize: 500 // 한 번에 가져올 수 있는 최대 수
            }
        });

        if (response.data && response.data[YOUR_SERVICE_ID]) {
            if (response.data[YOUR_SERVICE_ID].length > 1 && response.data[YOUR_SERVICE_ID][1].row) {
                return response.data[YOUR_SERVICE_ID][1].row;
            } else {
                logger.warn('API 응답에 row 데이터가 없습니다. (의원 목록 없음)');
                return [];
            }
        } else {
            logger.error('API 응답에서 유효한 서비스 ID 데이터를 찾을 수 없습니다.');
            logger.error('실제 API 응답:', JSON.stringify(response.data, null, 2));
            return [];
        }
    } catch (error) {
        logger.error('API 호출 중 오류 발생:', error.message);
        return [];
    }
}

/**
 * DB에 정당 정보가 있는지 확인하고 없으면 추가하는 함수
 * (정당명 변경 이력 관리 로직 포함)
 */
async function ensurePartyExistsAndTrackHistory(connection, partyNameFromAPI) {
    let party_id = null;
    let existingPartyName = null;

    // 1. party_name으로 정당 정보 조회
    const [partyRows] = await connection.execute(
        'SELECT party_id, party_name FROM parties WHERE party_name = ?',
        [partyNameFromAPI]
    );

    if (partyRows.length > 0) {
        // 정당이 이미 존재하면 ID와 현재 이름 가져오기
        party_id = partyRows[0].party_id;
        existingPartyName = partyRows[0].party_name;
    } else {
        // 2. 정당이 존재하지 않으면 새로 추가
        const [insertResult] = await connection.execute(
            'INSERT INTO parties (party_name) VALUES (?)',
            [partyNameFromAPI]
        );
        party_id = insertResult.insertId;
        logger.info(`[Party] 새로운 정당 '${partyNameFromAPI}' 추가됨 (ID: ${party_id})`);

        // 새로운 정당이므로 party_names_history에도 첫 이력 추가
        await connection.execute(
            'INSERT INTO party_names_history (party_id, party_name, start_date) VALUES (?, ?, CURDATE())',
            [party_id, partyNameFromAPI]
        );
        logger.info(`[Party History] 새로운 정당 '${partyNameFromAPI}'의 첫 이름 이력 추가됨.`);
    }

    // [참고] `parties.party_name`이 API로부터 업데이트되는 것이 아니라, `party_names_history`로만 관리된다면
    // 아래 주석 처리된 로직은 필요 없습니다. 현재 스크립트에서는 `parties.party_name`을
    // API `POLY_NM`과 동일하다고 가정하고, 이름 변경은 `party_names_history`로 추적합니다.

    return party_id;
}


/**
 * DB에 국회의원 정보를 'Bulk Upsert'하고 정당 이력을 관리하는 함수
 */
async function upsertPoliticiansToDB(pool, politiciansFromAPI) {
    const connection = await pool.getConnection();
    await connection.beginTransaction(); // 트랜잭션 시작
    try {
        const start = Date.now();

        // 1. 현재 DB의 정당 정보를 가져와 맵으로 생성 (ensurePartyExistsAndTrackHistory에서 처리되지만, 의원 매핑을 위해 필요)
        const [partiesResult] = await connection.execute('SELECT party_id, party_name FROM parties');
        const partyMap = new Map(partiesResult.map(p => [p.party_name, p.party_id]));


        // 2. 현재 DB에 있는 모든 의원의 MONA_CD를 가져옴 (활동 여부 업데이트 위함)
        const [existingPoliticians] = await connection.execute('SELECT mona_cd, party_id, name FROM politicians');
        const existingPoliticianMap = new Map(existingPoliticians.map(p => [p.mona_cd, p]));

        const politiciansToInsertOrUpdate = []; // politicians 테이블에 upsert할 데이터
        const currentMonaCdsInAPI = new Set(); // API에 존재하는 mona_cd

        for (const apiPolitician of politiciansFromAPI) {
            currentMonaCdsInAPI.add(apiPolitician.MONA_CD);

            // API에서 가져온 정당명으로 party_id를 찾거나 새로 생성/관리
            const party_id = await ensurePartyExistsAndTrackHistory(connection, apiPolitician.POLY_NM);
            
            if (!party_id) {
                logger.warn(`'${apiPolitician.POLY_NM}' 정당 처리 실패. 의원(${apiPolitician.HG_NM}) 데이터는 건너뜐다.`);
                continue;
            }
            
            // politicians 테이블에 upsert할 레코드
            politiciansToInsertOrUpdate.push([
                apiPolitician.MONA_CD, apiPolitician.HG_NM, apiPolitician.HJ_NM, apiPolitician.ENG_NM,
                apiPolitician.BTH_GBN_NM, apiPolitician.BTH_DATE, apiPolitician.JOB_RES_NM,
                party_id, apiPolitician.POLY_NM, apiPolitician.ORIG_NM, apiPolitician.ELECT_GBN_NM,
                apiPolitician.CMITS, apiPolitician.REELE_GBN_NM, apiPolitician.SEX_GBN_NM,
                apiPolitician.TEL_NO, apiPolitician.E_MAIL, apiPolitician.HOMEPAGE,
                apiPolitician.STAFF, apiPolitician.SECRETARY, apiPolitician.SECRETARY2,
                apiPolitician.MEM_TITLE, apiPolitician.ASSEM_ADDR, 
                POLITICIAN_TYPE_NATIONAL_ASSEMBLY,
                true // active_yn 기본값 true
            ]);
        }

        if (politiciansToInsertOrUpdate.length === 0) {
            logger.info("[배치] 업데이트할 유효한 의원 데이터가 없습니다.");
        } else {
            // 3. politicians 테이블 Bulk Upsert
            const upsertSql = `
                INSERT INTO politicians (
                    mona_cd, name, hj_nm, eng_nm, bth_gbn_nm, birthday, job_res_nm,
                    party_id, party_name, electoral_district, elect_gbn_nm, cmits,
                    reele_gbn_nm, sex_gbn_nm, tel_no, e_mail, homepage,
                    staff, secretary, secretary2, mem_title, assem_addr, 
                    politician_type, active_yn # <<<< 추가된 부분: politician_type
                ) VALUES ?
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name), hj_nm = VALUES(hj_nm), eng_nm = VALUES(eng_nm), 
                    bth_gbn_nm = VALUES(bth_gbn_nm), birthday = VALUES(birthday), job_res_nm = VALUES(job_res_nm), 
                    party_id = VALUES(party_id), party_name = VALUES(party_name), electoral_district = VALUES(electoral_district), 
                    elect_gbn_nm = VALUES(elect_gbn_nm), cmits = VALUES(cmits), reele_gbn_nm = VALUES(reele_gbn_nm), 
                    sex_gbn_nm = VALUES(sex_gbn_nm), tel_no = VALUES(tel_no), e_mail = VALUES(e_mail), 
                    homepage = VALUES(homepage), staff = VALUES(staff), secretary = VALUES(secretary), 
                    secretary2 = VALUES(secretary2), mem_title = VALUES(mem_title), assem_addr = VALUES(assem_addr), 
                    politician_type = VALUES(politician_type), # <<<< 추가된 부분: politician_type
                    active_yn = VALUES(active_yn), updated_at = NOW()
            `;
            const [upsertResult] = await connection.query(upsertSql, [politiciansToInsertOrUpdate]);
            const totalProcessed = politiciansToInsertOrUpdate.length;
            const updatedCount = upsertResult.affectedRows - totalProcessed;
            const insertedCount = totalProcessed - updatedCount;
            logger.info(`[Politicians Upsert] 신규 추가: ${insertedCount}건, 정보 업데이트: ${updatedCount}건`);

            // 4. `active_yn` 업데이트 (API에 없는 의원)
            const monaCdsToDeactivate = [...existingPoliticianMap.keys()].filter(
                mona_cd => !currentMonaCdsInAPI.has(mona_cd)
            );
            if (monaCdsToDeactivate.length > 0) {
                const deactivateSql = `
                    UPDATE politicians
                    SET active_yn = FALSE, updated_at = NOW()
                    WHERE mona_cd IN (?) AND active_yn = TRUE
                `;
                const [deactivateResult] = await connection.query(deactivateSql, [monaCdsToDeactivate]);
                logger.info(`[Politicians Deactivate] 활동 중지 처리: ${deactivateResult.affectedRows}건`);
            }
        }

        // 5. 정당 소속 이력 (politician_party_memberships) 업데이트
        for (const apiPolitician of politiciansFromAPI) {
            const mona_cd = apiPolitician.MONA_CD;
            // ensurePartyExistsAndTrackHistory 함수에서 이미 처리된 정당 ID를 다시 맵에서 가져옵니다.
            const newPartyId = partyMap.get(apiPolitician.POLY_NM); 

            if (!newPartyId) continue; 

            const existingPolitician = existingPoliticianMap.get(mona_cd);
            
            // 기존 의원이고 정당이 변경되었을 경우 이력 업데이트
            if (existingPolitician && existingPolitician.party_id !== newPartyId) {
                // 기존 활성 멤버십 종료
                await connection.execute(
                    `UPDATE politician_party_memberships
                     SET end_date = CURDATE(), updated_at = NOW()
                     WHERE mona_cd = ? AND end_date IS NULL`,
                    [mona_cd]
                );
                // 새로운 멤버십 시작
                await connection.execute(
                    `INSERT INTO politician_party_memberships (mona_cd, party_id, start_date)
                     VALUES (?, ?, CURDATE())`,
                    [mona_cd, newPartyId]
                );
                logger.info(`[Party History] 의원(${apiPolitician.HG_NM})의 정당 변경 이력 업데이트: ${existingPolitician.party_id} -> ${newPartyId}`);
            } 
            // 새로운 의원 (DB에 아예 없던 새로운 의원)
            else if (!existingPolitician) { 
                 await connection.execute(
                     `INSERT INTO politician_party_memberships (mona_cd, party_id, start_date)
                      VALUES (?, ?, CURDATE())`,
                     [mona_cd, newPartyId]
                 );
                 logger.info(`[Party History] 새로운 의원(${apiPolitician.HG_NM})의 첫 정당 소속 이력 추가: ${newPartyId}`);
            }
            // 기존 의원이지만 이력 테이블에 end_date IS NULL인 활성 소속 레코드가 없는 경우
            else if (existingPolitician && newPartyId && existingPolitician.party_id === newPartyId) {
                const [activeMembership] = await connection.execute(
                    `SELECT membership_id FROM politician_party_memberships
                     WHERE mona_cd = ? AND end_date IS NULL`,
                    [mona_cd]
                );
                if (activeMembership.length === 0) { // 현재 활성 멤버십이 없으면 추가
                    await connection.execute(
                        `INSERT INTO politician_party_memberships (mona_cd, party_id, start_date)
                         VALUES (?, ?, CURDATE())`,
                        [mona_cd, newPartyId]
                    );
                    logger.info(`[Party History] 의원(${apiPolitician.HG_NM})의 현재 정당 소속 이력 복구/추가: ${newPartyId}`);
                }
            }
        }


        await connection.commit(); // 트랜잭션 커밋
        const duration = Date.now() - start;
        logger.info(`[배치 성공] 전체 의원 동기화 및 이력 관리 완료 /* ${duration}ms */`);

    } catch (error) {
        await connection.rollback(); // 오류 발생 시 롤백
        logger.error('[배치 실패] DB 작업 중 오류 발생:', error);
    } finally {
        connection.release();
    }
}

async function runSync() {
    logger.info('[배치 시작] 국회의원 데이터 동기화를 시작');
    const pool = mysql.createPool(dbConfig);
    
    const politiciansFromAPI = await fetchPoliticiansFromAPI();
    
    if (politiciansFromAPI && politiciansFromAPI.length > 0) {
        await upsertPoliticiansToDB(pool, politiciansFromAPI);
    } else {
        logger.warn('[배치] API에서 가져온 의원 데이터가 없어 DB 동기화를 건너뜐다.');
    }

    await pool.end();
    logger.info('[배치 종료] 국회의원 데이터 동기화가 완료되었습니다.');
}

// 매일 새벽 4시 실행
cron.schedule('0 4 * * *', () => { runSync(); }, { scheduled: true, timezone: "Asia/Seoul" });
logger.info('국회의원 데이터 동기화 배치가 설정되었습니다. (매일 새벽 4시 실행)');

// 즉시 실행하려면 아래 코드의 주석을 해제하세요.
// runSync();