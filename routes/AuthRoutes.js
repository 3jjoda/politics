import express from 'express';
import passport from 'passport';
import AuthController from '../controllers/AuthController.js';

/* 공통 OAuth 콜백 핸들러
   - 기존 유저  → req.logIn → 원래 URL 리다이렉트
   - 신규 유저  → info.pending 을 세션에 저장하고 /auth/setup 으로 리다이렉트
*/
const makeCallback = (strategyName, authController) => (req, res, next) => {
    passport.authenticate(strategyName, (err, user, info) => {
        if (err) {
            console.error(`[${strategyName} OAuth Callback Error]`);
            console.error('  message   :', err.message);
            console.error('  name      :', err.name);
            console.error('  statusCode:', err.statusCode || err.status);
            console.error('  data      :', err.data || err.oauthError?.data);
            console.error('  stack     :', err.stack);
            return res.redirect(`/auth/login?error=${strategyName}`);
        }
        if (user) {
            // 기존 유저
            return req.logIn(user, (loginErr) => {
                if (loginErr) return next(loginErr);
                authController.oauthSuccess(req, res);
            });
        }
        if (info && info.pending) {
            // 신규 유저 — 닉네임 설정 페이지로
            req.session.oauthPending = info.pending;
            return res.redirect('/auth/setup');
        }
        return res.redirect(`/auth/login?error=${strategyName}`);
    })(req, res, next);
};

export default (db) => {
    const router = express.Router();
    const authController = AuthController(db);

    /* 로그인/로그아웃 */
    router.get('/login',   authController.renderLogin);
    router.get('/logout',  authController.logout);
    router.post('/logout', authController.logout);

    /* 닉네임 설정 */
    router.get('/setup',   authController.renderSetup);
    router.post('/setup',  authController.submitSetup);

    /* 환영 페이지 (가입 직후 1회) */
    router.get('/welcome',  authController.renderWelcome);
    router.post('/welcome', authController.ackWelcome);

    /* Google */
    router.get('/google',
        (req, res, next) => {
            if (req.query.next) req.session.authNext = String(req.query.next);
            next();
        },
        passport.authenticate('google', { scope: ['profile', 'email'] })
    );
    router.get('/google/callback', makeCallback('google', authController));

    /* Kakao */
    router.get('/kakao',
        (req, res, next) => {
            if (req.query.next) req.session.authNext = String(req.query.next);
            next();
        },
        passport.authenticate('kakao')
    );
    router.get('/kakao/callback', makeCallback('kakao', authController));

    return router;
};
