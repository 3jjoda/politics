// routes/apiRoutes.js (새 파일)
import express from 'express';
import PoliticianController from '../controllers/PoliticianController.js';

export default (db) => {
    const router = express.Router();
    const politicianController = PoliticianController(db);

    // API 목록
    router.get('/politician', politicianController.getList);        // 국회의원
    router.get('/politician:id', politicianController.getDetail);   // 국회의원 상세

    return router;
};