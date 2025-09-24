// routes/apiRoutes.js (새 파일)
import express from 'express';
import InitController from '../controllers/InitController.js';
import PoliticianController from '../controllers/PoliticianController.js';

export default (db) => {
    const router = express.Router();

    const initController = InitController(db);
    const politicianController = PoliticianController(db);

    // API 목록
    /* 초기화 */
    router.get('/initialize', initController.getInitialData);

    /* 정치인 */
    router.get('/politician', politicianController.getList);        // 국회의원
    router.get('/politician:id', politicianController.getDetail);   // 국회의원 상세

    return router;
};