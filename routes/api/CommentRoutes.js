import express from 'express';
import CommentController from '../../controllers/CommentController.js';
import { requireLogin } from '../../middlewares/auth.js';

export default (db) => {
    const router = express.Router();
    const c = CommentController(db);

    router.get('/',       c.list);
    router.post('/',      requireLogin, c.create);
    router.put('/:id',    requireLogin, c.update);
    router.delete('/:id', requireLogin, c.remove);

    return router;
};
