import express from 'express';
import VoteController from '../../controllers/VoteController.js';
import { requireLogin } from '../../middlewares/auth.js';

export default (db) => {
    const router = express.Router();
    const c = VoteController(db);

    router.get('/bill/:billId',                c.getStats);
    router.post('/bill/:billId', requireLogin, c.vote);

    return router;
};
