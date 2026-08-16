/* shareCard.js — 성향 진단 결과 공유 이미지 (2026-08-16)
 *
 * 카드를 **canvas 로 직접 그린다** (의존성 0). 왜 HTML→이미지 라이브러리가 아니라 canvas 인가:
 *   · html2canvas 류는 웹폰트·`word-break` 재현이 불완전하고 번들이 크다
 *   · SVG → canvas 는 SVG 안에서 문서의 웹폰트를 못 써 폴백 폰트로 찍힌다 (폰트를 data URI 로 박아야 하는데 Noto Serif KR 은 MB 단위)
 *   · canvas fillText 는 문서가 이미 받은 웹폰트를 그대로 쓴다 (`document.fonts.load` 로 서브셋을 미리 당긴다)
 * 미리보기와 산출물이 **같은 canvas** 라 "미리보기는 멀쩡한데 저장한 게 깨지는" 일이 없다.
 *
 * ⚠️ 외부 이미지(의원 사진 등)를 그리지 말 것 — 다른 origin 이미지를 그리는 순간 canvas 가 taint 돼 toBlob 이 막힌다.
 *    브랜드 마크도 SVG 파일 대신 path 로 그린다 (mark-only.svg 의 좌표 그대로).
 * ⚠️ 정당명·정당색을 넣지 말 것 — 인스타 카드와 같은 규칙. 강조는 골드 하나.
 * ⚠️ % 일치도를 넣지 말 것 — 홈·상세와 같은 판단 (분모 1.5 는 임의 보정값). 순위(1·2·3)까지만.
 *
 * 크기: story 1080×1920 (위 250 / 아래 240 은 인스타 UI 가 덮으므로 비운다) · feed 1080×1350 (4:5)
 */
