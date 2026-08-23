// routes/AdminRoutes.js — 관리자 전용
//
// ⚠️ 라우터 전체에 requireAdmin 을 건다. 라우트를 추가할 때 개별로 붙이는 걸 잊는 사고를 막기 위함.
// ⚠️ 권한 없으면 403 이 아니라 **404** 를 준다 (requireAdmin 참조) — 403 은 여기 관리자 페이지가
//    있다는 사실을 알려준다.
// 폼 기반(POST)이라 JS 없이도 동작한다. DELETE/PUT 대신 POST 를 쓰는 이유가 그것.

import express from 'express';
import AdminController from '../controllers/AdminController.js';
import { requireAdmin, sameOrigin } from '../middlewares/auth.js';

export default (db) => {
    const router = express.Router();
    const admin = AdminController(db);

    router.use(requireAdmin, sameOrigin);

    router.get('/titles', admin.getTitlesPage);
    router.post('/titles', admin.createTitle);
    router.post('/titles/:id', admin.updateTitle);
    router.post('/titles/:id/delete', admin.deleteTitle);

    router.get('/stats', admin.getStatsPage);
    router.get('/schedule', admin.getSchedulePage);   // 운영 일정 (정기·조건부 작업 현황)
    router.get('/issue-candidates', admin.getIssueCandidatesPage);   // 쟁점 후보 발굴 + 기준 검사기

    return router;
};
