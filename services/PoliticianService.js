// import PoliticianDao from '../dao/PoliticianDao.js';
// import logger from '../utils/logger.js';

// export default (db) => {
//     const politicianDao = PoliticianDao(db);
    
//     return {
//         /* 정치인 조회 */
//         getList: (callback) => {
//             politicianDao.getList(callback);
//         },

//         getListPage: (callback) => {
//             politicianDao.getList((err, results) => {
//                 // 1. DAO에서 에러가 발생했다면, 그대로 컨트롤러로 에러를 전달
//                 if (err) {
//                     return callback(err, null);
//                 }

//                 // 2. 에러가 없다면, 받아온 데이터(results)를 가공
//                 const rtnData = results.map(p => {
//                     let reeleClass = '';
//                     if (p.REELE_GBN_NM === '초선') {
//                         reeleClass = 'reele--first';
//                     } else if (p.REELE_GBN_NM === '재선') {
//                         reeleClass = 'reele--second';
//                     } else { // 3선 이상은 'multi'로 처리
//                         reeleClass = 'reele--multi';
//                     }
//                     // 기존 데이터에 reeleClass 프로퍼티를 추가하여 새 객체를 반환
//                     return { ...p, reeleClass: reeleClass };
//                 });

//                 // 3. 가공이 완료된 데이터를 최종적으로 컨트롤러의 콜백 함수에 전달
//                 callback(null, rtnData);
//             });
//         },

//         /* 정치인 상세 조회 */
//         getDetail: (id, callback) => {
//             politicianDao.getDetail(id, callback);
//         },

//         getDetailPage: (id, callback) => {
//             politicianDao.getDetail(id, (err, results) => {
//                 // 1. DAO에서 에러가 발생했다면, 그대로 컨트롤러로 에러를 전달
//                 if (err) {
//                     return callback(err, null);
//                 }

//                 // 2. 에러가 없다면, 받아온 데이터(results)를 가공
//                 // const rtnData = results.map(p => {
//                 //     let reeleClass = '';
//                 //     if (p.REELE_GBN_NM === '초선') {
//                 //         reeleClass = 'reele--first';
//                 //     } else if (p.REELE_GBN_NM === '재선') {
//                 //         reeleClass = 'reele--second';
//                 //     } else { // 3선 이상은 'multi'로 처리
//                 //         reeleClass = 'reele--multi';
//                 //     }
//                 //     // 기존 데이터에 reeleClass 프로퍼티를 추가하여 새 객체를 반환
//                 //     return { ...p, reeleClass: reeleClass };
//                 // });

//                 // 3. 가공이 완료된 데이터를 최종적으로 컨트롤러의 콜백 함수에 전달
//                 callback(null, results);
//             });
//         },
//     };
// };




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

        // getDetailPage는 getDetail과 기능이 중복되어 보이며,
        // 컨트롤러에서 직접 getDetail을 호출하고 데이터를 가공하는 것이 일반적입니다.
        // 만약 '페이지' 렌더링에 필요한 특정 가공이 있다면 유지할 수 있습니다.
        // 하지만 이름과 역할상 getDetail과 유사하므로 getDetail로 통일하고 컨트롤러에서 처리하거나,
        // 필요하다면 getDetail의 결과를 받아 추가 가공하는 로직을 이곳에 작성할 수 있습니다.
        
        /* 정치인 상세 조회 - 페이지 (async/await 기반) */
        // 이 함수가 정치인 데이터 자체의 가공이 필요할 때 사용될 수 있습니다.
        // 현재 getDetail과 동일하게 DAO만 호출하므로, getDetail로 통합하고
        // 컨트롤러에서 배열의 첫 번째 요소를 가져오는 것이 더 효율적입니다.
        // 만약 이 함수에서만 필요한 추가적인 데이터 가공(예: 등급 계산 등)이 있다면 유지하세요.
        getDetailPage: async (id) => {
            try {
                // DAO의 getDetail이 Promise를 반환한다고 가정
                // DAO에서 `db.execute`를 사용하고 `[rows]` 형태로 결과를 받았다면,
                // 서비스에서는 `rows`만 리턴하거나 `rows[0]`를 리턴할 수 있습니다.
                // 여기서는 DAO가 `results` 배열을 직접 반환한다고 가정
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
