/**
 * 로그인이 반드시 필요한 라우트용 미들웨어.
 * - API 요청이면 401 JSON
 * - 페이지 요청이면 /auth/login?next=<원래 URL> 로 리다이렉트
 */
export const requireLogin = (req, res, next) => {
    if (!req.session?.userId) {
        const isApi = req.xhr
            || (req.headers.accept || '').includes('application/json')
            || req.originalUrl.startsWith('/api/');
        if (isApi) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }
        const next_ = encodeURIComponent(req.originalUrl || '/');
        return res.redirect(`/auth/login?next=${next_}`);
    }
    next();
};

/**
 * 모든 EJS 템플릿에서 currentUser 를 사용할 수 있도록 주입.
 * passport.deserializeUser 가 req.user 에 채워준 사용자 row 를 그대로 전달.
 */
export const injectUser = (req, res, next) => {
    res.locals.currentUser = req.user || null;
    // req.session.userId 별도 보관 — passport 미사용 경로(API 토큰 등) 대비
    if (req.user && req.user.user_id) {
        req.session.userId = req.user.user_id;
    }
    next();
};
