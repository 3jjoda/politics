import LikeDao from '../daos/LikeDao.js';

const VALID = new Set(['comment', 'post']);

export default (db) => {
    const dao = LikeDao(db);
    return {
        getCount: async (type, targetId, userId) => {
            if (!VALID.has(type)) throw new Error('INVALID_TYPE');
            if (!targetId) throw new Error('INVALID_TARGET');
            const cnt = await dao.count(type, String(targetId));
            const liked = userId ? !!(await dao.findMy(type, String(targetId), userId)) : false;
            return { type, targetId: String(targetId), count: cnt, liked };
        },
        toggle: async (type, targetId, userId) => {
            if (!VALID.has(type)) throw new Error('INVALID_TYPE');
            if (!targetId) throw new Error('INVALID_TARGET');
            const exists = await dao.findMy(type, String(targetId), userId);
            let liked;
            if (exists) {
                await dao.remove(type, String(targetId), userId);
                liked = false;
            } else {
                await dao.insert(type, String(targetId), userId);
                liked = true;
            }
            const count = await dao.count(type, String(targetId));
            return { type, targetId: String(targetId), liked, count };
        }
    };
};
