import express from 'express';
import PoliticianController from '../controllers/PoliticianController.js';

export default (db) => {
    const router = express.Router();
    const politicianController = PoliticianController(db);

    // 메인 페이지
    router.get('/', (req, res) => {
        res.render('index', { 
            pageTitle: '메인',
            pageStyles: null,
            currentUrl: '/'
        }); 
    });

    // 국회의원 목록 페이지
    router.get('/politician', politicianController.getListPage);
    // 국회의원 상세 페이지
    router.get('/politician/:id', politicianController.getDetailPage);

    return router;
};