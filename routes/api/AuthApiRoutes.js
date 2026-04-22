import express from 'express';
import AuthController from '../../controllers/AuthController.js';
import { requireLogin } from '../../middlewares/auth.js';

export default (db) => {
    const router = express.Router();
    const c = AuthController(db);

    // 닉네임 중복 체크 (실시간 피드백용)
    router.get('/check-nickname', c.checkNickname);

    // 회원 탈퇴 (익명화)
    router.delete('/withdraw', requireLogin, c.withdraw);

    return router;
};
