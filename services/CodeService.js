// import CodeDao from '../dao/CodeDao.js';

// export default (db) => {
//     const codeDao = CodeDao(db);
    
//     return {
//         /* 공통코드 조회 */
//         getList: (callback) => {
//             codeDao.getList(callback);
//         }
//     };
// };


import CodeDao from '../dao/CodeDao.js';
import logger from '../utils/logger.js';

export default (db) => {
    const codeDao = CodeDao(db);
    const service = {}; // 반환할 객체를 미리 생성

    /**
     * [수정됨] async 함수로 변경
     * 모든 공통 코드를 가져와서 그룹별로 묶어주는 함수
     */
    service.getList = async () => {
        try {
            // 1. DAO를 호출하고 결과가 올 때까지 기다림 (await)
            const codeList = await codeDao.getList();
            // logger.info(codeList);
            // 2. 받아온 데이터를 그룹별로 가공 (reduce 사용)
            const groupedCodes = codeList.reduce((acc, code) => {
                const { GROUP_CODE, CODE_ID, CODE_NAME } = code;
                if (!acc[GROUP_CODE]) {
                    acc[GROUP_CODE] = [];
                }
                acc[GROUP_CODE].push({ CODE_ID, CODE_NAME });
                return acc;
            }, {});

            // 3. 가공된 결과를 반환 (async 함수이므로 자동으로 Promise로 감싸짐)
            return groupedCodes;

        } catch (error) {
            // 에러 발생 시 그대로 에러를 던져서 컨트롤러가 처리하게 함
            throw error;
        }
    };

    return service;
};
