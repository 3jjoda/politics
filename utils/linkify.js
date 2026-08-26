// utils/linkify.js — 게시글 본문의 URL 을 링크로 (2026-08-19)
//
// 본문은 HTML 을 허용하지 않는다 (XSS). 대신 **먼저 이스케이프한 뒤** https?:// 주소만 <a> 로 감싼다.
// - 같은 호스트(BASE_URL) 또는 dangmalsa.kr 이면 내부 링크: 같은 탭, 표시 텍스트는 **`바로가기`**
//   🔴 경로(`/balance-game`)를 그대로 보여주지 않는다 (2026-08-27). 주소는 읽는 사람에게 정보가 아니고,
//      문장 사이에 영문 경로가 끼면 리듬이 끊긴다. 어디로 가는지는 **앞 문장이 이미 말한다** —
//      실제 공지: `· 매일 아침 국회 브리핑 <바로가기>`
//   ⚠️ **페이지 이름(브리핑·성향 진단…)을 라벨로 쓰지 말 것.** 작성자가 앞에서 이미 부르므로
//      `매일 아침 국회 브리핑 → 브리핑` 처럼 같은 말이 두 번 나온다 (실제 본문으로 대입해 확인)
//   ⚠️ 어디로 가는지는 `title` 에 경로로 남긴다 — 문맥 없이 링크만 있는 글에서 유일한 단서다
// - 외부면 target=_blank rel=noopener nofollow, 표시 텍스트는 주소 그대로 (길면 60자로 접음)
// - 끝에 붙은 문장부호(.,)!?」』)』…)는 링크에서 뺀다 — "…/guide." 처럼 마침표가 URL 에 붙는 경우
// ⚠️ 서버 렌더 전용 (detail.ejs). 댓글 위젯(JS)은 별개 — 필요하면 같은 규칙을 interactions.js 에

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/* 이스케이프된 문자열 위에서 돈다 — &lt; &gt; &quot; &#39; 를 만나면 URL 을 끊는다 (원문의 < > " ' 자리) */
const URL_RE = /https?:\/\/(?:(?!&lt;|&gt;|&quot;|&#39;)[^\s<>"'）)\]])+/g;
const TRAIL_RE = /[.,!?;:」』』〉》)\]]+$/;

const internalHosts = () => {
    const hs = new Set(['dangmalsa.kr', 'www.dangmalsa.kr']);
    try { const u = new URL(process.env.BASE_URL || ''); if (u.host) hs.add(u.host); } catch { /* BASE_URL 없음 */ }
    return hs;
};

export const linkify = (text) => {
    const hosts = internalHosts();
    const escaped = escapeHtml(text);
    return escaped.replace(URL_RE, (m) => {
        // 이스케이프된 문자열이라 &amp; 가 들어올 수 있다 → 원래 URL 로 되돌려 파싱
        let raw = m.replace(/&amp;/g, '&');
        const trail = (raw.match(TRAIL_RE) || [''])[0];
        raw = raw.slice(0, raw.length - trail.length);
        let u;
        try { u = new URL(raw); } catch { return m; }
        const shown = escapeHtml(raw);
        const isInternal = hosts.has(u.host);
        if (isInternal) {
            const path = escapeHtml(u.pathname + u.search + u.hash || '/');
            /* 화살표는 CSS(::after)가 붙인다 — 텍스트에 넣으면 복사·스크린리더에 섞인다 */
            return `<a class="pb-inlink" href="${path}" title="${path}">바로가기</a>${escapeHtml(trail)}`;
        }
        const label = raw.length > 60 ? escapeHtml(raw.slice(0, 57)) + '…' : shown;
        return `<a href="${shown}" target="_blank" rel="noopener nofollow">${label}</a>${escapeHtml(trail)}`;
    });
};
