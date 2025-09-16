import express from 'express';
import inquiryControllerFactory from '../controllers/InquiryController.js';

export default (db) => {
    /* 컨트롤러를 불러와서 db 객체를 전달 */
    const inquiryController = inquiryControllerFactory(db);
    const router = express.Router();

    /* 라우터가 컨트롤러 함수를 호출 */
    router.get('/inquiries', inquiryController.getAllInquiries);
    router.get('/inquiries/:id', inquiryController.getInquiryById);
    router.post('/inquiry', inquiryController.createInquiry);

    return router;
};