// utils/xrayFormat.js — X레이 뷰 공용 포맷 헬퍼
//
// 원래 xray.ejs 상단에 인라인으로 있던 것들. 섹션을 partial 로 쪼개면서
// 페이지와 조각 렌더 양쪽에 같은 헬퍼를 넘겨야 해서 모듈로 뺐다.
// (조각은 layout 을 안 타므로 app.locals 만으로는 안 되고 render locals 로 명시 전달)

export const nf = (n) => Number(n || 0).toLocaleString('ko-KR');

export const pct = (num, den) => (den > 0 ? Math.round(num / den * 1000) / 10 : 0);

export const median = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export default { nf, pct, median };
