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

        /* 신규 OAuth 사용자 생성 — 닉네임 + 선택 프로필 */
        createOAuthUser: async ({ provider, providerId, email, nickname, gender = null, ageGroup = null }) => {
            const user = await userDao.insertOAuth({
                email: email || null,
                nickname,
                provider,
                providerId,
                gender,
                ageGroup
            });
            logger.info(`Auth: new OAuth user created (provider=${provider}, user_id=${user.user_id}, gender=${gender || '-'}, age=${ageGroup || '-'})`);
            return user;
        },

        /* 성별/연령대 값 검증 */
        GENDER_VALUES:    ['male', 'female', 'other'],
        AGE_GROUP_VALUES: ['10s', '20s', '30s', '40s', '50s', '60s'],
        validateGender: (v) => {
            if (v === undefined || v === null || v === '') return null;
            return ['male','female','other'].includes(v) ? v : null;
        },
        validateAgeGroup: (v) => {
            if (v === undefined || v === null || v === '') return null;
            return ['10s','20s','30s','40s','50s','60s'].includes(v) ? v : null;
        },

        findById: (userId) => userDao.findById(userId),

        /* 환영 페이지 1회 노출 마커 — welcomed_at = NOW() */
        markWelcomed: async (userId) => {
            await db.query(
                `UPDATE users SET welcomed_at = NOW() WHERE user_id = $1 AND welcomed_at IS NULL`,
                [userId]
            );
        },

        /* 회원 탈퇴 (익명화) */
        withdraw: async (userId) => {
            const result = await userDao.withdraw(userId);
            if (result) {
                logger.info(`Auth: user_id=${userId} 탈퇴 처리됨 (익명화)`);
            }
            return result;
        },

        /* 닉네임 변경 — 마이페이지 인라인 편집용 */
        /* 성별·연령대 변경 (2026-08-16). 값은 위 validate* 를 통과한 것만 받는다 */
        updateProfile: async (userId, gender, ageGroup) => userDao.updateProfile(userId, gender, ageGroup),
        getActivityCounts: (userId) => userDao.getActivityCounts(userId),
        getActivityPage: (userId, kind, page, per) => userDao.getActivityPage(userId, kind, page, per),

        updateNickname: async (userId, nickname) => {
            const updated = await userDao.updateNickname(userId, nickname);
            if (updated) {
                logger.info(`Auth: user_id=${userId} 닉네임 변경 → ${nickname}`);
            }
            return updated;
        }
    };
};
