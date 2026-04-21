import PoliticianService from '../services/PoliticianService.js';
import BillService from '../services/BillService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    const politicianService = PoliticianService(db);
    const billService = BillService(db);
    const controller = {};

    /**
     * API 엔드포인트: 모든 정치인 목록을 JSON 형태로 반환
     * 클라이언트 측에서 동적으로 데이터를 받아와 사용할 때 사용
     */
    controller.getList = wrapWithContext(async function getList(req, res, next) {
        try {
            const results = await politicianService.getList(); // 가공된 데이터 반환
            res.status(200).json(results);
        } catch (error) {
            logger.error('API 컨트롤러에서 정치인 목록 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /**
     * 웹 페이지 엔드포인트: 정치인 목록 페이지 (EJS)를 렌더링
     * 이 페이지는 초기 렌더링 시 빈 데이터를 전달하거나, 모든 데이터를 미리 불러와 클라이언트 측 JS에 넘겨줄 수 있음
     * 현재는 모든 데이터를 미리 불러와 window.politicianData로 전달하는 방식
     */
    controller.getListPage = wrapWithContext(async function getListPage(req, res, next) {
        try {
            // 모든 정치인 데이터를 불러와 클라이언트 측에 넘겨줌
            // 클라이언트 측 JS(politician.js)에서 이 데이터를 사용하여 렌더링 및 페이징을 처리
            const results = await politicianService.getList(); 

            res.render('politician/politician', {
                pageTitle: '정치 바로미터 - 정치인',
                pageStyles: 'politician/politician',
                currentUrl: '/politician',
                politician: results // 서비스가 가공 완료한 데이터를 전달
            });
        } catch (error) {
            logger.error('웹 컨트롤러에서 정치인 목록 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error); 
        }
    });
    
    /**
     * API 엔드포인트: 특정 정치인의 상세 정보를 JSON 형태로 반환합니다.
     */
    controller.getDetail = wrapWithContext(async function getDetail(req, res, next) {
        try {
            const politicianData = await politicianService.getDetail(req.params.id);
            if (!politicianData) {
                return res.status(404).json({ message: '정치인을 찾을 수 없습니다.' });
            }
            res.status(200).json(politicianData);
        } catch (error) {
            logger.error('API 컨트롤러에서 정치인 상세 정보 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /**
     * 웹 페이지 엔드포인트: 특정 정치인의 상세 정보 페이지 (EJS)를 렌더링합니다.
     * 필요한 모든 데이터를 여기서 조회하고 EJS 템플릿으로 전달합니다.
     */
    controller.getDetailPage = wrapWithContext(async function getDetailPage(req, res, next) {
        try {
            const monaCd = req.params.id;
            let politician = {};

            // 1. 정치인 상세 정보 조회
            const politicianData = await politicianService.getDetail(monaCd);
            if (!politician) { // 데이터가 없는 경우
                return res.status(404).render('error_pages/404', { // 404 페이지 렌더링
                    pageTitle: '정치인 찾을 수 없음',
                    pageStyles: 'error',
                    message: '요청하신 정치인 정보를 찾을 수 없습니다.'
                });
            }
            politician = politicianData[0];
            
            // 2. 법안 정보 조회
            const billData = await billService.getListOne(monaCd);
            politician.bills = billData; 

            // 3. 댓글 정보 조회
            politician.replys = [];

            // 4. 기타 집계 데이터 조회
            const summary = await billService.getListOne(monaCd);
            politician.scores = []; 

            res.render('politician/politician_detail', {
                pageTitle: '정치인 정보 - ' + politician.HG_NM, // politicianService.getDetail의 결과 구조에 따라 변경 (HG_NM이 이름으로 가정)
                pageStyles: 'politician/politician_detail',
                currentUrl: `/politician/${monaCd}`, // 상세 페이지의 실제 URL 반영
                politician: politician  // 모든 관련 정보가 포함된 정치인 객체 전달
            });

        } catch (error) {
            logger.error('웹 컨트롤러에서 정치인 상세 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};