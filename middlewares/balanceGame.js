// middlewares/balanceGame.js
import { POL_MAPPING_VERSION } from '../utils/axisConfig.js';
import { readAnonAxis } from '../utils/anonAxis.js';
//
// 모든 요청에 네 값 주입:
//   res.locals.balanceGameCompleted   : boolean — 미완료면 회색 "📊 진단 후 표시" 배지
//   res.locals.userAxis               : {economy, social, security, institution} | null
//   res.locals.userDistanceQuartiles  : {q1, q2, q3} | null — 의원 거리(3축) 분포의 25/50/75 분위수
//   res.locals.isAnonAxis             : boolean — 좌표가 쿠키(비로그인)에서 왔다. 화면이 "저장하려면 로그인" 을 붙인다
//   ⚠️ user_axis_score 의 mapping_version 은 'v1'(문항 버전) 그대로다. 의원 좌표만 v2 — utils/axisConfig.js 참조
//
// userAxis 가 있고 politician.axis 가 있으면 의원 카드/상세에 일치도 노출.
// quartiles 로 tier 분류 (Q1=결 비슷 / Q2=비슷 / Q3=다소 다름 / Q4=다름) — 시각 강도 차등용.
//
// 정의 (balanceGameCompleted):
//   - 로그인  + user_axis_score.packs_completed 에 'general' 포함 → true
//   - 비로그인 + pb.bg 쿠키가 완료 상태 → true   (2026-08-24 익명 진단)
//   - 그 외: false (응답 1~19개 부분 풀이 포함 — D 레이어 의미 미달)
//
// 🔴 비로그인 분기를 지우지 말 것 — 이게 없으면 익명 진단을 끝낸 사람에게 의원 목록 309장이
//    통째로 "진단 후 표시" 로 잠긴다. 진단을 익명으로 연 이유의 절반이 여기다 (utils/anonAxis.js 주석 참조).

export const injectBalanceGameStatus = (db) => async (req, res, next) => {
    res.locals.balanceGameCompleted = false;
    res.locals.userAxis = null;
    res.locals.userDistanceQuartiles = null;
    res.locals.isAnonAxis = false;
    try {
        const userId = req.session?.userId;
        let row = null;

        if (userId) {
            const { rows } = await db.query(
                `SELECT economy, social, security, institution, packs_completed
                   FROM user_axis_score
                  WHERE user_id = $1 AND mapping_version = 'v1'
                  LIMIT 1`,
                [userId]
            );
            row = rows[0] || null;
        } else {
            // 비로그인 — 쿠키에서 복원 (서버에 저장된 것이 아니라 브라우저가 들고 온 값이다)
            row = readAnonAxis(req);
            if (row) res.locals.isAnonAxis = true;
        }
        if (!row) return next();

        const completed = (row.packs_completed || '').split(',').filter(Boolean);
        res.locals.balanceGameCompleted = completed.includes('general');
        if (!res.locals.balanceGameCompleted) return next();

        const ua = {
            economy:     parseFloat(row.economy),
            social:      parseFloat(row.social),
            security:    parseFloat(row.security),
            institution: parseFloat(row.institution),
        };
        res.locals.userAxis = ua;

        // ⚠️ 3축 중 하나라도 없으면 거리를 못 재므로 분위수를 건너뛴다 (Number(null)=0 함정 회피)
        if (![ua.economy, ua.social, ua.institution].every(Number.isFinite)) return next();

        // 의원 292명 거리 분포의 분위수 — 단일 PERCENTILE_CONT 쿼리 (~수ms)
        const qRes = await db.query(
            `WITH dists AS (
                /* 🔴 3축 · v2 — utils/axisConfig.js MATCH_AXES / POL_MAPPING_VERSION 과 같아야 한다 (안보 제외) */
                SELECT SQRT(
                    ($1::float8 - economy)::float8 ^ 2 +
                    ($2::float8 - social)::float8 ^ 2 +
                    ($3::float8 - institution)::float8 ^ 2
                ) / 2 AS d
                  FROM politician_axis_score
                 WHERE mapping_version = $4
                   AND economy IS NOT NULL AND social IS NOT NULL AND institution IS NOT NULL
             )
             SELECT PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY d)::float8 AS q1,
                    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY d)::float8 AS q2,
                    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY d)::float8 AS q3
               FROM dists`,
            [ua.economy, ua.social, ua.institution, POL_MAPPING_VERSION]
        );
        const q = qRes.rows[0];
        if (q && q.q1 !== null) {
            res.locals.userDistanceQuartiles = {
                q1: parseFloat(q.q1),
                q2: parseFloat(q.q2),
                q3: parseFloat(q.q3),
            };
        }
    } catch (err) {
        // 테이블 없거나 일시 장애 — 기본 false 유지 (회색 배지 노출이 안전)
    }
    next();
};
