// controllers/ReportController.js — 신고 접수 (POST /api/reports)
//
// 🔴 서버 검증이 실제 방어선이다. 화면 select 는 조작된다 —
//    `resolveReason` 이 화이트리스트 밖 값을 막고, 특히 UI 에서 뺀 `political` 도 여기서 걸린다.

import ReportService from '../services/ReportService.js';
import logger from '../utils/logger.js';
import { resolveReason, resolveReportType, REPORT_REASONS } from '../utils/reportReasons.js';

export default (db) => {
    const service = ReportService(db);

    return {
        /* 사유 목록 — 화면이 하드코딩하지 않도록 (단일 소스는 utils/reportReasons.js) */
        getReasons: (req, res) => res.json({ reasons: REPORT_REASONS }),

        create: async (req, res, next) => {
            try {
                const { type: rawType, targetId: rawTarget, reason: rawReason } = req.body || {};
                const type = resolveReportType(rawType);
                const reason = resolveReason(rawReason);
                const targetId = Number(rawTarget);

                if (!type)   return res.status(400).json({ error: '신고할 수 없는 대상입니다.' });
                if (!reason) return res.status(400).json({ error: '선택할 수 없는 신고 사유입니다.' });
                if (!Number.isSafeInteger(targetId) || targetId <= 0) {
                    return res.status(400).json({ error: '잘못된 요청입니다.' });
                }
                /* 🔴 대상 실재 확인 — reports 에 FK 가 없어(대상이 두 테이블) 없는 id 로도 행이 생기고,
                      그러면 관리자 화면에 내용 없는 유령 행이 남는다 */
                if (!(await service.targetExists(type, targetId))) {
                    return res.status(404).json({ error: '이미 삭제되었거나 없는 대상입니다.' });
                }

                const counts = await service.create({ type, targetId, userId: req.session.userId, reason });
                logger.info(`[report] ${type}#${targetId} · ${reason} (user ${req.session.userId})`);
                res.json({ ok: true, total: counts.total, mine: counts.mine });
            } catch (err) {
                next(err);
            }
        },
    };
};
