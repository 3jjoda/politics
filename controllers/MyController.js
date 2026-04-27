// MyController.js — 마이페이지 (프로필 / 성향 카드 / 풀이 이력 / 분석 요청 요약)

import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';
import AuthService from '../services/AuthService.js';
import BillService from '../services/BillService.js';
import BalanceGameService, { AXES, MAPPING_VERSION } from '../services/BalanceGameService.js';

export default (db) => {
    const authService = AuthService(db);
    const billService = BillService(db);
    const bgService   = BalanceGameService(db);
    const controller = {};

    /* GET /my — 마이페이지 랜딩 */
    controller.getMyPage = wrapWithContext(async function getMyPage(req, res, next) {
        try {
            const userId = req.session?.userId || (req.user && req.user.user_id);
            if (!userId) {
                const next_ = encodeURIComponent('/my');
                return res.redirect(`/auth/login?next=${next_}`);
            }

            const [user, axisScore, packHistory, analysisRequests] = await Promise.all([
                authService.findById(userId),
                bgService.getUserAxisScore(userId),
                bgService.listUserPackHistory(userId),
                billService.getMyAnalysisRequests(userId)
            ]);

            if (!user) {
                // 세션은 있으나 DB 에서 사라진 경우 — 세션 정리하고 홈으로
                req.session.destroy(() => res.redirect('/'));
                return;
            }

            const completed = bgService.isCompleted(axisScore);
            const reqTotal   = analysisRequests.length;
            const reqDone    = analysisRequests.filter(r => r.has_ai_analysis).length;
            const reqPending = reqTotal - reqDone;

            res.render('my/profile', {
                pageTitle: '마이페이지 - 정치 바로미터',
                pageStyles: null,
                currentUrl: '/my',
                user,
                axisScore,
                completed,
                axes: AXES,
                mappingVersion: MAPPING_VERSION,
                packHistory,
                analysisSummary: {
                    total: reqTotal,
                    done: reqDone,
                    pending: reqPending,
                    recent: analysisRequests.slice(0, 3)
                }
            });
        } catch (err) {
            logger.error('마이페이지 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    return controller;
};
