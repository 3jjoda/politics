import BillService from '../services/BillService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    // db 객체가 주입되면 서비스를 초기화
    const billService = BillService(db);
    const controller = {};

    /* 법안 조회 */
    controller.getList = wrapWithContext(function getList(req, res, next) {
        try {
            billService.getList((err, results) => {
                if (err) {
                    logger.error('법안 목록 조회 중 에러:', { stack: err.stack });
                    return next(err);   // 에러를 전역 에러 핸들러로 전달
                }
                res.status(200).json(results);
            });
        } catch(error) {
            logger.error('컨트롤러에서 예상치 못한 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 웹페이지용: EJS 페이지를 렌더링하여 반환 (콜백 방식) */
    controller.getListPage = (req, res, next) => {
        try {
            // 서비스의 getList 함수를 콜백 방식으로 호출
            billService.getListPage((err, results) => {
                // 1. 서비스에서 에러가 발생하면 에러 핸들러로 전달
                if (err) {
                    return next(err);
                }
    
                // 2. 에러가 없으면, 받아온 데이터를 템플릿에 넣어 렌더링
                res.render('bill/bill', {
                    pageTitle: '법안',
                    pageStyles: 'bill/bill',
                    currentUrl: '/bill',
                    bills: results // 서비스가 가공 완료한 데이터를 전달
                });
            });
        } catch (error) {
            next(error);
        }
    };

    /* 법안 상세 조회 */
    controller.getDetail = wrapWithContext(function getDetail(req, res, next) {
        try {
            const { id } = req.params;
            billService.getDetail(id, (err, result) => {
                if (err) {
                    logger.error('법안 상세 조회 중 에러:', { stack: err.stack });
                    return next(err);
                }
                if (result.length > 0) {
                    res.status(200).json(result[0]);
                } else {
                    res.status(404).json({ success: false, message: '법안을 찾을 수 없습니다' });
                }
            });
        } catch (error) {
            logger.error('컨트롤러에서 예상치 못한 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 웹페이지용: EJS 페이지를 렌더링하여 반환 (콜백 방식) */
    controller.getDetailPage = (req, res, next) => {
        try {
            // 서비스의 getList 함수를 콜백 방식으로 호출
            billService.getDetailPage(req.params.id, (err, results) => {
                // 1. 서비스에서 에러가 발생하면 에러 핸들러로 전달
                if (err) {
                    return next(err);
                }
    
                // 2. 에러가 없으면, 받아온 데이터를 템플릿에 넣어 렌더링
                res.render('bill/bill_detail', {
                    pageTitle: '법안 상세정보',
                    pageStyles: 'bill/bill_detail',
                    currentUrl: '/bill',
                    bill: results[0] // 서비스가 가공 완료한 데이터를 전달
                });
            });
        } catch (error) {
            next(error);
        }
    };

    return controller;
};
