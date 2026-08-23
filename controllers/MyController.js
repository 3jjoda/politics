// MyController.js — 마이페이지 (프로필 / 성향 카드 / 풀이 이력 / 분석 요청 요약)

import DistrictService from '../services/DistrictService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';
import AuthService from '../services/AuthService.js';
import BillService from '../services/BillService.js';
import BalanceGameService, { AXES, MAPPING_VERSION } from '../services/BalanceGameService.js';

const ACT_KINDS = ['comment', 'vote', 'rating', 'post'];
const ACT_PER = 10;

export default (db) => {
    const districtService = DistrictService(db);   // 내 지역구 (2026-08-23)
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

            const [user, axisScore, packHistory, analysisRequests, actCounts] = await Promise.all([
                authService.findById(userId),
                bgService.getUserAxisScore(userId),
                bgService.listUserPackHistory(userId),
                billService.getMyAnalysisRequests(userId),
                authService.getActivityCounts(userId).catch(err => { logger.error('내 활동 총계 조회 실패:', err.message); return null; })
            ]);
            // 내 활동 — 기본 탭은 활동이 있는 첫 종류 (전부 0 이면 댓글). 첫 페이지는 SSR, 이후는 /my/activity JSON
            const ACT_ORDER = [['comment', 'comments'], ['vote', 'votes'], ['rating', 'ratings'], ['post', 'posts']];
            const defaultKind = (actCounts && (ACT_ORDER.find(([, k]) => actCounts[k] > 0) || ACT_ORDER[0])[0]) || 'comment';
            const actPage = actCounts
                ? await authService.getActivityPage(userId, defaultKind, 1, ACT_PER).catch(err => { logger.error('내 활동 조회 실패:', err.message); return null; })
                : null;

            if (!user) {
                // 세션은 있으나 DB 에서 사라진 경우 — 세션 정리하고 홈으로
                req.session.destroy(() => res.redirect('/'));
                return;
            }

            const completed = bgService.isCompleted(axisScore);
            const reqTotal   = analysisRequests.length;
            const reqDone    = analysisRequests.filter(r => r.has_ai_analysis).length;
            const reqPending = reqTotal - reqDone;

            /* 내 지역구 (2026-08-23) — 목록은 6시간 캐시, 실패해도 null 이라 마이페이지는 산다 */
            const [districtList, myMember] = await Promise.all([
                districtService.getList(),
                districtService.getMember(req.user && req.user.district),
            ]);

            res.render('my/profile', {
                districtGroups: districtList ? districtList.groups : [],
                myMember,
                pageTitle: '마이페이지',
                pageStyles: null,
                currentUrl: '/my',
                user,
                axisScore,
                completed,
                axes: AXES,
                mappingVersion: MAPPING_VERSION,
                packHistory,
                activity: { counts: actCounts, kind: defaultKind, page: actPage, per: ACT_PER },
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

    /* GET /my/activity?kind=comment|vote|rating|post&page=N — 내 활동 한 페이지 (JSON, 본인 전용) */
    controller.getActivityJson = wrapWithContext(async function getActivityJson(req, res, next) {
        try {
            const userId = req.session?.userId || (req.user && req.user.user_id);
            if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });
            const kind = ACT_KINDS.includes(req.query.kind) ? req.query.kind : 'comment';   // 모르는 값은 조용히 기본값으로
            let page = parseInt(req.query.page, 10); if (!Number.isFinite(page) || page < 1) page = 1;
            let data = await authService.getActivityPage(userId, kind, page, ACT_PER);
            if (page > data.pages) data = await authService.getActivityPage(userId, kind, data.pages, ACT_PER);   // 범위 밖은 마지막으로 접는다
            res.set('Cache-Control', 'no-store');
            res.json({ kind, ...data });
        } catch (err) {
            logger.error('내 활동 조회 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    return controller;
};
