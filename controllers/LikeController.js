import LikeService from '../services/LikeService.js';

export default (db) => {
    const service = LikeService(db);
    return {
        getCount: async (req, res, next) => {
            try {
                const { type, targetId } = req.query;
                const data = await service.getCount(type, targetId, req.session.userId || null);
                res.json(data);
            } catch (err) {
                if (['INVALID_TYPE','INVALID_TARGET'].includes(err.message)) {
                    return res.status(400).json({ error: err.message });
                }
                next(err);
            }
        },
        toggle: async (req, res, next) => {
            try {
                const { type, targetId } = req.body || {};
                const data = await service.toggle(type, targetId, req.session.userId);
                res.json(data);
            } catch (err) {
                if (['INVALID_TYPE','INVALID_TARGET'].includes(err.message)) {
                    return res.status(400).json({ error: err.message });
                }
                next(err);
            }
        }
    };
};
