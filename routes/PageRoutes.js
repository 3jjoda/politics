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
import PromoController from '../controllers/PromoController.js';
import IssueController from '../controllers/IssueController.js';
import { requireLogin } from '../middlewares/auth.js';
import { GUIDE_ARTICLES, guideBySlug, guideNeighbors } from '../utils/guideArticles.js';
import BillService from '../services/BillService.js';
import logger from '../utils/logger.js';

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
    const promoController = PromoController(db);
    const issueController = IssueController(db);
    const billService = BillService(db);   // /guide 1편의 살아 있는 숫자(getHomeFacts, 10분 캐시)

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

    // SNS 운영용 카드 (운영자 도구 — 공개 라우트지만 noindex + robots /promo 차단)
    //   /promo/numbers?series=pending|oppose|absent  숫자 캐러셀 (SNS.md 백로그 1)
    router.get('/promo/numbers', promoController.getNumbersCard);

    // 소개 페이지
    router.get('/about', async (req, res, next) => {
        try {
            res.render('about', {
                pageTitle: '사이트 소개',
                pageStyles: 'about',
                currentUrl: '/about',
                pageDesc: '당말사는 소속 정당이 아니라 의원 한 사람의 발의·표결·발언 기록으로 국회를 보는 사이트입니다. 데이터 출처와 한계, 중립성을 지키는 방법을 밝힙니다'
            });
        } catch (error) {
            next(error);
        }
    });

    // 용어 설명 — 2026-08-19 부터 「읽는 법」 아래 (/guide/glossary). 구 /glossary 는 301 (앵커 #id 는 브라우저가 유지한다)
    router.get('/glossary', (req, res) => res.redirect(301, '/guide/glossary'));
    router.get('/guide/glossary', async (req, res, next) => {
        try {
            res.render('glossary', {
                pageTitle: '용어 설명 · 읽는 법',
                pageStyles: 'guide',   // 상단 탭(.gd-tabs) 스타일
                articleCount: GUIDE_ARTICLES.length,
                currentUrl: '/guide/glossary',
                /* 🔴 실제 검색어가 「발의 뜻」 이었다 (Search Console 첫 유입, 2026-08-21). 사람들은 `○○ 뜻` 으로 찾는다 —
                   설명 첫머리를 그 형태에 맞춘다. 제목은 `용어 설명` 그대로 둔다 (검색어를 제목에 욱여넣으면 톤이 깨진다). */
                pageDesc: '발의·가결·계류·대안반영폐기가 무슨 뜻인지. 대표발의와 공동발의의 차이, 기권과 불참의 차이까지 국회 용어를 쉬운 말로 설명합니다'
            });
        } catch (error) {
            next(error);
        }
    });

    // 쟁점 — 뉴스에서 오가는 사안의 **국회 기록**. 기사를 수집·인용하지 않는다 (utils/issues.js 주석)
    // ⚠️ /issue/:slug 를 /issue 보다 뒤에 둘 것 (Express 는 먼저 걸리는 라우트가 이긴다)
    router.get('/issue', issueController.getIndexPage);
    router.get('/issue/:slug', issueController.getDetailPage);

    // 「읽는 법」 — 사람이 쓴 해설 글 (2026-08-19). 목록·메타는 utils/guideArticles.js 단일 소스, 본문은 views/guide/articles/<slug>.ejs
    router.get('/guide', async (req, res, next) => {
        try {
            res.render('guide/index', {
                pageTitle: '읽는 법',
                pageStyles: 'guide',
                currentUrl: '/guide',
                // ⚠️ 편수를 문장에 박지 말 것 — 6~8편을 추가했는데 설명은 "다섯 편" 으로 남아 있었다 (2026-08-21 수정).
                //    글을 늘리면 자동으로 따라오게 GUIDE_ARTICLES.length 를 쓴다
                pageDesc: `본회의 반대표는 왜 1%도 안 되는지, 발의 건수는 왜 순위가 아닌지, 성향 좌표는 무엇으로 만들었는지. 당말사의 숫자를 읽는 법을 글 ${GUIDE_ARTICLES.length}편으로 정리했습니다`,
                articles: GUIDE_ARTICLES
            });
        } catch (error) {
            next(error);
        }
    });
    router.get('/guide/:slug', async (req, res, next) => {
        try {
            const article = guideBySlug(req.params.slug);
            if (!article) {
                return res.status(404).render('error_pages/404', {
                    pageTitle: '찾을 수 없음', pageStyles: 'error', currentUrl: '/guide',
                    message: '해당 글을 찾을 수 없습니다.'
                });
            }
            /* 살아 있는 숫자는 실패해도 글은 나간다 — 본문이 "약" 으로 폴백한다 */
            const facts = await billService.getHomeFacts().catch((err) => {
                logger.warn(`guide: getHomeFacts 실패 — ${err.message}`);
                return null;
            });
            const { prev, next: nextArticle } = guideNeighbors(article.slug);
            res.render('guide/article', {
                pageTitle: `${article.title} · 읽는 법`,
                pageStyles: 'guide',
                currentUrl: `/guide/${article.slug}`,
                pageDesc: article.desc,
                ogTitle: `${article.title} · 당말사`,
                ogDesc: article.desc,
                article,
                index: GUIDE_ARTICLES.indexOf(article),
                facts,
                prev,
                next: nextArticle
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
    router.get('/my/activity',          requireLogin, myController.getActivityJson);   // 내 활동 페이징 (JSON)
    router.get('/my/analysis-requests', requireLogin, billController.getMyAnalysisRequestsPage);

    // 성향 진단 (밸런스 게임) — 5단계 + 매핑 페이지
    router.get('/balance-game',          balanceGameController.getInvitePage);
    router.get('/balance-game/respond',  balanceGameController.getRespondPage);
    router.get('/balance-game/reveal',   balanceGameController.getRevealPage);
    router.get('/balance-game/compare',  balanceGameController.getComparePage);
    router.get('/balance-game/connect',  (req, res) => res.redirect(301, '/balance-game/reveal'));   // 2026-08-16 폐지 — 카드(reveal)가 마지막 화면. 옛 링크 보호
    router.get('/balance-game/share',    balanceGameController.getSharePage);     // 결과 공유 이미지 (canvas)
    router.get('/balance-game/types',    balanceGameController.getTypesPage);     // 유형 9종 안내 (공개)
    router.get('/balance-game/mapping',  balanceGameController.getMappingPreviewPage);

    return router;
};
