// BalanceGameService.js — 누적 모델 비즈니스 로직
import BalanceGameDao from '../daos/BalanceGameDao.js';
import logger from '../utils/logger.js';

export const MAPPING_VERSION = 'v1';
export const AXES = {
    economy:     { label: '경제',       left: '시장 자율',     right: '정부 개입' },
    social:      { label: '사회·문화',   left: '전통·질서',     right: '자율·다양성' },
    security:    { label: '안보·외교',   left: '동맹·대북강경', right: '자주·대북대화' },
    institution: { label: '정치제도',     left: '안정·기존질서', right: '개혁·재편' }
};

const VALID_ANSWERS = new Set(['A', 'B', 'C']);

export default (db) => {
    const dao = BalanceGameDao(db);

    return {
        AXES,
        MAPPING_VERSION,

        listPacks: () => dao.listPacks(),
        getPack:   (packId) => dao.getPack(packId),
        listQuestionsByPack: (packId) => dao.listQuestionsByPack(packId, MAPPING_VERSION),
        listAllActiveQuestions: () => dao.listAllActiveQuestions(MAPPING_VERSION),

        listUserResponsesByPack: (userId, packId) =>
            dao.listUserResponsesByPack(userId, packId, MAPPING_VERSION),

        listUserPackHistory: (userId) =>
            dao.listUserPackHistory(userId, MAPPING_VERSION),

        getUserAxisScore: (userId) => dao.getUserAxisScore(userId, MAPPING_VERSION),

        /* 응답 1건 저장 + 좌표 누적 갱신
           - questionId 가 packs_completed 의 question_count 를 채우면 자동 packs_completed 갱신 */
        respond: async ({ userId, questionId, answer }) => {
            if (!userId) throw new Error('UNAUTHORIZED');
            if (!VALID_ANSWERS.has(answer)) {
                const e = new Error('INVALID_ANSWER');
                e.code = 'INVALID_ANSWER';
                throw e;
            }
            // 문항 메타 조회 (axis / option_*_score / pack_id)
            const { rows: qRows } = await db.query(
                `SELECT id, pack_id, axis, option_a_score, option_b_score, mapping_version
                   FROM balance_game_questions
                  WHERE id = $1 AND is_active = TRUE
                  LIMIT 1`,
                [questionId]
            );
            const q = qRows[0];
            if (!q) {
                const e = new Error('QUESTION_NOT_FOUND');
                e.code = 'QUESTION_NOT_FOUND';
                throw e;
            }
            const score = answer === 'A' ? q.option_a_score
                       : answer === 'B' ? q.option_b_score
                       : 0;

            await dao.upsertResponse({
                userId,
                questionId: q.id,
                packId: q.pack_id,
                axis: q.axis,
                answer,
                score,
                mappingVersion: q.mapping_version
            });
            await dao.recomputeUserAxisScore(userId, q.mapping_version);

            const score4 = await dao.getUserAxisScore(userId, q.mapping_version);
            return {
                question_id: q.id,
                axis: q.axis,
                answer,
                score,
                user_axis_score: score4
            };
        },

        /* 게임팩 진행 상태 — 응답한 question_id 셋 / 다음 풀어야 할 인덱스 */
        getPackProgress: async (userId, packId) => {
            const [questions, responses] = await Promise.all([
                dao.listQuestionsByPack(packId, MAPPING_VERSION),
                userId ? dao.listUserResponsesByPack(userId, packId, MAPPING_VERSION) : Promise.resolve([])
            ]);
            const answeredSet = new Set(responses.map(r => r.question_id));
            const answersById = Object.fromEntries(responses.map(r => [r.question_id, r.answer]));
            // 다음 풀어야 할 인덱스 = answeredSet 에 없는 첫 번째
            const nextIdx = questions.findIndex(q => !answeredSet.has(q.id));
            return {
                questions,
                answers: answersById,
                answered_count: responses.length,
                total: questions.length,
                next_index: nextIdx === -1 ? questions.length : nextIdx,
                completed: nextIdx === -1 && questions.length > 0
            };
        },

        /* 단계 4 비교용 — 그룹 평균 + 전체 평균 + 임계값 정보 */
        GROUP_THRESHOLD_LOW: 50,
        GROUP_THRESHOLD_HIGH: 200,
        getGroupAxisAvg: (groupKey) => dao.getGroupAxisAvg(groupKey, MAPPING_VERSION),
        getOverallAxisAvg: () => dao.getOverallAxisAvg(MAPPING_VERSION),

        /* 인구 그룹 키 생성 — 'gender:F,age:20s' */
        buildGroupKey: ({ gender, ageGroup }) => {
            const parts = [];
            if (gender)   parts.push(`gender:${gender}`);
            if (ageGroup) parts.push(`age:${ageGroup}`);
            return parts.join(',');
        },

        /* balanceGameCompleted 판단 — packs_completed 에 'general' 포함 */
        isCompleted: (axisScore) => {
            if (!axisScore) return false;
            const completed = (axisScore.packs_completed || '').split(',').filter(Boolean);
            return completed.includes('general');
        }
    };
};
