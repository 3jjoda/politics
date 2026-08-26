// services/ReportService.js — 신고 접수
//
// 🔴 대상이 실재하는지 반드시 확인한다. `reports` 에 FK 가 없어서(대상이 두 테이블이라)
//    없는 id 로도 행이 만들어지고, 그러면 관리자 화면에 내용 없는 유령 행이 남는다.

import ReportDao from '../daos/ReportDao.js';

export default (db) => {
    const dao = ReportDao(db);

    /* 대상 실재 확인 — 삭제된 것도 신고 대상이 아니다 (이미 안 보인다) */
    const targetExists = async (type, targetId) => {
        const table = type === 'comment' ? 'comments' : 'posts';
        const { rows } = await db.query(
            `SELECT 1 FROM ${table} WHERE id = $1 AND is_deleted = FALSE`, [targetId]);
        return rows.length > 0;
    };

    return {
        targetExists,

        create: async ({ type, targetId, userId, reason }) => {
            await dao.insert({ type, targetId, userId, reason });
            return dao.countForTarget({ type, targetId, userId });
        },

        countForTarget: (params) => dao.countForTarget(params),
    };
};
