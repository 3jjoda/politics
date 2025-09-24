import express from 'express';
import InitController from '../controllers/InitController.js';
import PoliticianController from '../controllers/PoliticianController.js';

export default (db) => {
    const router = express.Router();
    const initController = InitController(db);
    const politicianController = PoliticianController(db);

    // 메인 페이지 (세션 데이터 초기화)
    router.get('/', async (req, res, next) => {
        try {
            const initialData = await initController.getInitialData(req);
            console.log('initialData : ' +JSON.stringify(initialData));
            res.render('index', { 
                pageTitle: '메인',
                pageStyles: null,
                currentUrl: '/',
                initialData: initialData
            }); 
        } catch (error) {
            next(error);
        }
    });

    // 국회의원 목록 페이지
    router.get('/politician', politicianController.getListPage);
    // 국회의원 상세 페이지
    router.get('/politician/:id', politicianController.getDetailPage);

    return router;
};