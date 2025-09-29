import axios from 'axios';
import * as cheerio from 'cheerio';
import mysql from 'mysql2/promise';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * MONA_CD를 사용하여 의원 상세 페이지에서 사진 URL을 가져오는 최종 함수
 */
async function fetchPoliticianPhoto(monaCd) {
    const memberPageUrl = `https://www.assembly.go.kr/portal/assm/assmMemb/member.do?monaCd=${monaCd}&st=22&viewType=CONTBODY`;

    try {
        const response = await axios.get(memberPageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);

        // [수정됨] CSS background-image에서 URL을 추출하는 로직
        const styleAttribute = $('.info-con.present .img-set .img').attr('style');
        
        if (styleAttribute) {
            // 정규식을 사용해 url('...') 안의 경로만 추출
            const urlMatch = styleAttribute.match(/url\('([^']+)'\)/);
            const photoPath = urlMatch ? urlMatch[1] : null;

            if (photoPath) {
                return `https://www.assembly.go.kr${photoPath}`;
            }
        }
        
        logger.warn(`'${monaCd}' 의원 상세 페이지에서 사진을 찾을 수 없습니다.`);
        return null;

    } catch (error) {
        logger.error(`'${monaCd}' 의원 사진 크롤링 중 에러 발생:`, error.message);
        return null;
    }
}


/**
 * DB에 사진 URL을 업데이트하는 함수 (기존과 동일)
 */
async function updatePhotoInDB(connection, mona_cd, photo_url) {
    try {
        const sql = `UPDATE politicians SET photo_url = ? WHERE mona_cd = ?`;
        const [result] = await connection.execute(sql, [photo_url, mona_cd]);
        return result.affectedRows > 0;
    } catch (error) {
        logger.error(`'${mona_cd}' 의원 사진 URL 업데이트 중 DB 에러:`, error.message);
        return false;
    }
}


/**
 * 메인 실행 함수 (기존과 동일)
 */
async function runPhotoSync() {
    logger.info('[사진 배치 시작] 최종 방식으로 동기화를 시작합니다.');
    const pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    let updatedCount = 0;
    const CONCURRENCY_LEVEL = 10;

    try {
        const [politiciansToUpdate] = await connection.execute(
            "SELECT MONA_CD, NAME FROM POLITICIANS WHERE PHOTO_URL IS NULL OR PHOTO_URL = ''"
        );

        if (politiciansToUpdate.length === 0) {
            logger.info('[사진 배치] 업데이트할 의원이 없습니다.');
            return;
        }
        
        logger.info(`총 ${politiciansToUpdate.length}명의 의원 사진을 업데이트합니다.`);

        for (let i = 0; i < politiciansToUpdate.length; i += CONCURRENCY_LEVEL) {
            const chunk = politiciansToUpdate.slice(i, i + CONCURRENCY_LEVEL);
            
            const promises = chunk.map(async (politician) => {
                const photoUrl = await fetchPoliticianPhoto(politician.MONA_CD);
                if (photoUrl) {
                    const success = await updatePhotoInDB(connection, politician.MONA_CD, photoUrl);
                    if (success) {
                        updatedCount++;
                        logger.info(`'${politician.NAME}' 의원 사진 업데이트 성공.`);
                    }
                }
            });

            await Promise.all(promises);
            logger.info(`--- ${Math.min(i + CONCURRENCY_LEVEL, politiciansToUpdate.length)} / ${politiciansToUpdate.length} 처리 완료 ---`);
        }

    } catch (error) {
        logger.error('[사진 배치 실패] 메인 로직 실행 중 오류 발생:', error.message);
    } finally {
        connection.release();
        await pool.end();
        logger.info(`[사진 배치 종료] 총 ${updatedCount}명의 사진 정보가 업데이트되었습니다.`);
    }
}

// runPhotoSync();