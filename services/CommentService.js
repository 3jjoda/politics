import CommentDao from '../daos/CommentDao.js';

// ⚠️ DB 의 comments_type_check 제약과 **반드시 같은 집합**이어야 한다.
//    한쪽만 넓히면 조용히 400 이 난다 (실제로 'briefing' 추가 때 DB 만 넓혔다가 겪음).
const VALID_TYPES = new Set(['politician', 'bill', 'post', 'briefing']);

export default (db) => {
    const dao = CommentDao(db);
    return {
        /* 최근 대화 피드 — 타입 검증이 필요 없다 (전 종류를 그대로 낸다) */
        listRecent: (limit, offset) => dao.listRecent(limit, offset),

        list: (type, targetId) => {
            if (!VALID_TYPES.has(type)) throw new Error('INVALID_TYPE');
            if (!targetId) throw new Error('INVALID_TARGET');
            return dao.list(type, String(targetId));
        },
        create: ({ type, targetId, parentId, userId, content }) => {
            if (!VALID_TYPES.has(type)) throw new Error('INVALID_TYPE');
            if (!targetId) throw new Error('INVALID_TARGET');
            const trimmed = String(content || '').trim();
            if (!trimmed) throw new Error('EMPTY_CONTENT');
            if (trimmed.length > 2000) throw new Error('TOO_LONG');
            return dao.insert({
                type,
                targetId: String(targetId),
                parentId: parentId ? Number(parentId) : null,
                userId,
                content: trimmed
            });
        },
        update: async ({ id, userId, content }) => {
            const trimmed = String(content || '').trim();
            if (!trimmed) throw new Error('EMPTY_CONTENT');
            if (trimmed.length > 2000) throw new Error('TOO_LONG');
            return dao.update({ id, userId, content: trimmed });
        },
        softDelete: ({ id, userId }) => dao.softDelete({ id, userId })
    };
};
