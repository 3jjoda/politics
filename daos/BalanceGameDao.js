// BalanceGameDao.js — 밸런스 게임 누적 모델 DB 접근
// SQL 인라인 (도메인이 작아서 쿼리 파일 분리 X)

const MAPPING_VERSION_DEFAULT = 'v1';

export default (db) => {
    return {
        /* 게임팩 목록 — 활성 + display_order */
        listPacks: async () => {
            const { rows } = await db.query(`
                SELECT p.id, p.title, p.description, p.question_count, p.is_general,
                       p.display_order, p.created_at,
                       (SELECT COUNT(*)::int FROM balance_game_questions q
                          WHERE q.pack_id = p.id AND q.is_active = TRUE) AS active_question_count
                  FROM balance_game_packs p
                 WHERE p.is_active = TRUE
                 ORDER BY p.is_general DESC, p.display_order ASC, p.created_at ASC
            `);
            return rows;
        },

        /* 게임팩 단건 조회 */
        getPack: async (packId) => {
            const { rows } = await db.query(
                `SELECT id, title, description, question_count, is_general, display_order
                   FROM balance_game_packs
                  WHERE id = $1 AND is_active = TRUE
                  LIMIT 1`,
                [packId]
            );
            return rows[0] || null;
        },

        /* 게임팩 활성 문항 (display_order 순) */
        listQuestionsByPack: async (packId, mappingVersion = MAPPING_VERSION_DEFAULT) => {
            const { rows } = await db.query(`
                SELECT id, pack_id, axis, prompt,
                       option_a_text, option_a_score,
                       option_b_text, option_b_score,
                       display_order, mapping_version
                  FROM balance_game_questions
                 WHERE pack_id = $1 AND is_active = TRUE AND mapping_version = $2
                 ORDER BY display_order ASC, id ASC
            `, [packId, mappingVersion]);
            return rows;
        },

        /* 모든 활성 문항 (매핑 페이지용) */
        listAllActiveQuestions: async (mappingVersion = MAPPING_VERSION_DEFAULT) => {
            const { rows } = await db.query(`
                SELECT id, pack_id, axis, prompt,
                       option_a_text, option_a_score,
                       option_b_text, option_b_score,
                       display_order, mapping_version
                  FROM balance_game_questions
                 WHERE is_active = TRUE AND mapping_version = $1
                 ORDER BY pack_id ASC, display_order ASC
            `, [mappingVersion]);
            return rows;
        },

        /* 한 유저의 응답 — 게임팩 단위 */
        listUserResponsesByPack: async (userId, packId, mappingVersion = MAPPING_VERSION_DEFAULT) => {
            const { rows } = await db.query(`
                SELECT question_id, answer, score, axis, created_at
                  FROM balance_game_responses
                 WHERE user_id = $1 AND pack_id = $2 AND mapping_version = $3
                 ORDER BY created_at ASC
            `, [userId, packId, mappingVersion]);
            return rows;
        },

        /* 응답 1건 저장 (UNIQUE 충돌 시 UPDATE — 같은 질문 재응답 가능) */
        upsertResponse: async ({ userId, questionId, packId, axis, answer, score, mappingVersion = MAPPING_VERSION_DEFAULT }) => {
            await db.query(`
                INSERT INTO balance_game_responses
                       (user_id, question_id, pack_id, axis, answer, score, mapping_version)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (user_id, question_id, mapping_version) DO UPDATE
                  SET answer = EXCLUDED.answer,
                      score  = EXCLUDED.score,
                      created_at = NOW()
            `, [userId, questionId, packId, axis, answer, score, mappingVersion]);
        },

        /* 유저의 누적 좌표 재계산 — 응답 → 4축 평균 + 응답 카운트 + packs_completed */
        recomputeUserAxisScore: async (userId, mappingVersion = MAPPING_VERSION_DEFAULT) => {
            await db.query(`
                INSERT INTO user_axis_score
                       (user_id, mapping_version,
                        economy, economy_count,
                        social,  social_count,
                        security, security_count,
                        institution, institution_count,
                        total_responses, packs_completed, computed_at)
                SELECT
                    $1::int, $2::varchar,
                    AVG(r.score) FILTER (WHERE r.axis = 'economy'     AND r.score <> 0)::numeric(4,2),
                    COUNT(*) FILTER  (WHERE r.axis = 'economy'     AND r.score <> 0)::int::smallint,
                    AVG(r.score) FILTER (WHERE r.axis = 'social'      AND r.score <> 0)::numeric(4,2),
                    COUNT(*) FILTER  (WHERE r.axis = 'social'      AND r.score <> 0)::int::smallint,
                    AVG(r.score) FILTER (WHERE r.axis = 'security'    AND r.score <> 0)::numeric(4,2),
                    COUNT(*) FILTER  (WHERE r.axis = 'security'    AND r.score <> 0)::int::smallint,
                    AVG(r.score) FILTER (WHERE r.axis = 'institution' AND r.score <> 0)::numeric(4,2),
                    COUNT(*) FILTER  (WHERE r.axis = 'institution' AND r.score <> 0)::int::smallint,
                    COUNT(*)::int::smallint,
                    -- packs_completed: 각 팩의 question_count 만큼 응답이 있으면 ID 누적
                    (SELECT string_agg(p.id, ',' ORDER BY p.id)
                       FROM balance_game_packs p
                      WHERE p.is_active = TRUE
                        AND p.question_count = (
                            SELECT COUNT(DISTINCT r.question_id)::int
                              FROM balance_game_responses r
                              JOIN balance_game_questions q ON q.id = r.question_id AND q.is_active = TRUE
                             WHERE r.user_id = $1::int
                               AND r.pack_id = p.id
                               AND r.mapping_version = $2::varchar
                        )),
                    NOW()
                -- 🔴 활성 문항의 응답만 (2026-08-16). 문항을 교체하면 옛 문항은 is_active=FALSE 로 남고 응답도 남는다 —
                --    조인 없이 전 응답을 평균하면 옛 문항이 좌표에 계속 섞이고, 완료 판정도 옛 응답으로 채워져 새 문항을 안 풀어도 '완료' 가 된다
                FROM balance_game_responses r
                JOIN balance_game_questions q ON q.id = r.question_id AND q.is_active = TRUE
                WHERE r.user_id = $1::int AND r.mapping_version = $2::varchar
                ON CONFLICT (user_id, mapping_version) DO UPDATE SET
                    economy           = EXCLUDED.economy,
                    economy_count     = EXCLUDED.economy_count,
                    social            = EXCLUDED.social,
                    social_count      = EXCLUDED.social_count,
                    security          = EXCLUDED.security,
                    security_count    = EXCLUDED.security_count,
                    institution       = EXCLUDED.institution,
                    institution_count = EXCLUDED.institution_count,
                    total_responses   = EXCLUDED.total_responses,
                    packs_completed   = EXCLUDED.packs_completed,
                    computed_at       = NOW()
            `, [userId, mappingVersion]);
        },

        /* 유저 좌표 조회 */
        getUserAxisScore: async (userId, mappingVersion = MAPPING_VERSION_DEFAULT) => {
            const { rows } = await db.query(
                `SELECT user_id, mapping_version,
                        economy, economy_count,
                        social, social_count,
                        security, security_count,
                        institution, institution_count,
                        total_responses, packs_completed, computed_at
                   FROM user_axis_score
                  WHERE user_id = $1 AND mapping_version = $2
                  LIMIT 1`,
                [userId, mappingVersion]
            );
            return rows[0] || null;
        },

        /* 마이페이지 — 한 유저의 게임팩별 풀이 이력 */
        listUserPackHistory: async (userId, mappingVersion = MAPPING_VERSION_DEFAULT) => {
            const { rows } = await db.query(`
                SELECT p.id, p.title, p.description, p.is_general, p.display_order,
                       p.question_count,
                       (SELECT COUNT(*)::int FROM balance_game_questions q
                          WHERE q.pack_id = p.id AND q.is_active = TRUE) AS active_question_count,
                       COALESCE(r.response_count, 0)::int AS response_count,
                       r.last_responded_at,
                       (COALESCE(r.distinct_question_count, 0) >= p.question_count) AS completed
                  FROM balance_game_packs p
                  LEFT JOIN (
                      -- ⚠️ 활성 문항의 응답만 (2026-08-16 문항 교체 — 옛 응답을 세면 16/20 인데 '완료' 로 보인다)
                      SELECT r.pack_id,
                             COUNT(DISTINCT r.question_id)::int AS response_count,
                             COUNT(DISTINCT r.question_id)::int AS distinct_question_count,
                             MAX(r.created_at) AS last_responded_at
                        FROM balance_game_responses r
                        JOIN balance_game_questions q ON q.id = r.question_id AND q.is_active = TRUE
                       WHERE r.user_id = $1 AND r.mapping_version = $2
                       GROUP BY r.pack_id
                  ) r ON r.pack_id = p.id
                 WHERE p.is_active = TRUE
                 ORDER BY p.is_general DESC, p.display_order ASC, p.created_at ASC
            `, [userId, mappingVersion]);
            return rows;
        },

        /* 그룹 평균 조회 — 단계 4 비교 */
        getGroupAxisAvg: async (groupKey, mappingVersion = MAPPING_VERSION_DEFAULT) => {
            const { rows } = await db.query(
                `SELECT group_key, economy_avg, social_avg, security_avg, institution_avg,
                        user_count, computed_at
                   FROM group_axis_avg
                  WHERE group_key = $1 AND mapping_version = $2
                  LIMIT 1`,
                [groupKey, mappingVersion]
            );
            return rows[0] || null;
        },

        /* 전체 평균 — group_axis_avg 의 'all' 키로 보관 */
        getOverallAxisAvg: async (mappingVersion = MAPPING_VERSION_DEFAULT) => {
            const { rows } = await db.query(
                `SELECT economy_avg, social_avg, security_avg, institution_avg, user_count
                   FROM group_axis_avg
                  WHERE group_key = 'all' AND mapping_version = $1
                  LIMIT 1`,
                [mappingVersion]
            );
            return rows[0] || null;
        }
    };
};
