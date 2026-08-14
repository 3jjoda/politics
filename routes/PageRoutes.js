// routes/PageRoutes.js

import express from 'express';
import InitController from '../controllers/InitController.js';
import PoliticianController from '../controllers/PoliticianController.js';
import BillController from '../controllers/BillController.js';
import BalanceGameController from '../controllers/BalanceGameController.js';
import MyController from '../controllers/MyController.js';
import XrayController from '../controllers/XrayController.js';
import BriefingController from '../controllers/BriefingController.js';
import ChartController from '../controllers/ChartController.js';
import { requireLogin } from '../middlewares/auth.js';

export default (db) => {
    const router = express.Router();
    const initController = InitController(db);
    const politicianController = PoliticianController(db);
    const billController = BillController(db);
    const balanceGameController = BalanceGameController(db);
    const myController = MyController(db);
    const xrayController = XrayController(db);
    const briefingController = BriefingController(db);
    const chartController = ChartController(db);

    // 메인 페이지
    router.get('/', initController.getHomePage);

    // 브리핑 — AI 카드 피드 (+ 상단 주간 요약 스트립)
    //   /briefing      피드
    //   /briefing/:id       카드 상세 (댓글·공유 단위)
    //   /briefing/:id/card     인스타 카드 (1080×1350, layout 없음)
    //   /briefing/:id/threads  쓰레드 연결 게시물 (복사용)
    router.get('/briefing', briefingController.getBriefingPage);
    router.get('/briefing/:id/card', briefingController.getBriefingCard);
    router.get('/briefing/:id/threads', briefingController.getBriefingThreads);
    router.get('/briefing/:id', briefingController.getBriefingPost);

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
                pageTitle: '용어 설명',
                pageStyles: null,
                currentUrl: '/glossary'
            });
        } catch (error) {
            next(error);
        }
    });

    // 개인정보처리방침 / 이용약관
    router.get('/privacy', async (req, res, next) => {
        try {
            res.render('privacy', {
                pageTitle: '개인정보처리방침',
                pageStyles: null,
                currentUrl: '/privacy'
            });
        } catch (error) {
            next(error);
        }
    });
    router.get('/terms', async (req, res, next) => {
        try {
            res.render('terms', {
                pageTitle: '이용약관',
                pageStyles: null,
                currentUrl: '/terms'
            });
        } catch (error) {
            next(error);
        }
    });

    // 숫자로 본 국회 (구 "국회 X레이" — 표시명만 변경, 경로·식별자는 xray 유지)
    //   /xray      — 접힌 목록. DB 조회 0회
    //   /xray/s/:id — 섹션 HTML 조각. 펼칠 때만 호출 (layout 없음)
    //   /xray/chart — 커스텀 차트 빌더 (스펙이 쿼리스트링에 담겨 URL 이 곧 공유 링크)
    //   ⚠️ /xray/s/:id 보다 **먼저** 등록할 필요는 없다 (경로가 겹치지 않음) — 가독성 순서로 둔다
    router.get('/xray', xrayController.getXrayPage);
    router.get('/xray/chart', chartController.getChartPage);
    router.get('/xray/s/:id', xrayController.getSectionFragment);

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
