import VoteService from '../services/VoteService.js';

export default (db) => {
    const service = VoteService(db);
    return {
        getStats: async (req, res, next) => {
            try {
                const userId = req.session.userId || null;
                const data = await service.getStats(req.params.billId, userId);
                res.json(data);
            } catch (err) {
                if (err.message === 'INVALID_TARGET') return res.status(400).json({ error: err.message });
                next(err);
            }
        },
        vote: async (req, res, next) => {
            try {
                const { vote } = req.body || {};
                const row = await service.vote(req.params.billId, req.session.userId, vote);
                res.json({ item: row });
            } catch (err) {
                if (['INVALID_TARGET','INVALID_VOTE'].includes(err.message)) {
                    return res.status(400).json({ error: err.message });
                }
                next(err);
            }
        }
    };
};
