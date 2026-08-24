import AuthService from '../services/AuthService.js';
import DistrictService from '../services/DistrictService.js';
import BalanceGameService from '../services/BalanceGameService.js';
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
    const districtService = DistrictService(db);   // 내 지역구 (2026-08-23)
    // 환영 화면이 진단 상태를 물어본다 (익명으로 풀고 가입하는 흐름 — 2026-08-24)
    const balanceGameService = BalanceGameService(db);

    return {
        /* 로그인 페이지 */
        renderLogin: (req, res) => {
            if (req.user) return res.redirect('/');
            /* 🔴 여기서 세션에 쓰지 않는다 (2026-08-18). 로그인 페이지를 **보기만 해도** 세션이
               초기화돼 `saveUninitialized:false` 가 무력해지고 요청마다 DB 행이 하나씩 생겼다.
               법안 상세마다 `/auth/login?next=/bill/…` 링크가 있어 **크롤러가 그걸 따라가면 폭증한다** —
               실측 익명 세션 8,599건 중 8,553건(99.5%)이 법안 상세 next, 08-14 크롤러 사건 당일에만 4,805건.
               → `next` 는 아래 provider 링크의 쿼리로 넘기고, 세션 쓰기는 실제로 OAuth 를 시작하는
                 `/auth/google?next=` · `/auth/kakao?next=`(routes/AuthRoutes.js)에서만 한다. */
            const nextParam = req.query.next ? String(req.query.next) : '';
            res.render('auth/login', {
                pageTitle: '로그인',
                pageStyles: null,
                currentUrl: '/auth/login',
                nextParam,
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

                const { nickname, gender, ageGroup, agree } = req.body || {};
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

                /* 🔴 필수 동의 — **여기가 실제 방어선이다.** 화면의 체크박스는 JS 로 우회된다.
                   ① 개인정보 수집·이용 동의 ② 만 14세 이상이라는 이용자의 진술을 함께 받는다.
                   연령을 검증할 수단은 없지만, 진술이 있어야 약관 4항의 사후 조치에 근거가 생긴다.
                   ⚠️ 체크박스 미체크 시 브라우저가 필드를 아예 안 보내므로 `undefined` 도 걸러야 한다 */
                if (agree !== '1') {
                    return res.status(400).render('auth/setup', {
                        pageTitle: '닉네임 설정',
                        pageStyles: null,
                        currentUrl: '/auth/setup',
                        pending,
                        error: '만 14세 이상이며 이용약관·개인정보처리방침에 동의해야 가입할 수 있습니다.'
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
                    /* 신규 가입자는 환영 페이지로.
                       ⚠️ next 를 여기서 따라가지 않는다 — 환영 화면이 진단 상태를 보고 목적지를 정한다
                          (이미 푼 사람 → 결과 카드 / 부분 → 이어서 / 처음 → 문항).
                          예전엔 여기에 "next 가 있으면 보존" 이라는 **빈 if 문**이 있었다. 아무 일도 안 했다 */
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

           🔴 **이미 진단을 푼 사람에게 "20문항 · 약 5분" 을 보여주면 안 된다** (2026-08-24 사용자 보고).
              비로그인으로 풀고 가입하는 흐름이 생기면서(익명 진단) 실제로 그렇게 나왔다 —
              방금 5분을 쓴 사람에게 첫 화면이 다시 5분을 요구했다.
           ⚠️ 서버만으로는 판정이 안 된다. 익명 답변은 **localStorage** 에 있고 승격은 로그인 뒤
              클라이언트가 하므로, 이 페이지를 그릴 때는 아직 DB 에 없을 수 있다.
              → 서버는 DB 기준(`carry`)만 넘기고, 화면이 localStorage 를 보고 첫 페인트 전에 마저 판정한다 */
        renderWelcome: async (req, res, next) => {
            try {
                const userId = req.session?.userId || (req.user && req.user.user_id);
                if (!userId) return res.redirect('/');
                const userRow = await authService.findById(userId);
                if (!userRow) return res.redirect('/');
                if (userRow.welcomed_at) return res.redirect('/');

                // 승격이 이미 끝난 경우(다른 탭에서 먼저 돌았다) DB 로 바로 알 수 있다
                let carry = null;
                try {
                    const bg = balanceGameService;
                    const [score, pack] = await Promise.all([
                        bg.getUserAxisScore(userId),
                        bg.getPack('general')
                    ]);
                    const total = pack?.question_count || 0;
                    if (score && Number(score.total_responses) > 0) {
                        carry = {
                            answered: Math.min(Number(score.total_responses), total || Number(score.total_responses)),
                            total,
                            completed: bg.isCompleted(score)
                        };
                    }
                } catch (e) {
                    carry = null;   // 진단 상태를 못 읽어도 환영 화면은 떠야 한다 (기본 안내로 폴백)
                }

                res.render('auth/welcome', {
                    pageTitle: '환영합니다',
                    pageStyles: 'auth/welcome',
                    currentUrl: '/auth/welcome',
                    user: userRow,
                    carry,
                    generalTotal: carry?.total || 20
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
                /* card   : 이미 다 푼 사람 → 결과 카드 (익명으로 풀고 가입한 흐름의 목적지)
                   resume : 부분만 푼 사람 → 남은 문항부터
                   play   : 처음 푸는 사람
                   browse : 나중에 */
                const choice = String(req.body?.choice || 'browse');
                const target = choice === 'card'   ? '/balance-game/reveal'
                             : choice === 'resume' ? '/balance-game/respond?pack=general'
                             : choice === 'play'   ? '/balance-game/respond?pack=general'
                             : '/';
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

        /* 성별·연령대 변경 (PUT /api/auth/profile) — 통계용 값이라 본인이 고칠 수 있어야 한다 (2026-08-16) */
        updateProfile: async (req, res, next) => {
            try {
                const userId = req.session?.userId || (req.user && req.user.user_id);
                if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });
                const { gender, ageGroup } = req.body || {};
                const g = authService.validateGender(gender);
                const a = authService.validateAgeGroup(ageGroup);
                if (!g || !a) return res.status(400).json({ error: '성별과 연령대를 올바르게 선택해주세요.' });
                const updated = await authService.updateProfile(userId, g, a);
                if (!updated) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
                res.json({ ok: true, gender: updated.gender, ageGroup: updated.age_group });
            } catch (err) {
                logger.error('프로필 변경 중 에러:', `${err.message}\n${err.stack}`);
                next(err);
            }
        },

        /* 내 지역구 등록·변경 (PUT /api/auth/district)
           🔴 값은 **DB 의 실제 지역구 화이트리스트**로 검증한다 (임의 문자열 저장 금지).
           ⚠️ 빈 값이면 등록 해제로 본다 — 지우는 길이 없으면 한 번 고르면 못 무른다. */
        updateDistrict: async (req, res, next) => {
            try {
                const userId = req.session?.userId || (req.user && req.user.user_id);
                if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });

                const raw = typeof req.body?.district === 'string' ? req.body.district.trim() : '';
                if (raw && !(await districtService.isValid(raw))) {
                    return res.status(400).json({ error: '없는 지역구입니다.' });
                }
                const saved = await authService.updateDistrict(userId, raw || null);
                if (!saved) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
                res.json({ ok: true, district: saved.district });
            } catch (err) {
                logger.error('지역구 변경 중 에러:', `${err.message}
${err.stack}`);
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
