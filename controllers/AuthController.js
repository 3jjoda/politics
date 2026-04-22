import AuthService from '../services/AuthService.js';
import logger from '../utils/logger.js';

const GOOGLE_ENABLED = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const KAKAO_ENABLED  = !!process.env.KAKAO_CLIENT_ID;

/* 로그인 성공 후 돌아갈 URL 결정 (세션 next 또는 쿼리) */
const resolveNext = (req) => {
    const next = (req.session && req.session.authNext) || req.query.next || '/';
    if (req.session) delete req.session.authNext;
    if (typeof next !== 'string' || !next.startsWith('/')) return '/';
    return next;
};

export default (db) => {
    const authService = AuthService(db);

    return {
        /* 로그인 페이지 */
        renderLogin: (req, res) => {
            if (req.user) return res.redirect('/');
            if (req.query.next) req.session.authNext = String(req.query.next);
            res.render('auth/login', {
                pageTitle: '로그인 - 정치 바로미터',
                pageStyles: null,
                currentUrl: '/auth/login',
                providers: { google: GOOGLE_ENABLED, kakao: KAKAO_ENABLED },
                error: req.query.error || null
            });
        },

        /* 로그아웃 */
        logout: (req, res, next) => {
            req.logout((err) => {
                if (err) return next(err);
                req.session.destroy(() => {
                    res.clearCookie('connect.sid');
                    res.redirect('/');
                });
            });
        },

        /* OAuth 콜백 성공 — 이미 가입된 유저용 */
        oauthSuccess: (req, res) => {
            const redirectTo = resolveNext(req);
            logger.info(`OAuth login success: user_id=${req.user?.user_id} → ${redirectTo}`);
            res.redirect(redirectTo);
        },

        /* ===== 신규 가입 닉네임 설정 =====
           진입 조건:
             - 이미 로그인된 유저(req.user 또는 req.session.userId) → 홈으로
             - 세션에 OAuth pending 정보 없음 → 홈으로 (직접 URL 접근 차단)
             - pending 있고 비로그인 → 접근 허용
        */
        renderSetup: (req, res) => {
            if (req.user || req.session?.userId) return res.redirect('/');
            const pending = req.session.oauthPending;
            if (!pending) return res.redirect('/');

            res.render('auth/setup', {
                pageTitle: '닉네임 설정 - 정치 바로미터',
                pageStyles: null,
                currentUrl: '/auth/setup',
                pending,
                error: null
            });
        },

        submitSetup: async (req, res, next) => {
            try {
                if (req.user || req.session?.userId) return res.redirect('/');
                const pending = req.session.oauthPending;
                if (!pending) return res.redirect('/');

                const { nickname } = req.body || {};
                const v = authService.validateNickname(nickname);
                if (!v.ok) {
                    return res.status(400).render('auth/setup', {
                        pageTitle: '닉네임 설정 - 정치 바로미터',
                        pageStyles: null,
                        currentUrl: '/auth/setup',
                        pending,
                        error: v.reason
                    });
                }
                const available = await authService.isNicknameAvailable(v.value);
                if (!available) {
                    return res.status(400).render('auth/setup', {
                        pageTitle: '닉네임 설정 - 정치 바로미터',
                        pageStyles: null,
                        currentUrl: '/auth/setup',
                        pending,
                        error: '이미 사용 중인 닉네임입니다.'
                    });
                }

                const user = await authService.createOAuthUser({
                    provider:   pending.provider,
                    providerId: pending.providerId,
                    email:      pending.email,
                    nickname:   v.value
                });

                // 세션에서 pending 제거 후 로그인
                delete req.session.oauthPending;
                req.logIn(user, (err) => {
                    if (err) return next(err);
                    const redirectTo = resolveNext(req);
                    res.redirect(redirectTo);
                });
            } catch (err) {
                // UNIQUE 제약 동시 충돌 등
                if (err.code === '23505') {
                    return res.status(400).render('auth/setup', {
                        pageTitle: '닉네임 설정 - 정치 바로미터',
                        pageStyles: null,
                        currentUrl: '/auth/setup',
                        pending: req.session.oauthPending,
                        error: '이미 사용 중인 닉네임입니다.'
                    });
                }
                next(err);
            }
        },

        /* 닉네임 중복체크 API (클라이언트 실시간 체크용) */
        checkNickname: async (req, res, next) => {
            try {
                const { nickname } = req.query;
                const v = authService.validateNickname(nickname);
                if (!v.ok) return res.json({ available: false, reason: v.reason });
                const ok = await authService.isNicknameAvailable(v.value);
                res.json({
                    available: ok,
                    reason: ok ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.'
                });
            } catch (err) { next(err); }
        },

        /* 회원 탈퇴 (DELETE /api/auth/withdraw) */
        withdraw: async (req, res, next) => {
            try {
                const userId = req.session.userId || (req.user && req.user.user_id);
                if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });

                await authService.withdraw(userId);

                // 세션 완전 제거
                req.logout((err) => {
                    if (err) logger.warn('logout error during withdraw:', err.message);
                    req.session.destroy(() => {
                        res.clearCookie('connect.sid');
                        res.json({ ok: true, redirectTo: '/' });
                    });
                });
            } catch (err) { next(err); }
        }
    };
};