(() => {
  const D = window.__SHARE__;
  if (!D) return;

  const C = {
    bg: '#F7F6F1', bg2: '#FFFFFF', tint: '#FBF5EA', ink: '#1A1D24', sub: '#4B5362', sub2: '#5F6674',
    gold: '#B8740C', goldD: '#8F5800', line: '#E2DFD4', line2: '#C9C5B6', dim: '#A8A095', mid: '#6B7280'
  };
  const SERIF = '"Noto Serif KR", "Nanum Myeongjo", serif';
  const SANS  = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const MONO  = '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace';

  const W = 1080;
  const MODES = {
    story: { h: 1920, top: 250, bottom: 240, pad: 76 },
    feed:  { h: 1350, top: 64,  bottom: 56,  pad: 76 }
  };

  /* ---------- 문구 ---------- */
  // 헤드라인 — |값| ≥ 0.25 인 축을 세기 순으로 최대 2개. 전부 중도면 그렇게 말한다
  function headline() {
    const rows = D.axes
      .map(a => ({ a, v: Number(D.axis[a.key]) }))
      .filter(r => Number.isFinite(r.v) && Math.abs(r.v) >= 0.25)
      .sort((x, y) => Math.abs(y.v) - Math.abs(x.v))
      .slice(0, 2);
    if (!rows.length) return '네 축 모두 중도에 가깝습니다';
    // 헤드라인은 짧은 극 라벨(L/R) — 긴 형은 바로 아래 축 줄에 다 나온다. `정치제도는 제도 개혁` 보다 `정치제도는 개혁` 이 읽힌다
    const parts = rows.map(r => `${r.a.name}는 ${r.v > 0 ? r.a.R : r.a.L}`);
    return parts.join(', ') + ' 쪽';
  }
  // 축 한 줄 해석 — compare.ejs axisLine 과 같은 4단계 (중도 / 미세하게 / 약간 뚜렷하게 / 뚜렷하게)
  function intensity(v) {
    const a = Math.abs(v);
    if (a < 0.25) return '중도';
    if (a < 0.5)  return '미세하게';
    if (a < 0.75) return '약간 뚜렷하게';
    return '뚜렷하게';
  }
  function axisPhrase(a, v) {
    if (!Number.isFinite(v)) return '';
    const it = intensity(v);
    if (it === '중도') return '중도';
    return `${it} ${v > 0 ? a.Rx : a.Lx} 쪽`;
  }

  /* ---------- 캔버스 헬퍼 ---------- */
  function font(weight, size, family) { return `${weight} ${size}px ${family}`; }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // 공백 단위로 접고(keep-all), 한 덩어리가 폭을 넘으면 글자 단위로 쪼갠다
  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    const push = () => { if (cur) lines.push(cur); cur = ''; };
    for (const w of words) {
      const cand = cur ? cur + ' ' + w : w;
      if (ctx.measureText(cand).width <= maxW) { cur = cand; continue; }
      push();
      if (ctx.measureText(w).width <= maxW) { cur = w; continue; }
      let piece = '';
      for (const ch of w) {
        if (ctx.measureText(piece + ch).width > maxW && piece) { lines.push(piece); piece = ''; }
        piece += ch;
      }
      cur = piece;
    }
    push();
    return lines;
  }
  function ellipsize(ctx, text, maxW) {
    let t = String(text);
    if (ctx.measureText(t).width <= maxW) return t;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  // 브랜드 마크 — mark-only.svg (viewBox 64) 를 size 로 스케일해 path 로 그린다
  function drawMark(ctx, x, y, size) {
    const s = size / 64;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = C.gold;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6.5;
    ctx.beginPath(); ctx.arc(32, 32, 25, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(30, 16); ctx.quadraticCurveTo(29, 32, 30, 48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(31, 30); ctx.quadraticCurveTo(37, 34, 42, 38); ctx.stroke();
    ctx.restore();
  }
  // 태그라인 "당 말고 사람" — tagline.svg 의 3단 대비 (당 흐림 / 말고 회색 / 사람 골드 800)
  function drawTagline(ctx, x, y, size) {
    ctx.textBaseline = 'alphabetic';
    let cx = x;
    const parts = [
      ['당', C.dim, 500], [' 말고 ', C.mid, 500], ['사람', C.goldD, 800]
    ];
    for (const [t, col, w] of parts) {
      ctx.font = font(w, size, SANS);
      ctx.fillStyle = col;
      ctx.fillText(t, cx, y);
      cx += ctx.measureText(t).width;
    }
    return cx - x;
  }
  // 브랜드 락업 한 줄 — [마크 · 당말사] │ 당 말고 사람 … url  (인스타 카드 .sl-foot 와 같은 조립)
  function drawBrandRow(ctx, x, y, w, opt) {
    const mark = opt.mark, wm = opt.wm, tag = opt.tag;
    const cy = y + mark / 2;
    drawMark(ctx, x, y, mark);
    let cx = x + mark + 12;
    ctx.font = font(900, wm, SERIF);
    ctx.fillStyle = C.ink;
    ctx.textBaseline = 'middle';
    ctx.fillText('당말사', cx, cy + wm * 0.04);
    cx += ctx.measureText('당말사').width + 16;
    ctx.fillStyle = C.line2;
    ctx.fillRect(cx, cy - tag * 0.7, 2, tag * 1.4);
    cx += 2 + 16;
    ctx.textBaseline = 'alphabetic';
    drawTagline(ctx, cx, cy + tag * 0.36, tag);
    if (opt.url) {
      ctx.font = font(500, opt.urlSize || tag, MONO);
      ctx.fillStyle = C.goldD;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(opt.url, x + w, cy);
      ctx.textAlign = 'left';
    }
  }

  /* ---------- 본체 ---------- */
  function draw(canvas, mode, level) {
    const M = MODES[mode] || MODES.feed;
    const H = M.h;
    // level 0 → 기본. 넘치면 render() 가 1, 2 로 다시 부른다 — 간격·크기를 한 단계씩 조인다
    const L = level || 0;
    const g = (v) => Math.round(v * (1 - 0.28 * L));   // 세로 간격
    const f = (v) => v - 3 * L;                          // 글자 크기 (px)
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const pad = M.pad, cw = W - pad * 2;
    const story = mode === 'story';

    // 배경 + 상단 골드 룰
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.gold; ctx.fillRect(0, 0, W, 14);

    let y = M.top;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    // 킥커
    ctx.font = font(500, 24, MONO); ctx.fillStyle = C.sub2;
    ctx.fillText(D.date, pad, y + 24);
    const dateW = ctx.measureText(D.date).width;
    ctx.font = font(500, 24, SANS);
    ctx.fillText('나의 정치 성향 · 당말사 진단', pad + dateW + 22, y + 24);
    y += 24 + g(story ? 34 : 26);

    // 헤드라인 (세리프 900, 길이에 따라 크기)
    const hl = headline();
    let hs = hl.length <= 14 ? 76 : hl.length <= 22 ? 66 : 56;
    if (!story) hs -= 6;
    hs -= 6 * L;
    ctx.font = font(900, hs, SERIF); ctx.fillStyle = C.ink;
    let lines = wrap(ctx, hl, cw);
    if (lines.length > 2) { hs -= 10; ctx.font = font(900, hs, SERIF); lines = wrap(ctx, hl, cw); }
    // 좌측 골드 바 (법안 분석 Zone 1 과 같은 문법)
    const lh = hs * 1.22;
    ctx.fillStyle = C.gold; ctx.fillRect(pad, y + hs * 0.1, 6, lines.length * lh - hs * 0.2);
    ctx.fillStyle = C.ink;
    lines.forEach((l, i) => ctx.fillText(l, pad + 26, y + hs + i * lh));
    y += lines.length * lh + g(story ? 12 : 6);
    ctx.font = font(400, 24, SANS); ctx.fillStyle = C.sub;
    ctx.fillText(`${D.total}개 문항에 답한 결과 · 네 축의 위치`, pad + 26, y + 24);
    y += 24 + g(story ? 44 : 34);

    // 축 4줄
    const rowGap = g(story ? 30 : 22);
    for (const a of D.axes) {
      const v = Number(D.axis[a.key]);
      const has = Number.isFinite(v);
      // 이름 + 무엇을 다루는 축인지
      ctx.font = font(700, f(32), SERIF); ctx.fillStyle = C.ink;
      ctx.fillText(a.name, pad, y + 32);
      let nx = pad + ctx.measureText(a.name).width + 14;
      ctx.font = font(400, 22, SANS); ctx.fillStyle = C.sub2;
      ctx.fillText(a.short, nx, y + 31);
      // 우측: 해석 (골드) — 중도는 회색
      const ph = axisPhrase(a, v);
      ctx.font = font(700, 24, SANS);
      ctx.fillStyle = ph === '중도' || !has ? C.sub : C.goldD;
      ctx.textAlign = 'right';
      ctx.fillText(has ? ph : '응답 없음', pad + cw, y + 31);
      ctx.textAlign = 'left';
      y += 32 + g(22);
      // 트랙 — 점 반지름(19)만큼 안쪽으로. ±1.0 이면 점이 여백 밖으로 튀어나간다 (실측 −1.0 유저)
      const th = 12, tx = pad + 20, tw = cw - 40;
      ctx.fillStyle = C.line; rr(ctx, tx, y, tw, th, th / 2); ctx.fill();
      // 중앙 눈금
      ctx.fillStyle = C.line2; ctx.fillRect(tx + tw / 2 - 1, y - 8, 2, th + 16);
      if (has) {
        const px = tx + tw / 2 + (Math.max(-1, Math.min(1, v)) * tw / 2);
        // 중앙 ↔ 점 사이 띠
        ctx.fillStyle = 'rgba(184,116,12,0.28)';
        const bx = Math.min(px, tx + tw / 2), bw = Math.abs(px - tx - tw / 2);
        rr(ctx, bx, y, bw || 1, th, th / 2); ctx.fill();
        // 점 (흰 halo + 골드)
        ctx.beginPath(); ctx.arc(px, y + th / 2, 19, 0, Math.PI * 2); ctx.fillStyle = C.bg2; ctx.fill();
        ctx.beginPath(); ctx.arc(px, y + th / 2, 14, 0, Math.PI * 2); ctx.fillStyle = C.gold; ctx.fill();
      }
      y += th + g(16);
      // 양끝 라벨 (긴 형)
      ctx.font = font(500, 22, SANS); ctx.fillStyle = C.sub;
      ctx.fillText(a.Lx, pad, y + 22);
      ctx.textAlign = 'right'; ctx.fillText(a.Rx, pad + cw, y + 22); ctx.textAlign = 'left';
      y += 22 + rowGap;
    }
    y += g(story ? 14 : 6);

    // 가장 가까운 의원 3명 (있을 때만)
    const ms = Array.isArray(D.matches) ? D.matches.slice(0, 3) : [];
    if (ms.length) {
      // 구분선
      ctx.fillStyle = C.line; ctx.fillRect(pad, y, cw, 2); y += g(story ? 34 : 26);
      ctx.font = font(700, 30, SERIF); ctx.fillStyle = C.ink;
      ctx.fillText('좌표가 가장 가까운 의원', pad, y + 30);
      const measured = D.axes.filter(a => a.measured).map(a => a.name).join('·');
      ctx.font = font(400, 21, SANS); ctx.fillStyle = C.sub2;
      ctx.textAlign = 'right';
      ctx.fillText(`${measured} 3축 거리 · 가까운 순`, pad + cw, y + 29);
      ctx.textAlign = 'left';
      y += 30 + g(story ? 22 : 16);
      const rh = g(story ? 58 : 52);
      ms.forEach((m, i) => {
        const cy = y + rh / 2;
        // 순번 — 골드 외곽선 원 + mono
        ctx.beginPath(); ctx.arc(pad + 20, cy, 19, 0, Math.PI * 2);
        ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = font(500, 22, MONO); ctx.fillStyle = C.goldD;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), pad + 20, cy + 1);
        ctx.textAlign = 'left';
        // 이름
        ctx.font = font(700, 30, SANS); ctx.fillStyle = C.ink;
        ctx.fillText(m.name, pad + 58, cy);
        let nx = pad + 58 + ctx.measureText(m.name).width + 14;
        if (m.retired) {
          ctx.font = font(500, 20, SANS); ctx.fillStyle = C.sub2;
          ctx.fillText('퇴임', nx, cy + 1);
          nx += ctx.measureText('퇴임').width + 12;
        }
        // 지역구
        ctx.font = font(400, 24, SANS); ctx.fillStyle = C.sub;
        ctx.fillText(ellipsize(ctx, m.district || '', pad + cw - nx), nx, cy + 1);
        ctx.textBaseline = 'alphabetic';
        y += rh;
      });
      y += g(story ? 8 : 4);
      ctx.font = font(400, 20, SANS); ctx.fillStyle = C.sub2;
      ctx.fillText(`의원 좌표는 공동발의 기록 × 법안 방향 매핑 ${D.polMapping} · 안보축은 입법 기록으로 잴 수 없어 제외`, pad, y + 20);
      y += 20 + g(story ? 40 : 30);
    } else {
      y += g(story ? 20 : 10);
    }

    // CTA 박스 — 남는 세로 공간에 맞춰 위치를 잡는다 (푸터는 바닥 고정)
    const footH = 84;
    const footY = H - M.bottom - footH;
    const ctaH = g(story ? 150 : 128);
    let ctaY = y;
    // 여유가 조금이면 푸터 위에 붙여 아래를 채우고, 많이 남으면(가까운 의원이 없는 폴백 등) 내용 바로 뒤에 둔다 —
    // 한가운데 큰 구멍보다 아래가 비는 쪽이 덜 어색하다
    const slack = footY - 24 - ctaH - y;
    if (slack > 0 && slack <= 60) ctaY = footY - 24 - ctaH - (story ? Math.min(30, slack) : 0);
    else if (slack > 60) ctaY = y + Math.round(slack / 2);   // 많이 남으면 CTA 위아래로 고르게 나눈다
    ctx.fillStyle = C.tint; rr(ctx, pad, ctaY, cw, ctaH, 20); ctx.fill();
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2; rr(ctx, pad, ctaY, cw, ctaH, 20); ctx.stroke();
    ctx.font = font(900, f(story ? 40 : 36), SERIF); ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.fillText('당신은 어디쯤일까요?', W / 2, ctaY + Math.round(ctaH * 0.42));
    ctx.font = font(500, f(story ? 28 : 26), MONO); ctx.fillStyle = C.goldD;
    ctx.fillText(`${D.siteHost}/balance-game`, W / 2, ctaY + Math.round(ctaH * 0.76));
    ctx.textAlign = 'left';

    // 푸터 브랜드 (바닥 고정)
    ctx.fillStyle = C.line; ctx.fillRect(pad, footY, cw, 2);
    drawBrandRow(ctx, pad, footY + 24, cw, { mark: 46, wm: 34, tag: 26, url: story ? '' : D.siteHost, urlSize: 24 });
    if (story) {
      // 스토리는 하단 240px 을 인스타 UI·링크 스티커가 덮는다 — 안내는 미리보기에서만 (여기 그리지 않는다)
    }
    return { overflow: Math.max(0, (y + ctaH + 24) - footY) };
  }

  /* ---------- 폰트 준비 ---------- */
  function allText() {
    const t = [headline(), '나의 정치 성향 · 당말사 진단', '개 문항에 답한 결과 · 네 축의 위치', '좌표가 가장 가까운 의원',
      '3축 거리 · 가까운 순', '퇴임', '당신은 어디쯤일까요?', '당말사', '당 말고 사람', '중도', '미세하게', '약간 뚜렷하게', '뚜렷하게', '쪽',
      '의원 좌표는 공동발의 기록 × 법안 방향 매핑 · 안보축은 입법 기록으로 잴 수 없어 제외', '응답 없음', '네 축 모두 중도에 가깝습니다'];
    D.axes.forEach(a => t.push(a.name, a.short, a.Lx, a.Rx));
    (D.matches || []).forEach(m => t.push(m.name, m.district || ''));
    return t.join('');
  }
  async function loadFonts() {
    if (!document.fonts || !document.fonts.load) return;
    const txt = allText();
    const specs = [
      `900 60px ${SERIF}`, `700 32px ${SERIF}`,
      `700 30px ${SANS}`, `500 24px ${SANS}`, `400 24px ${SANS}`, `800 26px ${SANS}`,
      `500 24px ${MONO}`
    ];
    try { await Promise.all(specs.map(s => document.fonts.load(s, txt))); } catch (e) { /* 폴백 폰트로 그린다 */ }
    try { await document.fonts.ready; } catch (e) {}
  }

  /* ---------- UI ---------- */
  const canvas = document.getElementById('sc-canvas');
  const wrapEl = document.getElementById('sc-preview');
  const modeBtns = document.querySelectorAll('[data-sc-mode]');
  const saveBtn = document.getElementById('sc-save');
  const shareBtn = document.getElementById('sc-share');
  const status = document.getElementById('sc-status');
  let mode = (new URLSearchParams(location.search).get('mode') === 'feed') ? 'feed' : 'story';
  let ready = false;

  function setStatus(t) { if (status) status.textContent = t || ''; }
  function render() {
    // 넘치면 한 단계씩 조여서 다시 그린다 (최대 2단계). 그래도 넘치면 마지막 결과를 둔다
    let r = draw(canvas, mode, 0);
    for (let lv = 0.5; lv <= 2 && r.overflow > 0; lv += 0.5) r = draw(canvas, mode, lv);
    wrapEl.dataset.mode = mode;
    modeBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.scMode === mode ? 'true' : 'false'));
    if (r.overflow > 0) console.warn('[shareCard] 내용이 푸터를 넘음', r.overflow);
  }
  function fileName() { return `당말사-성향-${(D.date || '').replace(/\./g, '')}-${mode}.png`; }
  function toBlob() {
    return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob 실패')), 'image/png'));
  }
  async function save() {
    try {
      const blob = await toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus('저장했습니다. 사진 앱에서 인스타에 올리세요.');
    } catch (e) {
      // iOS 사파리 등 download 가 안 먹으면 새 탭에 띄운다 (길게 눌러 저장)
      try { window.open(canvas.toDataURL('image/png'), '_blank'); setStatus('새 탭의 이미지를 길게 눌러 저장하세요.'); }
      catch (e2) { setStatus('저장에 실패했습니다.'); }
    }
  }
  async function share() {
    try {
      const blob = await toBlob();
      const file = new File([blob], fileName(), { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '나의 정치 성향 · 당말사' });
        setStatus('');
        return;
      }
      await save();   // 시스템 공유 시트가 없으면 저장으로
    } catch (e) {
      if (e && e.name === 'AbortError') return;   // 사용자가 시트를 닫음
      setStatus('공유에 실패했습니다. 이미지 저장을 이용하세요.');
    }
  }

  // 클립보드 복사 — PNG 하나만 넣는다. (macOS 공유 시트의 "복사하기" 는 파일 참조+이미지를 같이 넣어
  // 붙여넣는 앱에 따라 2장으로 보인다 — 그 경로 대신 이걸 쓰라고 둔 버튼)
  async function copy() {
    if (!(navigator.clipboard && window.ClipboardItem)) { setStatus('이 브라우저는 이미지 복사를 지원하지 않습니다. 저장을 이용하세요.'); return; }
    try {
      // Safari 는 ClipboardItem 에 Promise<Blob> 을 넘겨야 사용자 제스처 안에서 통과한다
      const item = new ClipboardItem({ 'image/png': toBlob() });
      await navigator.clipboard.write([item]);
      setStatus('복사했습니다. 붙여넣기(⌘V / Ctrl+V)로 쓰세요.');
    } catch (e) {
      setStatus('복사에 실패했습니다. 이미지 저장을 이용하세요.');
    }
  }
  const copyBtn = document.getElementById('sc-copy');
  copyBtn?.addEventListener('click', () => { if (ready) copy(); });
  if (!(navigator.clipboard && window.ClipboardItem)) copyBtn?.setAttribute('hidden', '');

  modeBtns.forEach(b => b.addEventListener('click', () => { mode = b.dataset.scMode; render(); }));
  saveBtn?.addEventListener('click', () => { if (ready) save(); });
  shareBtn?.addEventListener('click', () => { if (ready) share(); });

  // 폰트 전 1차 렌더(빈 화면 방지) → 폰트 후 재렌더
  render();
  loadFonts().then(() => { render(); ready = true; wrapEl.classList.add('is-ready'); setStatus(''); });
  // 시스템 공유 시트가 없는 환경(대부분 데스크톱)은 공유 버튼을 숨긴다 — 저장이 곧 공유다
  if (!(navigator.share && navigator.canShare)) shareBtn?.setAttribute('hidden', '');
})();
