import express from 'express';
import inquiryControllerFactory from '../controllers/InquiryController.js';

export default (db) => {
    /* 컨트롤러를 불러와서 db 객체를 전달 */
    const inquiryController = inquiryControllerFactory(db);
    const router = express.Router();

    /* 라우터가 컨트롤러 함수를 호출 */
    router.get('/inquiries', inquiryController.getList);        // 견적 조회
    router.get('/inquiries/:id', inquiryController.getDetail);  // 견적 상세 조회
    router.post('/inquiry', inquiryController.insert);          // 견적 저장

    return router;
};