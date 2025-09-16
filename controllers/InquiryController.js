import InquiryModel from '../models/Inquiry.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    // db 객체가 주입되면 모델을 초기화
    const Inquiry = InquiryModel(db);

    const controller = {};

    /* 견적 조회 */
    controller.getList = wrapWithContext(function getList(req, res, next) {
        try {
            Inquiry.getList((err, results) => {
                if (err) {
                    logger.error('견적 목록 조회 중 에러:', { stack: err.stack });
                    return next(err);   // 에러를 전역 에러 핸들러로 전달
                }
                res.status(200).json(results);
            });
        } catch(error) {
            logger.error('컨트롤러에서 예상치 못한 에러:', { stack: error.stack });
            next(error);
        }
    });

    /* 견적 상세 조회 */
    controller.getDetail = wrapWithContext(function getDetail(req, res, next) {
        try {
            const { id } = req.params;
            Inquiry.getDetail(id, (err, result) => {
                if (err) {
                    logger.error('견적 상세 조회 중 에러:', { stack: err.stack });
                    return next(err);
                }
                if (result.length > 0) {
                    res.status(200).json(result[0]);
                } else {
                    res.status(404).json({ success: false, message: '견적을 찾을 수 없습니다' });
                }
            });
        } catch (error) {
            logger.error('컨트롤러에서 예상치 못한 에러:', { stack: error.stack });
            next(error);
        }
    });

    /* 견적 저장 */
    controller.insert = wrapWithContext(function insert(req, res, next) {
        try {
            const { name, email, phone, message } = req.body;
            if (!name || !email || !phone || !message) {
                return res.status(400).json({ success: false, message: '모든 필드를 입력해야 합니다.' });
            }

            const inquiryData = { name, email, phone, message };
            Inquiry.insert(inquiryData, (err, result) => {
                if (err) {
                    logger.error('문의 저장 중 에러:', { stack: err.stack });
                    return next(err);
                }
                res.status(200).json({ success: true, message: '문의 접수 완료' });
            });
        } catch (error) {
            logger.error('컨트롤러에서 예상치 못한 에러:', { stack: error.stack });
            next(error);
        }
    });

    return controller;
};