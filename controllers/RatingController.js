import RatingService from '../services/RatingService.js';

export default (db) => {
    const service = RatingService(db);
    return {
        getPoliticianStats: async (req, res, next) => {
            try {
                const userId = req.session.userId || null;
                const data = await service.getStats(req.params.monacd, userId);
                res.json(data);
            } catch (err) {
                if (err.message === 'INVALID_TARGET') return res.status(400).json({ error: err.message });
                next(err);
            }
        },
        ratePolitician: async (req, res, next) => {
            try {
                const { score } = req.body || {};
                const row = await service.rate(req.params.monacd, req.session.userId, score);
                res.json({ item: row });
            } catch (err) {
                if (['INVALID_TARGET','INVALID_SCORE'].includes(err.message)) {
                    return res.status(400).json({ error: err.message });
                }
                next(err);
            }
        }
    };
};
