/**
 * 이름 기반 SVG 이니셜 아바타 생성 유틸
 * EJS에서 <%- avatarSvg(name, url, size) %> 로 사용
 */

// 같은 이름은 항상 같은 색이 나오도록 이름 해시 → 색상 인덱스 (라이트 테마: 파스텔 bg + 진한 fg)
const PALETTE = [
    { bg: '#DBE3F0', fg: '#1E3A5F' }, // pastel blue
    { bg: '#E5DBF0', fg: '#4A2A6B' }, // pastel purple
    { bg: '#D8EBE0', fg: '#2A5F42' }, // pastel green
    { bg: '#F0E3D0', fg: '#6B4A1F' }, // pastel brown
    { bg: '#F0D8DF', fg: '#6B2A40' }, // pastel rose
    { bg: '#E6F0D4', fg: '#4F6B22' }, // pastel olive
    { bg: '#D4EBEF', fg: '#1F5962' }, // pastel teal
    { bg: '#E8DEF0', fg: '#5A2F6B' }  // pastel mauve
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
