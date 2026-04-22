import CommentDao from '../daos/CommentDao.js';

const VALID_TYPES = new Set(['politician', 'bill', 'post']);

export default (db) => {
    const dao = CommentDao(db);
    return {
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
