import logger from '../utils/logger.js';

/**
 * 대표 도메인(canonical host) 강제 리다이렉트.
 *
 * 커스텀 도메인을 붙이면 같은 사이트가 여러 주소로 뜬다:
 *   dangmalsa.kr / www.dangmalsa.kr / politics-production.up.railway.app
 * 검색엔진엔 중복 콘텐츠고, 세션 쿠키는 host-only 라 주소마다 로그인이 따로 논다.
 * 그래서 BASE_URL 에 적힌 호스트 하나로 전부 몰아준다.
 *
 * 설계 의도
 *  - 대표 호스트를 하드코딩하지 않고 BASE_URL 에서 읽는다 → 도메인이 또 바뀌어도 코드는 그대로
 *  - BASE_URL 이 없거나 로컬(localhost/127.0.0.1/0.0.0.0)이면 **완전히 비활성**.
 *    개발 중에 엉뚱한 리다이렉트가 걸리지 않게 하기 위함
 *  - GET/HEAD 는 301, 그 외는 308.
 *    301 은 클라이언트가 POST 를 GET 으로 바꿔버려도 되는 코드라 본문이 유실된다.
 *    308 은 메서드·본문을 보존한다.
 *
 * 등록 위치: 라우트보다 앞. static 보다도 앞이면 정적 파일 요청까지 대표 호스트로 몰 수 있다.
 * 전제: app.set('trust proxy', 1) — Railway 프록시 뒤라 req.hostname/protocol 이 X-Forwarded-* 를 따르게 해야 한다.
 */
export function canonicalHost() {
    const raw = process.env.BASE_URL;

    if (!raw) {
        logger.info('canonicalHost 비활성 — BASE_URL 없음');
        return (req, res, next) => next();
    }

    let url;
    try {
        url = new URL(raw);
    } catch {
        logger.warn(`canonicalHost 비활성 — BASE_URL 파싱 실패: ${raw}`);
        return (req, res, next) => next();
    }

    const canonical = url.hostname.toLowerCase();
    const LOCAL = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
    if (LOCAL.has(canonical)) {
        logger.info(`canonicalHost 비활성 — 로컬 BASE_URL (${canonical})`);
        return (req, res, next) => next();
    }

    // 끝의 '/' 는 떼둔다. req.originalUrl 이 항상 '/' 로 시작하므로 붙이면 '//' 가 된다.
    const origin = `${url.protocol}//${url.host}`.replace(/\/+$/, '');
    logger.info(`canonicalHost 활성 — 대표 주소 ${origin}`);

    return (req, res, next) => {
        const host = (req.hostname || '').toLowerCase();
        if (!host || host === canonical) return next();

        const code = (req.method === 'GET' || req.method === 'HEAD') ? 301 : 308;
        return res.redirect(code, origin + req.originalUrl);
    };
}

export default canonicalHost;
