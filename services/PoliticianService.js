// services/PoliticianService.js

import logger from '../utils/logger.js';
import PoliticianDao from '../daos/PoliticianDao.js';

export default (db) => {
    const politicianDao = PoliticianDao(db);

    return {
        /* 정치인 목록 조회 (Promise 기반) */
        getList: async () => {
            try {
                // DAO가 Promise를 반환하므로 await
                const results = await politicianDao.getList();
                return results;
            } catch (error) {
                logger.error('Error in politicianService.getList:', error);
                throw error; // 에러를 다시 던져서 상위(컨트롤러)에서 catch하도록 함
            }
        },

        /* 정치인 목록 조회 - 페이지 (Promise 기반) */
        getListPage: async () => {
            try {
                // DAO가 Promise를 반환하므로 await
                const results = await politicianDao.getList();

                const rtnData = results.map(p => {
                    let reeleClass = '';
                    if (p.REELE_GBN_NM === '초선') {
                        reeleClass = 'reele--first';
                    } else if (p.REELE_GBN_NM === '재선') {
                        reeleClass = 'reele--second';
                    } else { // 3선 이상은 'multi'로 처리
                        reeleClass = 'reele--multi';
                    }
                    return { ...p, reeleClass: reeleClass };
                });
                return rtnData;
            } catch (error) {
                logger.error('Error in politicianService.getListPage:', error);
                throw error;
            }
        },

        /* 정치인 상세 조회 (Promise 기반) */
        getDetail: async (id) => {
            try {
                // DAO가 Promise를 반환하므로 await
                const results = await politicianDao.getDetail(id);
                return results;
            } catch (error) {
                logger.error(`Error in politicianService.getDetail for ID ${id}:`, error);
                throw error;
            }
        },
        
        /* 정치인 상세 조회 - 페이지 (async/await 기반) */
        // 이 함수가 정치인 데이터 자체의 가공이 필요할 때 사용될 수 있습니다.
        // 현재 getDetail과 동일하게 DAO만 호출하므로, getDetail로 통합하고
        // 컨트롤러에서 배열의 첫 번째 요소를 가져오는 것이 더 효율적입니다.
        // 만약 이 함수에서만 필요한 추가적인 데이터 가공(예: 등급 계산 등)이 있다면 유지하세요.
        getDetailPage: async (id) => {
            try {
                const results = await politicianDao.getDetail(id);
                // 추가적인 서비스 로직 (예: 등급 계산, 다른 API/DAO 호출)
                return results; // 결과 배열 (단일 레코드가 담긴)
            } catch (error) {
                logger.error(`Error in politicianService.getDetailPage for ID ${id}:`, error);
                throw error;
            }
        }
    };
};
