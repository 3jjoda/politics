// middlewares/balanceGame.js
//
// 모든 요청에 세 값 주입:
//   res.locals.balanceGameCompleted   : boolean — 미완료 유저는 회색 "📊 진단 후 표시" 배지
//   res.locals.userAxis               : {economy, social, security, institution} | null
//   res.locals.userDistanceQuartiles  : {q1, q2, q3} | null — 의원 295명 거리 분포의 25/50/75 분위수
//
// userAxis 가 있고 politician.axis 가 있으면 의원 카드/상세에 거리 배지 (🎯 결 비슷 (0.85) · 📊 v1) 노출.
// quartiles 로 tier 분류 (Q1=결 비슷 / Q2=비슷 / Q3=다소 다름 / Q4=다름) — 시각 강도 차등용.
//
// 정의 (balanceGameCompleted):
//   - 비로그인: 항상 false
//   - 로그인 + user_axis_score.packs_completed 에 'general' 포함 → true
//   - 그 외: false (응답 1~19개 부분 풀이 포함 — D 레이어 의미 미달)

export const injectBalanceGameStatus = (db) => async (req, res, next) => {
    res.locals.balanceGameCompleted = false;
    res.locals.userAxis = null;
    res.locals.userDistanceQuartiles = null;
    try {
        const userId = req.session?.userId;
        if (!userId) return next();
        const { rows } = await db.query(
            `SELECT economy, social, security, institution, packs_completed
               FROM user_axis_score
              WHERE user_id = $1 AND mapping_version = 'v1'
              LIMIT 1`,
            [userId]
        );
        const r = rows[0];
        const completed = (r?.packs_completed || '').split(',').filter(Boolean);
        res.locals.balanceGameCompleted = completed.includes('general');
        if (res.locals.balanceGameCompleted) {
            const ua = {
                economy:     parseFloat(r.economy),
                social:      parseFloat(r.social),
                security:    parseFloat(r.security),
                institution: parseFloat(r.institution),
            };
            res.locals.userAxis = ua;

            // 의원 295명 거리 분포의 분위수 — 단일 PERCENTILE_CONT 쿼리 (~수ms)
            const qRes = await db.query(
                `WITH dists AS (
                    SELECT SQRT(
                        ($1::float8 - economy)::float8 ^ 2 +
                        ($2::float8 - social)::float8 ^ 2 +
                        ($3::float8 - security)::float8 ^ 2 +
                        ($4::float8 - institution)::float8 ^ 2
                    ) / 2 AS d
                      FROM politician_axis_score
                     WHERE mapping_version = 'v1'
                 )
                 SELECT PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY d)::float8 AS q1,
                        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY d)::float8 AS q2,
                        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY d)::float8 AS q3
                   FROM dists`,
                [ua.economy, ua.social, ua.security, ua.institution]
            );
            const q = qRes.rows[0];
            if (q && q.q1 !== null) {
                res.locals.userDistanceQuartiles = {
                    q1: parseFloat(q.q1),
                    q2: parseFloat(q.q2),
                    q3: parseFloat(q.q3),
                };
            }
        }
    } catch (err) {
        // 테이블 없거나 일시 장애 — 기본 false 유지 (회색 배지 노출이 안전)
    }
    next();
};
