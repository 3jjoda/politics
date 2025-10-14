// import axios from 'axios'; // axios 모듈 제거
import * as cheerio from 'cheerio';
import mysql from 'mysql2/promise';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * MONA_CD를 사용하여 의원 상세 페이지에서 사진 URL을 가져오는 최종 함수
 * Node.js 내장 fetch API를 사용하도록 변경
 */
async function fetchPoliticianPhoto(monaCd) {
    const memberPageUrl = `https://www.assembly.go.kr/portal/assm/assmMemb/member.do?monaCd=${monaCd}&st=22&viewType=CONTBODY`;

    try {
        // Node.js 18+ 내장 fetch 사용
        const response = await fetch(memberPageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
            }
        });
        
        // HTTP 응답 상태 코드 확인
        if (!response.ok) {
            logger.error(`'${monaCd}' 의원 페이지 요청 실패: ${response.status} ${response.statusText}`);
            return null;
        }

        // 응답 본문을 텍스트로 파싱 (axios의 response.data와 유사)
        const html = await response.text();
        const $ = cheerio.load(html);

        // CSS background-image에서 URL을 추출하는 로직
        const styleAttribute = $('.info-con.present .img-set .img').attr('style');
        
        if (styleAttribute) {
            // 정규식을 사용해 url('...') 안의 경로만 추출
            const urlMatch = styleAttribute.match(/url\('([^']+)'\)/);
            const photoPath = urlMatch ? urlMatch[1] : null;

            if (photoPath) {
                // 상대 경로를 절대 경로로 변환
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
        const sql = `UPDATE politicians SET photo_url = ?, updated_at = NOW() WHERE mona_cd = ?`; // updated_at 자동 업데이트 추가
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
    logger.info('[사진 배치 시작] 최종 방식으로 동기화를 시작');
    const pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection(); // 풀에서 커넥션 획득
    let updatedCount = 0;
    const CONCURRENCY_LEVEL = 5; // 동시성 레벨을 조금 낮추어 안정성 향상 (크롤링은 부하가 클 수 있음)

    try {
        // PHOTO_URL이 NULL이거나 빈 문자열인 의원만 가져옵니다.
        // 또는 특정 시간(예: 일주일)이 경과한 의원 사진을 재업데이트하는 로직을 추가할 수도 있습니다.
        const [politiciansToUpdate] = await connection.execute(
            "SELECT MONA_CD, NAME FROM politicians WHERE photo_url IS NULL OR photo_url = ''"
        );

        if (politiciansToUpdate.length === 0) {
            logger.info('[사진 배치] 업데이트할 의원이 없습니다.');
            return;
        }
        
        logger.info(`총 ${politiciansToUpdate.length}명의 의원 사진을 업데이트`);

        for (let i = 0; i < politiciansToUpdate.length; i += CONCURRENCY_LEVEL) {
            const chunk = politiciansToUpdate.slice(i, i + CONCURRENCY_LEVEL);
            
            const promises = chunk.map(async (politician) => {
                const photoUrl = await fetchPoliticianPhoto(politician.MONA_CD);
                if (photoUrl) {
                    const success = await updatePhotoInDB(connection, politician.MONA_CD, photoUrl);
                    if (success) {
                        updatedCount++;
                        logger.info(`'${politician.NAME}' 의원 사진 업데이트 성공: ${photoUrl}`);
                    }
                }
            });

            await Promise.all(promises);
            logger.info(`--- ${Math.min(i + CONCURRENCY_LEVEL, politiciansToUpdate.length)} / ${politiciansToUpdate.length} 처리 완료 ---`);
            // 과도한 요청 방지를 위해 청크 처리 후 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        }

    } catch (error) {
        logger.error('[사진 배치 실패] 메인 로직 실행 중 오류 발생:', error.message);
    } finally {
        // 커넥션 반환
        if (connection) {
            connection.release();
        }
        // 풀 종료
        await pool.end();
        logger.info(`[사진 배치 종료] 총 ${updatedCount}명의 사진 정보가 업데이트되었습니다.`);
    }
}

// runPhotoSync();