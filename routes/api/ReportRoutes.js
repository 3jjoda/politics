import express from 'express';
import ReportController from '../../controllers/ReportController.js';
import { requireLogin } from '../../middlewares/auth.js';

export default (db) => {
    const router = express.Router();
    const c = ReportController(db);

    router.get('/reasons', c.getReasons);
    router.post('/', requireLogin, c.create);   // 🔴 비로그인 신고는 받지 않는다 (남용 방어의 최소선)

    return router;
};
