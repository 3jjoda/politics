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
                pageTitle: '로그인',
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
                pageTitle: '닉네임 설정',
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

                const { nickname, gender, ageGroup } = req.body || {};
                const v = authService.validateNickname(nickname);
                if (!v.ok) {
                    return res.status(400).render('auth/setup', {
                        pageTitle: '닉네임 설정',
                        pageStyles: null,
                        currentUrl: '/auth/setup',
                        pending,
                        error: v.reason
                    });
                }
                const available = await authService.isNicknameAvailable(v.value);
                if (!available) {
                    return res.status(400).render('auth/setup', {
                        pageTitle: '닉네임 설정',
                        pageStyles: null,
                        currentUrl: '/auth/setup',
                        pending,
                        error: '이미 사용 중인 닉네임입니다.'
                    });
                }

                // 성별/연령대 필수 검증
                const genderValue   = authService.validateGender(gender);
                const ageGroupValue = authService.validateAgeGroup(ageGroup);
                if (!genderValue) {
                    return res.status(400).render('auth/setup', {
                        pageTitle: '닉네임 설정',
                        pageStyles: null,
                        currentUrl: '/auth/setup',
                        pending,
                        error: '성별을 선택해주세요.'
                    });
                }
                if (!ageGroupValue) {
                    return res.status(400).render('auth/setup', {
                        pageTitle: '닉네임 설정',
                        pageStyles: null,
                        currentUrl: '/auth/setup',
                        pending,
                        error: '연령대를 선택해주세요.'
                    });
                }

                const user = await authService.createOAuthUser({
                    provider:   pending.provider,
                    providerId: pending.providerId,
                    email:      pending.email,
                    nickname:   v.value,
                    gender:     genderValue,
                    ageGroup:   ageGroupValue
                });

                // 세션에서 pending 제거 후 로그인
                delete req.session.oauthPending;
                req.logIn(user, (err) => {
                    if (err) return next(err);
                    // 신규 가입자는 환영 페이지로. 원래 가려던 next 는 세션에 보존돼
                    // 환영 페이지의 [지금 풀기]/[둘러보기] 가 처리.
                    if (req.query.next || (req.session && req.session.authNext)) {
                        // 명시적 next 가 있으면 보존만 하고 welcome 으로
                    }
                    res.redirect('/auth/welcome');
                });
            } catch (err) {
                // UNIQUE 제약 동시 충돌 등
                if (err.code === '23505') {
                    return res.status(400).render('auth/setup', {
                        pageTitle: '닉네임 설정',
                        pageStyles: null,
                        currentUrl: '/auth/setup',
                        pending: req.session.oauthPending,
                        error: '이미 사용 중인 닉네임입니다.'
                    });
                }
                next(err);
            }
        },

        /* 환영 페이지 (가입 직후 1회 노출)
           - 비로그인 → 홈
           - welcomed_at 이미 NOT NULL → 홈 (1회 노출 보장)
           - 게임 완료 유저 → 홈 (이미 카드 있는 사람) */
        renderWelcome: async (req, res, next) => {
            try {
                const userId = req.session?.userId || (req.user && req.user.user_id);
                if (!userId) return res.redirect('/');
                const userRow = await authService.findById(userId);
                if (!userRow) return res.redirect('/');
                if (userRow.welcomed_at) return res.redirect('/');

                res.render('auth/welcome', {
                    pageTitle: '환영합니다',
                    pageStyles: 'auth/welcome',
                    currentUrl: '/auth/welcome',
                    user: userRow
                });
            } catch (err) { next(err); }
        },

        /* 환영 페이지 액션 — POST /auth/welcome
           body.choice: 'play' (지금 풀기) | 'browse' (둘러보기)
           welcomed_at = NOW() 박고 redirect */
        ackWelcome: async (req, res, next) => {
            try {
                const userId = req.session?.userId || (req.user && req.user.user_id);
                if (!userId) return res.redirect('/');
                await authService.markWelcomed(userId);
                const choice = String(req.body?.choice || 'browse');
                const target = choice === 'play' ? '/balance-game/respond?pack=general' : '/';
                res.redirect(target);
            } catch (err) { next(err); }
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

        /* 닉네임 변경 (PUT /api/auth/nickname) */
        updateNickname: async (req, res, next) => {
            try {
                const userId = req.session?.userId || (req.user && req.user.user_id);
                if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });

                const { nickname } = req.body || {};
                const v = authService.validateNickname(nickname);
                if (!v.ok) return res.status(400).json({ error: v.reason });

                const available = await authService.isNicknameAvailable(v.value);
                if (!available) {
                    // 본인 현재 닉네임이면 그냥 OK 응답 (no-op)
                    const me = await authService.findById(userId);
                    if (me && me.nickname === v.value) {
                        return res.json({ ok: true, nickname: v.value });
                    }
                    return res.status(409).json({ error: '이미 사용 중인 닉네임입니다.' });
                }

                const updated = await authService.updateNickname(userId, v.value);
                if (!updated) {
                    return res.status(409).json({ error: '닉네임 변경에 실패했습니다. 잠시 후 다시 시도해주세요.' });
                }
                res.json({ ok: true, nickname: updated.nickname });
            } catch (err) {
                if (err.code === '23505') {
                    return res.status(409).json({ error: '이미 사용 중인 닉네임입니다.' });
                }
                logger.error('닉네임 변경 중 에러:', `${err.message}\n${err.stack}`);
                next(err);
            }
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
