// utils/externalUrl.js — DB 에서 온 외부 링크를 <a href> 에 쓸 수 있는 형태로 정규화한다.
//
// 🔴 왜 필요한가 (2026-08-21 실제 사고)
//   열린국회 API 의 `homepage` 값 일부가 **스킴이 없다** (실측 231건 중 7건: `blog.naver.com/jjwc306`,
//   `facebook.com/61557198895863` …). 그대로 href 에 넣으면 브라우저·크롤러가 **현재 경로 기준 상대 주소**로
//   해석해서 `https://dangmalsa.kr/politician/blog.naver.com/jjwc306` 로 간다.
//     · 사용자: 「바로가기 →」 를 눌러도 의원 블로그가 아니라 우리 사이트 404 로 떨어진다
//     · 구글: 그 주소를 색인하려다 실패한다 (Search Console 「실패함」 에서 발견됐다)
//   ⚠️ 앞뒤 공백이 붙은 값도 있다 (` http://blog.naver.com/dulipapa`).
//
// 반환: 쓸 수 있는 절대 URL 문자열, 아니면 null (호출부는 null 이면 링크를 아예 안 그린다).
const SAFE_SCHEME = /^https?:\/\//i;

export function externalUrl(raw) {
    const v = String(raw || '').trim();
    if (!v) return null;

    // 🔴 javascript: · data: 같은 스킴을 절대 통과시키지 말 것 (DB 값이라도 신뢰하지 않는다)
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !SAFE_SCHEME.test(v)) return null;

    const withScheme = SAFE_SCHEME.test(v) ? v : `https://${v}`;
    try {
        const u = new URL(withScheme);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        if (!u.hostname.includes('.')) return null;   // 'abc' 같은 값이 https://abc 로 둔갑하는 것 방지
        return u.href;
    } catch {
        return null;   // 파싱이 안 되면 링크를 안 그린다 — 깨진 링크보다 없는 게 낫다
    }
}
