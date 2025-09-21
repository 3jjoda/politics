import PoliticianDao from '../dao/PoliticianDao.js';

export default (db) => {
    const politicianDao = PoliticianDao(db);
    
    return {
        /* 정치인 조회 */
        getList: (callback) => {
            politicianDao.getList(callback);
        },

        /* 정치인 상세 조회 */
        getDetail: (id, callback) => {
            politicianDao.getDetail(id, callback);
        },

        /* 정치인 저장 */
        insert: (data, callback) => {
            politicianDao.insert(data, callback);
        }
    };
};
