import PoliticianService from '../services/PoliticianService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    // db 객체가 주입되면 서비스를 초기화
    const politicianService = PoliticianService(db);
    const controller = {};

    /* 정치인 조회 */
    controller.getList = wrapWithContext(async function getList(req, res, next) {
        try {
            const results = await politicianService.getList();
            res.status(200).json(results);
        } catch (error) {
            // 모든 에러는 next(error)를 통해 에러 처리 미들웨어로 전달
            logger.error('컨트롤러에서 예상치 못한 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 정치인 조회 - 페이지 */
    controller.getListPage = wrapWithContext(async function getList(req, res, next) {
        try {
            const results = await politicianService.getList();

            res.render('politician/politician', {
                pageTitle: '정치인',
                pageStyles: 'politician/politician',
                currentUrl: '/politician',
                politician: results // 서비스가 가공 완료한 데이터를 전달
            });
        } catch (error) {
            // 모든 에러는 next(error)를 통해 에러 처리 미들웨어로 전달
            logger.error('컨트롤러에서 예상치 못한 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    // controller.getList = wrapWithContext(function getList(req, res, next) {
    //     try {
    //         politicianService.getList((err, results) => {
    //             if (err) {
    //                 logger.error('정치인 목록 조회 중 에러:', { stack: err.stack });
    //                 return next(err);   // 에러를 전역 에러 핸들러로 전달
    //             }
    //             res.status(200).json(results);
    //         });
    //     } catch(error) {
    //         logger.error('컨트롤러에서 예상치 못한 에러:', `${error.message}\n${error.stack}`);
    //         next(error);
    //     }
    // });

    /* 웹페이지용: EJS 페이지를 렌더링하여 반환 (콜백 방식) */
    // controller.getListPage = (req, res, next) => {
    //     try {
    //         // 서비스의 getList 함수를 콜백 방식으로 호출
    //         politicianService.getListPage((err, results) => {
    //             // 1. 서비스에서 에러가 발생하면 에러 핸들러로 전달
    //             if (err) {
    //                 return next(err);
    //             }
    
    //             // 2. 에러가 없으면, 받아온 데이터를 템플릿에 넣어 렌더링
    //             res.render('politician/politician', {
    //                 pageTitle: '정치인',
    //                 pageStyles: 'politician/politician',
    //                 currentUrl: '/politician',
    //                 politicians: results // 서비스가 가공 완료한 데이터를 전달
    //             });
    //         });
    //     } catch (error) {
    //         next(error);
    //     }
    // };

    /* 정치인 상세 조회 */
    // controller.getDetail = wrapWithContext(function getDetail(req, res, next) {
    //     try {
    //         const { id } = req.params;
    //         politicianService.getDetail(id, (err, result) => {
    //             if (err) {
    //                 logger.error('정치인 상세 조회 중 에러:', { stack: err.stack });
    //                 return next(err);
    //             }
    //             if (result.length > 0) {
    //                 res.status(200).json(result[0]);
    //             } else {
    //                 res.status(404).json({ success: false, message: '정치인을 찾을 수 없습니다' });
    //             }
    //         });
    //     } catch (error) {
    //         logger.error('컨트롤러에서 예상치 못한 에러:', `${error.message}\n${error.stack}`);
    //         next(error);
    //     }
    // });

    /* 웹페이지용: EJS 페이지를 렌더링하여 반환 (콜백 방식) */
    // controller.getDetailPage = (req, res, next) => {
    //     try {
    //         // 서비스의 getList 함수를 콜백 방식으로 호출
    //         politicianService.getDetailPage(req.params.id, (err, results) => {
    //             // 1. 서비스에서 에러가 발생하면 에러 핸들러로 전달
    //             if (err) {
    //                 return next(err);
    //             }
    
    //             // 2. 에러가 없으면, 받아온 데이터를 템플릿에 넣어 렌더링
    //             res.render('politician/politician_detail', {
    //                 pageTitle: '상세정보 - ' + results[0].NAME,
    //                 pageStyles: 'politician/politician_detail',
    //                 currentUrl: '/politician',
    //                 politician: results[0] // 서비스가 가공 완료한 데이터를 전달
    //             });
    //         });
    //     } catch (error) {
    //         next(error);
    //     }
    // };
    controller.getDetail = wrapWithContext(async function getDetail(req, res, next) {
        try {
            const results = await politicianService.getDetail(req.params.id);
            res.status(200).json(results);
        } catch (error) {
            logger.error('컨트롤러에서 예상치 못한 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 웹페이지용: EJS 페이지를 렌더링하여 반환 */
    controller.getDetailPage = async function getInitialData(req, res, next) {
        try {
            const monaCd = req.params.id;
            
            let politician = {};

            /* 정치인 상세정보 */
            // 서비스 계층 함수가 Promise를 반환하도록 구현되어야 
            const politicianData = await politicianService.getDetailPage(monaCd);
            if (!politicianData || politicianData.length === 0) { // 데이터가 없거나 빈 배열인 경우
                return res.status(404).send('정치인을 찾을 수 없습니다.');
            }
            politician = politicianData[0]; // 단일 row 결과이므로, 배열의 첫 번째 요소를 할당

            /* 법안 정보 (멀티 row) */
            const billData = await billService.getList(monaCd); // Promise 반환 가정
            politician.bills = billData; // 법안 정보 배열을 politician 객체에 속성으로 추가

            /* (향후 추가) 댓글 정보 - 멀티 row */
            // const replyData = await replyService.getReplies(monaCd);
            // politician.replys = replyData;
            politician.replys = []; // 임시 초기화

            /* (향후 추가) 점수 정보 - 멀티 row 또는 단일 객체 */
            // const scoreData = await scoreService.getScores(monaCd);
            // politician.scores = scoreData;
            politician.scores = []; // 임시 초기화 (또는 { average: 0, count: 0 } 같은 객체)

            res.render('politician/politician_detail', {
                pageTitle: '상세정보 - ' + politician.name, // 수정: politician.name 사용
                pageStyles: 'politician/politician_detail',
                currentUrl: '/politician',
                politician: politician // 서비스가 가공 완료한 데이터를 전달
            });

        } catch (error) {
            // 모든 에러는 next(error)를 통해 에러 처리 미들웨어로 전달
            logger.error('컨트롤러에서 예상치 못한 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    };

    return controller;
};
