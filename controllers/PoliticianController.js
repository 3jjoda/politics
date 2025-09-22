import PoliticianService from '../services/PoliticianService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    // db 객체가 주입되면 서비스를 초기화
    const politicianService = PoliticianService(db);
    const controller = {};

    /* 정치인 조회 */
    controller.getList = wrapWithContext(function getList(req, res, next) {
        try {
            politicianService.getList((err, results) => {
                if (err) {
                    logger.error('정치인 목록 조회 중 에러:', { stack: err.stack });
                    return next(err);   // 에러를 전역 에러 핸들러로 전달
                }
                res.status(200).json(results);
            });
        } catch(error) {
            logger.error('컨트롤러에서 예상치 못한 에러:', { stack: error.stack });
            next(error);
        }
    });

    /* 정치인 상세 조회 */
    controller.getDetail = wrapWithContext(function getDetail(req, res, next) {
        try {
            const { id } = req.params;
            politicianService.getDetail(id, (err, result) => {
                if (err) {
                    logger.error('정치인 상세 조회 중 에러:', { stack: err.stack });
                    return next(err);
                }
                if (result.length > 0) {
                    res.status(200).json(result[0]);
                } else {
                    res.status(404).json({ success: false, message: '정치인을 찾을 수 없습니다' });
                }
            });
        } catch (error) {
            logger.error('컨트롤러에서 예상치 못한 에러:', { stack: error.stack });
            next(error);
        }
    });

    return controller;
};
