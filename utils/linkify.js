// utils/linkify.js — 게시글 본문의 URL 을 링크로 (2026-08-19)
//
// 본문은 HTML 을 허용하지 않는다 (XSS). 대신 **먼저 이스케이프한 뒤** https?:// 주소만 <a> 로 감싼다.
// - 같은 호스트(BASE_URL) 또는 dangmalsa.kr 이면 내부 링크: 같은 탭, 표시 텍스트는 경로만 (`/balance-game`)
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
            const path = u.pathname + u.search + u.hash;
            return `<a href="${escapeHtml(path || '/')}">${escapeHtml(path || '/')}</a>${escapeHtml(trail)}`;
        }
        const label = raw.length > 60 ? escapeHtml(raw.slice(0, 57)) + '…' : shown;
        return `<a href="${shown}" target="_blank" rel="noopener nofollow">${label}</a>${escapeHtml(trail)}`;
    });
};
