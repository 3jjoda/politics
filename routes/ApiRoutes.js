// routes/apiRoutes.js (새 파일)
import express from 'express';
import InitController from '../controllers/InitController.js';
import PoliticianController from '../controllers/PoliticianController.js';
import BillController from '../controllers/BillController.js';

export default (db) => {
    const router = express.Router();

    const initController = InitController(db);
    const politicianController = PoliticianController(db);
    const billController = BillController(db);

    // API 목록
    /* 초기화 */
    router.get('/initialize', initController.getInitialData);

    /* 정치인 */
    router.get('/politician', politicianController.getList);        // 국회의원 목록
    router.get('/politician:id', politicianController.getDetail);   // 국회의원 상세

    /* 법안 */
    router.get('/bill', billController.getList);        // 법안 목록
    router.get('/bill:id', billController.getDetail);   // 법안 상세

    return router;
};