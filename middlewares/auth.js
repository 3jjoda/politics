/**
 * 로그인이 반드시 필요한 라우트용 미들웨어.
 * - API 요청이면 401 JSON
 * - 페이지 요청이면 /auth/login?next=<원래 URL> 로 리다이렉트
 */
export const requireLogin = (req, res, next) => {
    if (!req.session?.userId) {
        const isApi = req.xhr
            || (req.headers.accept || '').includes('application/json')
            || req.originalUrl.startsWith('/api/');
        if (isApi) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }
        const next_ = encodeURIComponent(req.originalUrl || '/');
        return res.redirect(`/auth/login?next=${next_}`);
    }
    next();
};

/**
 * 관리자 전용 라우트용 미들웨어.
 *
 * 식별 방식: 환경변수 `ADMIN_EMAILS` 의 이메일 허용목록 (쉼표 구분).
 *   DB 에 권한을 안 박는 쪽을 골랐다 — 관리자가 1명이고, 컬럼을 두면 "첫 관리자는 누가 주나"
 *   문제로 어차피 SQL 을 써야 하며 권한 관리 UI 가 또 필요해진다. 늘어나면 users.role 로 옮긴다.
 *
 * ⚠️ **카카오 로그인 계정은 이메일이 NULL 이라 통과하지 못한다** (실측: 카카오 비즈 미승인).
 *    관리자는 반드시 구글로 로그인해야 한다.
 * ⚠️ `ADMIN_EMAILS` 가 비어 있으면 **아무도 통과하지 못한다** (전원 차단이 기본값).
 *    설정 누락 시 열리는 것보다 닫히는 게 안전하다.
 */
const adminEmails = () => (process.env.ADMIN_EMAILS || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

/** 관리자 여부. 라우트 보호와 메뉴 노출이 **같은 판정**을 쓰도록 한 곳에 둔다
 *  (따로 두면 메뉴는 보이는데 눌러도 404 나는 상태가 생긴다). */
export const isAdminUser = (user) => {
    const allow = adminEmails();
    const email = (user?.email || '').toLowerCase();
    return !!(allow.length && email && allow.includes(email));
};

export const requireAdmin = (req, res, next) => {
    if (!isAdminUser(req.user)) {
        // 존재 자체를 숨긴다 — 403 은 "여기 관리자 페이지가 있다" 를 알려준다
        return res.status(404).render('error_pages/404', {
            pageTitle: '찾을 수 없음', pageStyles: 'error', currentUrl: req.originalUrl,
            message: '페이지를 찾을 수 없습니다.'
        });
    }
    next();
};

/**
 * 상태를 바꾸는 요청의 Origin 검사.
 * 세션 쿠키가 sameSite:'lax' 라 교차 사이트 POST 는 이미 대부분 막히지만,
 * 관리자 쓰기는 피해가 크므로 한 겹 더 둔다. (프로젝트에 CSRF 토큰 인프라가 없어 Origin 으로 대신)
 */
export const sameOrigin = (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.get('origin') || req.get('referer') || '';
    if (origin) {
        try {
            if (new URL(origin).host !== req.get('host')) {
                return res.status(403).send('교차 출처 요청이 차단되었습니다.');
            }
        } catch { return res.status(403).send('요청 출처를 확인할 수 없습니다.'); }
    }
    next();
};

/**
 * 모든 EJS 템플릿에서 currentUser 를 사용할 수 있도록 주입.
 * passport.deserializeUser 가 req.user 에 채워준 사용자 row 를 그대로 전달.
 */
export const injectUser = (req, res, next) => {
    res.locals.currentUser = req.user || null;
    // 관리자 메뉴 노출용. requireAdmin 과 같은 판정 함수를 쓴다
    res.locals.isAdmin = isAdminUser(req.user);
    // req.session.userId 별도 보관 — passport 미사용 경로(API 토큰 등) 대비
    if (req.user && req.user.user_id) {
        req.session.userId = req.user.user_id;
    }
    next();
};
