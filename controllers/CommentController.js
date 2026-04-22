import CommentService from '../services/CommentService.js';
import logger from '../utils/logger.js';

export default (db) => {
    const service = CommentService(db);

    return {
        list: async (req, res, next) => {
            try {
                const { type, targetId } = req.query;
                const rows = await service.list(type, targetId);
                res.json({ items: rows });
            } catch (err) {
                if (err.message === 'INVALID_TYPE' || err.message === 'INVALID_TARGET') {
                    return res.status(400).json({ error: err.message });
                }
                next(err);
            }
        },
        create: async (req, res, next) => {
            try {
                const { type, targetId, content, parentId } = req.body || {};
                const created = await service.create({
                    type,
                    targetId,
                    parentId,
                    userId: req.session.userId,
                    content
                });
                res.status(201).json({ item: created });
            } catch (err) {
                if (['INVALID_TYPE','INVALID_TARGET','EMPTY_CONTENT','TOO_LONG'].includes(err.message)) {
                    return res.status(400).json({ error: err.message });
                }
                next(err);
            }
        },
        update: async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                const { content } = req.body || {};
                const updated = await service.update({
                    id,
                    userId: req.session.userId,
                    content
                });
                if (!updated) return res.status(404).json({ error: 'NOT_FOUND_OR_FORBIDDEN' });
                res.json({ item: updated });
            } catch (err) {
                if (['EMPTY_CONTENT','TOO_LONG'].includes(err.message)) {
                    return res.status(400).json({ error: err.message });
                }
                next(err);
            }
        },
        remove: async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                const deleted = await service.softDelete({ id, userId: req.session.userId });
                if (!deleted) return res.status(404).json({ error: 'NOT_FOUND_OR_FORBIDDEN' });
                res.json({ ok: true, id: deleted.id });
            } catch (err) { next(err); }
        }
    };
};
