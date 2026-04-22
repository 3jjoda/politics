// routes/PageRoutes.js

import express from 'express';
import InitController from '../controllers/InitController.js';
import PoliticianController from '../controllers/PoliticianController.js';
import BillController from '../controllers/BillController.js';

export default (db) => {
    const router = express.Router();
    const initController = InitController(db);
    const politicianController = PoliticianController(db);
    const billController = BillController(db);

    // 메인 페이지
    router.get('/', initController.getHomePage);

    // 소개 페이지
    router.get('/about', async (req, res, next) => {
        try {
            res.render('about', {
                pageTitle: '사이트 소개',
                pageStyles: 'about',
                currentUrl: '/about'
            });
        } catch (error) {
            next(error);
        }
    });

    // 용어 설명 페이지
    router.get('/glossary', async (req, res, next) => {
        try {
            res.render('glossary', {
                pageTitle: '용어 설명 - 정치 바로미터',
                pageStyles: null,
                currentUrl: '/glossary'
            });
        } catch (error) {
            next(error);
        }
    });

    // 국회의원 목록 / 상세
    router.get('/politician', politicianController.getListPage);
    router.get('/politician/:id', politicianController.getDetailPage);

    // 법안 목록 / 상세
    router.get('/bill', billController.getListPage);
    router.get('/bill/:id', billController.getDetailPage);

    return router;
};
