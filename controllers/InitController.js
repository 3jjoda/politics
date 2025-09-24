import CodeService from '../services/CodeService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {

    // db 객체가 주입되면 서비스를 초기화
    const codeService = CodeService(db);
    const controller = {};

    /* 초기화 */
    controller.getInitialData = wrapWithContext(async function getInitialData(req, res, next) {
        try {
            // 1. 로그인 여부 확인
            // const user = req.session.user || { isLoggedIn: false };

            // 2. 공통 코드 조회 (DB에서 가져오는 로직)
            const codes = await codeService.getList();

            // 3. 최종 데이터 조합하여 반환
            return  {
                CODES: codes
            };
            
        } catch(error) {
            logger.error('컨트롤러에서 예상치 못한 에러:', { stack: error.stack });
            next(error);
        }
    });

    return controller;
};