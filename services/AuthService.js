import UserDao from '../daos/UserDao.js';
import logger from '../utils/logger.js';

/* 닉네임 규칙 — 2~20자, 한글/영문/숫자/언더스코어 */
const NICKNAME_RE = /^[가-힣a-zA-Z0-9_]{2,20}$/;

export default (db) => {
    const userDao = UserDao(db);

    return {
        /* provider + provider_id 로 기존 사용자 조회 (없으면 null) */
        findExistingOAuth: async (provider, providerId) => {
            return userDao.findByProvider(provider, providerId);
        },

        /* 닉네임 포맷 검증 */
        validateNickname: (nickname) => {
            if (!nickname) return { ok: false, reason: '닉네임을 입력해주세요.' };
            const trimmed = String(nickname).trim();
            if (!NICKNAME_RE.test(trimmed)) {
                return {
                    ok: false,
                    reason: '2~20자의 한글·영문·숫자·언더스코어(_)만 사용할 수 있습니다.'
                };
            }
            return { ok: true, value: trimmed };
        },

        /* 닉네임 사용 가능 여부 (DB 조회) */
        isNicknameAvailable: async (nickname) => {
            const exists = await userDao.nicknameExists(nickname);
            return !exists;
        },

        /* 신규 OAuth 사용자 생성 — 닉네임 사용자 지정 */
        createOAuthUser: async ({ provider, providerId, email, nickname }) => {
            const user = await userDao.insertOAuth({
                email: email || null,
                nickname,
                provider,
                providerId
            });
            logger.info(`Auth: new OAuth user created (provider=${provider}, user_id=${user.user_id}, email=${email ? 'yes' : 'no'})`);
            return user;
        },

        findById: (userId) => userDao.findById(userId),

        /* 회원 탈퇴 (익명화) */
        withdraw: async (userId) => {
            const result = await userDao.withdraw(userId);
            if (result) {
                logger.info(`Auth: user_id=${userId} 탈퇴 처리됨 (익명화)`);
            }
            return result;
        }
    };
};
