import PoliticianDao from '../dao/PoliticianDao.js';
import logger from '../utils/logger.js';

export default (db) => {
    const politicianDao = PoliticianDao(db);
    
    return {
        /* 정치인 조회 */
        getList: (callback) => {
            politicianDao.getList(callback);
        },

        getListPage: (callback) => {
            politicianDao.getList((err, results) => {
                // 1. DAO에서 에러가 발생했다면, 그대로 컨트롤러로 에러를 전달합니다.
                if (err) {
                    return callback(err, null);
                }

                // 2. 에러가 없다면, 받아온 데이터(results)를 가공합니다.
                const rtnData = results.map(p => {
                    let reeleClass = '';
                    if (p.REELE_GBN_NM === '초선') {
                        reeleClass = 'reele--first';
                    } else if (p.REELE_GBN_NM === '재선') {
                        reeleClass = 'reele--second';
                    } else { // 3선 이상은 'multi'로 처리
                        reeleClass = 'reele--multi';
                    }
                    // 기존 데이터에 reeleClass 프로퍼티를 추가하여 새 객체를 반환
                    return { ...p, reeleClass: reeleClass };
                });

                // 3. 가공이 완료된 데이터를 최종적으로 컨트롤러의 콜백 함수에 전달합니다.
                callback(null, rtnData);
            });
        },

        /* 정치인 상세 조회 */
        getDetail: (id, callback) => {
            politicianDao.getDetail(id, callback);
        },

        getDetailPage: (id, callback) => {
            politicianDao.getDetail(id, (err, results) => {
                logger.info("test2");
                // 1. DAO에서 에러가 발생했다면, 그대로 컨트롤러로 에러를 전달합니다.
                if (err) {
                    return callback(err, null);
                }

                // 2. 에러가 없다면, 받아온 데이터(results)를 가공합니다.
                // const rtnData = results.map(p => {
                //     let reeleClass = '';
                //     if (p.REELE_GBN_NM === '초선') {
                //         reeleClass = 'reele--first';
                //     } else if (p.REELE_GBN_NM === '재선') {
                //         reeleClass = 'reele--second';
                //     } else { // 3선 이상은 'multi'로 처리
                //         reeleClass = 'reele--multi';
                //     }
                //     // 기존 데이터에 reeleClass 프로퍼티를 추가하여 새 객체를 반환
                //     return { ...p, reeleClass: reeleClass };
                // });

                // 3. 가공이 완료된 데이터를 최종적으로 컨트롤러의 콜백 함수에 전달합니다.
                callback(null, results);
            });
        },
    };
};
