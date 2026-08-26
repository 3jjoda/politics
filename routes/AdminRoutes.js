// routes/AdminRoutes.js — 관리자 전용
//
// ⚠️ 라우터 전체에 requireAdmin 을 건다. 라우트를 추가할 때 개별로 붙이는 걸 잊는 사고를 막기 위함.
// ⚠️ 권한 없으면 403 이 아니라 **404** 를 준다 (requireAdmin 참조) — 403 은 여기 관리자 페이지가
//    있다는 사실을 알려준다.
// 폼 기반(POST)이라 JS 없이도 동작한다. DELETE/PUT 대신 POST 를 쓰는 이유가 그것.

import express from 'express';
import AdminController from '../controllers/AdminController.js';
import AdminDao from '../daos/AdminDao.js';
import logger from '../utils/logger.js';
import { requireAdmin, sameOrigin } from '../middlewares/auth.js';

export default (db) => {
    const router = express.Router();
    const admin = AdminController(db);

    router.use(requireAdmin, sameOrigin);

    /* 🔴 미처리 신고 수를 **모든 관리자 화면**에 주입한다.
       신고 처리는 주기 작업이 아니라 사건이라 "가끔 들러서 확인" 으로는 잊힌다.
       각 페이지가 따로 세면 갈리므로 여기 한 곳에서만 센다.
       ⚠️ 실패해도 화면을 죽이지 않는다 — 배지는 부가 정보다 (null 이면 뷰가 숫자를 안 그린다). */
    const reportDao = AdminDao(db);
    router.use(async (req, res, next) => {
        try {
            const s = await reportDao.getReportSummary();
            res.locals.openReportCount = Number(s?.open_targets || 0);
        } catch (e) {
            logger.warn(`[admin] 미처리 신고 수 조회 실패: ${e.message}`);
            res.locals.openReportCount = null;
        }
        next();
    });

    router.get('/titles', admin.getTitlesPage);
    router.post('/titles', admin.createTitle);
    router.post('/titles/:id', admin.updateTitle);
    router.post('/titles/:id/delete', admin.deleteTitle);

    /* 신고 처리 — 대상 단위. `:type` 은 컨트롤러가 화이트리스트로 거른다 */
    router.get('/reports', admin.getReportsPage);
    router.post('/reports/:type/:targetId', admin.resolveReport);

    router.get('/stats', admin.getStatsPage);
    router.get('/schedule', admin.getSchedulePage);   // 운영 일정 (정기·조건부 작업 현황)
    router.get('/issue-candidates', admin.getIssueCandidatesPage);   // 쟁점 후보 발굴 + 기준 검사기
    router.get('/sns', admin.getSnsPage);             // SNS 콘텐츠 허브 (캐러셀·브리핑 카드·쓰레드 문안)

    return router;
};
