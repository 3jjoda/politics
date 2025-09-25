import CodeDao from '../dao/CodeDao.js';

export default (db) => {
    const codeDao = CodeDao(db);
    const service = {}; // 반환할 객체를 미리 생성

    /**
     * 공통코드 조회
     */
    service.getList = async () => {
        try {
            // 1. DAO를 호출하고 결과가 올 때까지 기다림 (await)
            const codeList = await codeDao.getList();

            // 2. 받아온 데이터를 그룹별로 가공 (reduce 사용)
            const groupedCodes = codeList.reduce((acc, code) => {
                const { group_code, code_id, code_name } = code;
                if (!acc[group_code]) {
                    acc[group_code] = [];
                }
                acc[group_code].push({ code_id, code_name });
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
