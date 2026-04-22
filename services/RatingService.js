import RatingDao from '../daos/RatingDao.js';

export default (db) => {
    const dao = RatingDao(db);
    return {
        getStats: async (politicianId, userId) => {
            if (!politicianId) throw new Error('INVALID_TARGET');
            const stats = await dao.getStats(politicianId);
            const myScore = userId ? await dao.getMyScore(politicianId, userId) : null;
            return {
                avg: stats.avg != null ? Number(stats.avg) : 0,
                total: Number(stats.total || 0),
                distribution: {
                    1: Number(stats.score_1),
                    2: Number(stats.score_2),
                    3: Number(stats.score_3),
                    4: Number(stats.score_4),
                    5: Number(stats.score_5)
                },
                myScore
            };
        },
        rate: async (politicianId, userId, score) => {
            if (!politicianId) throw new Error('INVALID_TARGET');
            const s = Number(score);
            if (!Number.isInteger(s) || s < 1 || s > 5) throw new Error('INVALID_SCORE');
            return dao.upsert(politicianId, userId, s);
        }
    };
};
