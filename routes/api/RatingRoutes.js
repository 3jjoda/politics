import express from 'express';
import RatingController from '../../controllers/RatingController.js';
import { requireLogin } from '../../middlewares/auth.js';

export default (db) => {
    const router = express.Router();
    const c = RatingController(db);

    router.get('/politician/:monacd',                c.getPoliticianStats);
    router.post('/politician/:monacd', requireLogin, c.ratePolitician);

    return router;
};
