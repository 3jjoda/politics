import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as KakaoStrategy } from 'passport-kakao';
import AuthService from '../services/AuthService.js';
import logger from '../utils/logger.js';

/**
 * Passport 설정.
 *
 * verify 콜백 규약:
 *   - 이미 가입된 유저 → done(null, user)
 *   - 신규 유저         → done(null, false, { pending: profileData })
 *     (가입은 /auth/setup 에서 닉네임 선택 후에 진행됨)
 *
 * 콜백 라우트(AuthRoutes) 가 info.pending 를 세션에 저장하고 /auth/setup 으로 라우팅.
 */
export default (db) => {
    const authService = AuthService(db);

    passport.serializeUser((user, done) => done(null, user.user_id));
    passport.deserializeUser(async (userId, done) => {
        try {
            const user = await authService.findById(userId);
            done(null, user || false);
        } catch (err) {
            done(err);
        }
    });

    const resolveOAuth = async ({ provider, providerId, email, displayName, profileImage }, done) => {
        try {
            const existing = await authService.findExistingOAuth(provider, providerId);
            if (existing) return done(null, existing);
            // 신규 — pending 정보만 전달 (DB insert 하지 않음)
            return done(null, false, {
                pending: { provider, providerId, email: email || null, displayName: displayName || '', profileImage: profileImage || null }
            });
        } catch (err) {
            logger.error(`OAuth verify error (${provider}):`, err.message);
            done(err);
        }
    };

    /* ===== Google ===== */
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        const baseUrl = process.env.BASE_URL || '';
        passport.use(new GoogleStrategy({
            clientID:     process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL:  `${baseUrl}/auth/google/callback`,
            scope:        ['profile', 'email']
        }, async (accessToken, refreshToken, profile, done) => {
            const email = profile.emails && profile.emails[0] && profile.emails[0].value;
            const profileImage = profile.photos && profile.photos[0] && profile.photos[0].value;
            resolveOAuth({
                provider:    'google',
                providerId:  profile.id,
                email,
                displayName: profile.displayName,
                profileImage
            }, done);
        }));
    } else {
        logger.warn('Google OAuth 비활성화 — GOOGLE_CLIENT_ID/SECRET 없음');
    }

    /* ===== Kakao =====
       - Kakao 앱에서 "Client Secret 사용" 을 켠 경우에만 KAKAO_CLIENT_SECRET 지정
       - 꺼진 경우 옵션에 clientSecret 을 아예 포함하지 않아야 함
    */
    if (process.env.KAKAO_CLIENT_ID) {
        const baseUrl = process.env.BASE_URL || '';
        const kakaoOptions = {
            clientID:    process.env.KAKAO_CLIENT_ID,
            callbackURL: `${baseUrl}/auth/kakao/callback`
        };
        if (process.env.KAKAO_CLIENT_SECRET) {
            kakaoOptions.clientSecret = process.env.KAKAO_CLIENT_SECRET;
        }
        logger.info(`Kakao OAuth 활성화 — clientID=${process.env.KAKAO_CLIENT_ID.slice(0, 6)}…(len=${process.env.KAKAO_CLIENT_ID.length}), secret=${process.env.KAKAO_CLIENT_SECRET ? 'yes' : 'no'}, callback=${kakaoOptions.callbackURL}`);

        const kakaoStrategy = new KakaoStrategy(kakaoOptions, async (accessToken, refreshToken, profile, done) => {
            const kakaoAccount = profile._json && profile._json.kakao_account;
            const email = kakaoAccount && kakaoAccount.email;
            const nickname = (kakaoAccount && kakaoAccount.profile && kakaoAccount.profile.nickname) || profile.displayName;
            const profileImage = (kakaoAccount && kakaoAccount.profile && (kakaoAccount.profile.profile_image_url || kakaoAccount.profile.thumbnail_image_url)) || null;
            resolveOAuth({
                provider:    'kakao',
                providerId:  String(profile.id),
                email,
                displayName: nickname,
                profileImage
            }, done);
        });

        // Kakao 에서 내려온 error_code 까지 캐내기 위한 parseErrorResponse 오버라이드
        kakaoStrategy.parseErrorResponse = function (body, status) {
            console.error('[Kakao Token RAW response]');
            console.error('  status:', status);
            console.error('  body  :', body);
            try {
                const json = JSON.parse(body);
                const err = new Error(`${json.error_description} (${json.error_code || json.error})`);
                err.status = status;
                err.oauth = json;
                return err;
            } catch (e) {
                return null;
            }
        };

        passport.use(kakaoStrategy);
    } else {
        logger.warn('Kakao OAuth 비활성화 — KAKAO_CLIENT_ID 없음');
    }

    return passport;
};
