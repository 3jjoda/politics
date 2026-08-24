// BalanceGameService.js — 누적 모델 비즈니스 로직
import BalanceGameDao from '../daos/BalanceGameDao.js';
import logger from '../utils/logger.js';

import { AXIS_META } from '../utils/axisConfig.js';
import { scoreAnswers, sanitizeAnswers } from '../utils/anonAxis.js';
export const MAPPING_VERSION = 'v1';
// 🔴 축 이름·양끝 라벨은 utils/axisConfig.js AXIS_META 가 단일 소스 — 진단 화면과 의원 화면이 같은 말을 해야 한다 (2026-08-16)
export const AXES = Object.fromEntries(Object.entries(AXIS_META).map(([k, m]) => [k, { label: m.name, left: m.Lx, right: m.Rx }]));

const VALID_ANSWERS = new Set(['A', 'B', 'C']);

/* ===== 홈 히어로 첫 문항 =====
   🔴 2026-08-25 홈 재구성 — 히어로가 진단 첫 문항을 직접 물어본다 (퍼널 첫 칸 제거).
      홈은 가장 많이 열리는 페이지인데 문항은 **DB 마이그레이션으로만** 바뀌므로 오래 캐시해도 안전하다.
   ⚠️ 문항을 교체하면(2026-08-16 사회 문항처럼) 최대 이 시간만큼 옛 문항이 홈에 남는다. 재시작하면 즉시 반영. */
const Q1_TTL_MS = 30 * 60 * 1000;
let q1Cache = null;         // { at, packId, q }
let q1Inflight = null;

export default (db) => {
    const dao = BalanceGameDao(db);

    return {
        AXES,
        MAPPING_VERSION,

        listPacks: () => dao.listPacks(),
        getPack:   (packId) => dao.getPack(packId),
        listQuestionsByPack: (packId) => dao.listQuestionsByPack(packId, MAPPING_VERSION),

        /* 홈 히어로가 바로 물어보는 첫 문항 (display_order 순 1번).
           ⚠️ 실패해도 **null 을 돌려 홈은 살린다** — 문항 하나 때문에 첫 화면이 500 이 되면 안 된다.
           ⚠️ 화면은 여기서 받은 `id` 를 그대로 localStorage·POST 에 쓴다. 필드 이름을 바꾸지 말 것. */
        getFirstQuestion: async (packId = 'general') => {
            try {
                if (q1Cache && q1Cache.packId === packId && (Date.now() - q1Cache.at) < Q1_TTL_MS) return q1Cache.q;
                if (!q1Inflight) {
                    q1Inflight = dao.listQuestionsByPack(packId, MAPPING_VERSION)
                        .then((rows) => {
                            const q = rows && rows.length ? rows[0] : null;
                            q1Cache = { at: Date.now(), packId, q };
                            return q;
                        })
                        .finally(() => { q1Inflight = null; });
                }
                return await q1Inflight;
            } catch (err) {
                logger.error(`홈 첫 문항 조회 실패: ${err.message}`);
                return null;
            }
        },
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

        /* 답변 여러 건을 한 번에 — 비로그인 채점 · 로그인 승격 공용 (2026-08-24)
           🔴 로그인이면 **DB 에 저장**하고, 아니면 **채점만** 한다. 저장 여부가 유일한 차이라
              같은 답변이면 로그인 전후 좌표가 같다.
           ⚠️ 승격(로그인 직후 localStorage 답변을 올리는 것)도 이 경로를 탄다 — 지역구와 같은 패턴 */
        saveAnswers: async ({ userId, answers }) => {
            const clean = sanitizeAnswers(answers);
            if (!clean || Object.keys(clean).length === 0) {
                const e = new Error('NO_ANSWERS');
                e.code = 'NO_ANSWERS';
                throw e;
            }
            const [questions, packs] = await Promise.all([
                dao.listAllActiveQuestions(MAPPING_VERSION),
                dao.listPacks()
            ]);

            if (!userId) {
                // 비로그인 — DB 쓰기 0. 채점 결과만 돌려주고 호출부가 쿠키로 넘긴다
                return { stored: false, score: scoreAnswers({ questions, answers: clean, packs }) };
            }

            const byId = new Map(questions.map(q => [q.id, q]));
            for (const [qid, ans] of Object.entries(clean)) {
                const q = byId.get(qid);
                if (!q) continue;                      // 없는·비활성 문항은 조용히 버린다
                const score = ans === 'A' ? q.option_a_score
                            : ans === 'B' ? q.option_b_score
                            : 0;
                await dao.upsertResponse({
                    userId, questionId: q.id, packId: q.pack_id, axis: q.axis,
                    answer: ans, score, mappingVersion: q.mapping_version
                });
            }
            await dao.recomputeUserAxisScore(userId, MAPPING_VERSION);
            return { stored: true, score: await dao.getUserAxisScore(userId, MAPPING_VERSION) };
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
                // ⚠️ 활성 문항 기준으로 센다 — 비활성화된 옛 문항(q6·q7·q8·q10, 2026-08-16 교체)의 응답이 남아 있어
                //    responses.length 로 세면 20/20 인데 next_index 는 남는 모순이 난다
                answered_count: questions.filter(q => answeredSet.has(q.id)).length,
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
