// middlewares/balanceGame.js
// 모든 요청에 res.locals.balanceGameCompleted 주입.
// 미완료 유저(비로그인 포함)에게 의원 카드·홈 탭 등 D 레이어 자리에
// "📊 진단 후 표시" 회색 배지를 노출하기 위한 단순 boolean.
//
// 단계 1·2 만 구현된 현 시점에선 응답 row 가 한 건도 없을 가능성이 높으나
// 향후 완료 유저가 생기면 자동으로 false → true 전환됨.
//
// 단순화 가정:
//   - 비로그인: 항상 false
//   - 로그인 + 응답 0건: false
//   - 로그인 + 응답 1건+: true (mapping_version 일치 여부는 D 레이어 활성 단계에서 정교화)

export const injectBalanceGameStatus = (db) => async (req, res, next) => {
    res.locals.balanceGameCompleted = false;
    try {
        const userId = req.session?.userId;
        if (!userId) return next();
        const { rows } = await db.query(
            `SELECT 1 FROM balance_game_responses
              WHERE user_id = $1 AND is_archived = FALSE
              LIMIT 1`,
            [userId]
        );
        res.locals.balanceGameCompleted = rows.length > 0;
    } catch (err) {
        // 테이블 없거나 DB 일시 장애 — 회색 배지 노출이 기본이라 false 유지
    }
    next();
};
