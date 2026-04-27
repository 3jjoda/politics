// routes/PageRoutes.js

import express from 'express';
import InitController from '../controllers/InitController.js';
import PoliticianController from '../controllers/PoliticianController.js';
import BillController from '../controllers/BillController.js';
import BalanceGameController from '../controllers/BalanceGameController.js';
import MyController from '../controllers/MyController.js';
import { requireLogin } from '../middlewares/auth.js';

export default (db) => {
    const router = express.Router();
    const initController = InitController(db);
    const politicianController = PoliticianController(db);
    const billController = BillController(db);
    const balanceGameController = BalanceGameController(db);
    const myController = MyController(db);

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

    // AI 분석 요청 (POST) — 로그인 필수
    router.post('/bill/:id/request-analysis', requireLogin, billController.requestAnalysis);

    // 마이페이지
    router.get('/my',                   requireLogin, myController.getMyPage);
    router.get('/my/analysis-requests', requireLogin, billController.getMyAnalysisRequestsPage);

    // 성향 진단 (밸런스 게임) — 5단계 + 매핑 페이지
    router.get('/balance-game',          balanceGameController.getInvitePage);
    router.get('/balance-game/respond',  balanceGameController.getRespondPage);
    router.get('/balance-game/reveal',   balanceGameController.getRevealPage);
    router.get('/balance-game/compare',  balanceGameController.getComparePage);
    router.get('/balance-game/connect',  balanceGameController.getConnectPage);
    router.get('/balance-game/mapping',  balanceGameController.getMappingPreviewPage);

    return router;
};
