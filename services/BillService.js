import BillDao from '../daos/BillDao.js';
import logger from '../utils/logger.js';

export default (db) => {
    const billDao = BillDao(db);
    
    return {
        /* 법안 목록 조회 (Promise 기반) */
        getList: async () => {
            try {
                // DAO가 Promise를 반환하므로 await
                const results = await billDao.getList();
                return results;
            } catch (error) {
                logger.error('Error in billService.getList:', error);
                throw error; // 에러를 다시 던져서 상위(컨트롤러)에서 catch하도록 함
            }
        },

        /* 법안 목록 조회 - 페이지 (Promise 기반) */
        getListPage: async () => {
            try {
                // DAO가 Promise를 반환하므로 await
                const results = await billDao.getList();
                return results;
            } catch (error) {
                logger.error('Error in billService.getListPage:', error);
                throw error;
            }
        },

        /* 법안 상세 조회 (Promise 기반) */
        getDetail: async (id) => {
            try {
                // DAO가 Promise를 반환하므로 await
                const results = await billDao.getDetail(id);
                return results;
            } catch (error) {
                logger.error(`Error in billService.getDetail for ID ${id}:`, error);
                throw error;
            }
        },
        
        /* 법안 상세 조회 - 페이지 (async/await 기반) */
        getDetailPage: async (id) => {
            try {
                const results = await billDao.getDetail(id);
                return results; // 결과 배열 (단일 레코드가 담긴)
            } catch (error) {
                logger.error(`Error in billService.getDetailPage for ID ${id}:`, error);
                throw error;
            }
        }
    };
};
