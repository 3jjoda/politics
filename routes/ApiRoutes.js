// routes/apiRoutes.js (새 파일)
import express from 'express';
import PoliticianController from '../controllers/PoliticianController.js';
// 추가

export default (db) => {
    const router = express.Router();
    const politicianController = PoliticianController(db);
    // 추가

    // 국회의원 목록 API
    router.get('/politician', politicianController.getList);

    // 추가

    return router;
};