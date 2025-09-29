import BillDao from '../dao/BillDao.js';
import logger from '../utils/logger.js';

export default (db) => {
    const billDao = BillDao(db);
    
    return {
        /* 법안 조회 */
        getList: (callback) => {
            billDao.getList(callback);
        },

        getListPage: (callback) => {
            billDao.getList((err, results) => {
                // 1. DAO에서 에러가 발생했다면, 그대로 컨트롤러로 에러를 전달합니다.
                if (err) {
                    return callback(err, null);
                }

                // 3. 가공이 완료된 데이터를 최종적으로 컨트롤러의 콜백 함수에 전달합니다.
                callback(null, results);
            });
        },

        /* 법안 상세 조회 */
        getDetail: (id, callback) => {
            billDao.getDetail(id, callback);
        },

        getDetailPage: (id, callback) => {
            billDao.getDetail(id, (err, results) => {
                // 1. DAO에서 에러가 발생했다면, 그대로 컨트롤러로 에러를 전달합니다.
                if (err) {
                    return callback(err, null);
                }

                // 3. 가공이 완료된 데이터를 최종적으로 컨트롤러의 콜백 함수에 전달합니다.
                callback(null, results);
            });
        },
    };
};
