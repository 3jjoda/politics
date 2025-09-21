import express from 'express';
import PoliticianController from '../controllers/PoliticianController.js';

export default (db) => {
    /* 컨트롤러를 불러와서 db 객체를 전달 */
    const politicianController = PoliticianController(db);
    const router = express.Router();

    /* 라우터가 컨트롤러 함수를 호출 */
    router.get('/politicians', politicianController.getList);       // 정치인 조회
    router.get('/politicians/:id', politicianController.getDetail); // 정치인 상세 조회
    router.post('/politician', politicianController.insert);        // 정치인 저장

    return router;
};