// routes/ApiRoutes.js

import express from 'express';
import InitController from '../controllers/InitController.js';
import PoliticianController from '../controllers/PoliticianController.js';
import BillController from '../controllers/BillController.js';
import BalanceGameController from '../controllers/BalanceGameController.js';
import BriefingController from '../controllers/BriefingController.js';
import IssueController from '../controllers/IssueController.js';
import DistrictController from '../controllers/DistrictController.js';

export default (db) => {
    const router = express.Router();

    const initController = InitController(db);
    const politicianController = PoliticianController(db);
    const billController = BillController(db);
    const balanceGameController = BalanceGameController(db);
    const briefingController = BriefingController(db);
    const issueController = IssueController(db);
    const districtController = DistrictController(db);

    // API 목록
    /* 초기화 */
    router.get('/initialize', initController.getInitialData);

    /* 정치인 */
    router.get('/politician', politicianController.getList);        // 국회의원 목록
    router.get('/politician:id', politicianController.getDetail);   // 국회의원 상세
    /* 의원 상세 지연 로딩 — 🔴 전건 SSR 을 대체한다 (887행 = 1.1MB 였다) */
    router.get('/politician/:monaCd/bills', politicianController.getBillsPageApi);  // 법안 활동 탭 한 페이지
    router.get('/politician/:monaCd/votes', politicianController.getVotesByMonthApi); // 월별 표결 참여 패널

    /* 법안 */
    router.get('/bill', billController.getList);            // 법안 목록
    router.get('/bill:id', billController.getDetail);       // 법안 상세
    router.get('/bills/trending', billController.getTrending); // 홈 주목할 법안 (sort)
    router.get('/bills/search', billController.search);     // 법안 검색 (커뮤니티 첨부용)
    router.get('/bill/:id/analysis-status', billController.getAnalysisStatus); // AI 분석 요청 상태

    /* 브리핑 내보내기 — Make·n8n 등 자동화 툴이 쓰레드·인스타 게시 재료를 가져가는 곳 */
    router.get('/briefing/export', briefingController.getBriefingExport);

    // 쟁점 — 접힌 「법안 전체 보기」의 한 페이지 (추가 쿼리 0, 캐시된 전건을 자른다)
    router.get('/issue/:slug/bills', issueController.getBillsPageApi);

    // 지역구 — **공개**. 비로그인도 고를 수 있어야 장벽이 낮다 (선택은 브라우저에만 남는다)
    router.get('/district/list', districtController.getList);
    router.get('/district/member', districtController.getMember);

    /* 밸런스 게임 — 응답 저장·점수 조회 */
    router.post('/balance-game/respond', balanceGameController.respondApi);
    // 답변 전체를 한 번에 — **비로그인도 호출한다** (채점만, DB 쓰기 0). 로그인 상태면 저장·승격까지
    router.post('/balance-game/answers', balanceGameController.answersApi);
    router.get('/balance-game/score',    balanceGameController.scoreApi);

    return router;
};