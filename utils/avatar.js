/**
 * 이름 기반 SVG 이니셜 아바타 생성 유틸
 * EJS에서 <%- avatarSvg(name, url, size) %> 로 사용
 */

// 같은 이름은 항상 같은 색이 나오도록 이름 해시 → 색상 인덱스
const PALETTE = [
    { bg: '#2D3B52', fg: '#B4C7E7' }, // slate-blue
    { bg: '#3B2D52', fg: '#C7B4E7' }, // slate-purple
    { bg: '#2D523E', fg: '#B4E7CC' }, // slate-green
    { bg: '#523B2D', fg: '#E7CCB4' }, // slate-brown
    { bg: '#522D3B', fg: '#E7B4C7' }, // slate-rose
    { bg: '#3B522D', fg: '#CCE7B4' }, // slate-olive
    { bg: '#2D4C52', fg: '#B4D9E7' }, // slate-teal
    { bg: '#4C3B52', fg: '#D9B4E7' }  // slate-mauve
];

function hashCode(str) {
    let h = 0;
    if (!str) return 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function initialsOf(name) {
    if (!name) return '?';
    // 한글 이름: 첫 글자 하나 (예: 김석기 → 김)
    // 영문: 이니셜 2글자 (예: John Doe → JD)
    const hasKorean = /[가-힣]/.test(name);
    if (hasKorean) return name.trim().charAt(0);
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function colorOf(name) {
    return PALETTE[hashCode(name) % PALETTE.length];
}

/**
 * 이니셜 SVG 아바타를 반환한다.
 * @param {string} name 이름 (한글/영문)
 * @param {string|null} url 사진 URL (있으면 <img> 우선)
 * @param {number} size 픽셀 크기 (기본 40)
 * @returns {string} HTML 문자열
 */
export function avatarHtml(name, url, size = 40) {
    const s = Number(size) || 40;
    if (url) {
        return `<img src="${url}" alt="${escapeHtml(name || '')}" width="${s}" height="${s}" class="pb-avatar-img" style="width:100%;height:100%;object-fit:cover">`;
    }
    const initials = initialsOf(name);
    const { bg, fg } = colorOf(name || '');
    const fontSize = Math.floor(s * 0.42);
    return `<svg width="100%" height="100%" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg" style="display:block">
  <circle cx="${s/2}" cy="${s/2}" r="${s/2}" fill="${bg}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="Noto Sans KR, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}">${escapeHtml(initials)}</text>
</svg>`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export default { avatarHtml };
