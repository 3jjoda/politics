import express from 'express';
import LikeController from '../../controllers/LikeController.js';
import { requireLogin } from '../../middlewares/auth.js';

export default (db) => {
    const router = express.Router();
    const c = LikeController(db);

    router.get('/',              c.getCount);
    router.post('/', requireLogin, c.toggle);

    return router;
};
