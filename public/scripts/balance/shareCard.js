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

  const MODES = {
    story:  { w: 1080, h: 1920, top: 250, bottom: 240, pad: 76 },
    feed:   { w: 1080, h: 1350, top: 64,  bottom: 56,  pad: 76 },
    square: { w: 1080, h: 1080, top: 56,  bottom: 48,  pad: 72 },   // 카톡·피드 1:1
    og:     { w: 1200, h: 628,  top: 56,  bottom: 48,  pad: 64 }    // 링크 프리뷰 1.91:1 (카톡·트위터·OG) — 가로형 별도 레이아웃
  };

  /* ---------- 문구 ---------- */
  // 유형 이름 — 서버 typeOf: 경제×사회 사분면 4종(+온건한) · 둘 다 중도면 균형 조율자. 네 이름은 똑같이 긍정적이어야 한다
  // 🔴 이름 체계는 서버(utils/axisConfig.js typeOf)가 정한다 — 사이트 결과 화면과 같은 이름. 여기선 받아 쓰기만
  function typeName() { return (D.type && D.type.name) || '균형 조율자'; }
  function typeDesc() { return (D.type && D.type.desc) || ''; }
  // 부제 — |값| ≥ 0.25 인 축을 세기 순으로 최대 2개. 전부 중도면 그렇게 말한다
  function headline() {
    const rows = D.axes
      .map(a => ({ a, v: Number(D.axis[a.key]) }))
      .filter(r => Number.isFinite(r.v) && Math.abs(r.v) >= 0.25)
      .sort((x, y) => Math.abs(y.v) - Math.abs(x.v))
      .slice(0, 2);
    if (!rows.length) return '네 축 모두 중도에 가깝습니다';
    // 부제는 짧은 극 라벨(L/R). "쪽" 어미는 뺐다 — 단정적이지 않아 붙여넣고 싶은 문장이 안 된다 (피드백)
    return rows.map(r => `${r.a.name}는 ${r.v > 0 ? r.a.R : r.a.L}`).join(', ');
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
  function drawMark(ctx, x, y, size, color) {
    const s = size / 64;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = color || C.gold;
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
  function drawTagline(ctx, x, y, size, T) {
    T = T || C;
    ctx.textBaseline = 'alphabetic';
    let cx = x;
    const parts = [
      ['당', T.dim, 500], [' 말고 ', T.mid, 500], ['사람', T.goldT || T.goldD, 800]
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
    const T = opt.T || C;
    const mark = opt.mark, wm = opt.wm, tag = opt.tag;
    const cy = y + mark / 2;
    drawMark(ctx, x, y, mark, T.gold);
    let cx = x + mark + 12;
    ctx.font = font(900, wm, SERIF);
    ctx.fillStyle = T.ink;
    ctx.textBaseline = 'middle';
    ctx.fillText('당말사', cx, cy + wm * 0.04);
    cx += ctx.measureText('당말사').width + 16;
    ctx.fillStyle = T.tick || C.line2;
    ctx.fillRect(cx, cy - tag * 0.7, 2, tag * 1.4);
    cx += 2 + 16;
    ctx.textBaseline = 'alphabetic';
    drawTagline(ctx, cx, cy + tag * 0.36, tag, T);
    if (opt.url) {
      ctx.font = font(500, opt.urlSize || tag, MONO);
      ctx.fillStyle = T.goldT || C.goldD;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(opt.url, x + w, cy);
      ctx.textAlign = 'left';
    }
  }

  /* ---------- 팔레트 (밝은 판 / 어두운 판) ---------- */
  // 어두운 판은 피드에서 눈에 띄라고 둔 것 — 정당색은 여전히 없고 강조는 골드 하나.
  // ⚠️ 어두운 판의 면(tint·내 사분면)은 **무채색**으로 — 골드를 다크 위에 얹으면 탁한 갈색이 된다 (피드백). 골드는 선·점·글자에만
  const THEMES = {
    light: { bg: '#F7F6F1', ink: '#1A1D24', sub: '#4B5362', sub2: '#5F6674', track: '#E2DFD4', tick: '#C9C5B6', gold: '#B8740C', goldT: '#8F5800', tint: '#FBF5EA', line: '#E2DFD4', halo: '#F7F6F1', dim: '#A8A095', mid: '#6B7280' },
    dark:  { bg: '#15171C', ink: '#F7F6F1', sub: '#C3C7CF', sub2: '#9AA0AB', track: '#2C3038', tick: '#454A55', gold: '#D9A040', goldT: '#E5B45C', tint: 'rgba(255,255,255,0.045)', line: '#2C3038', halo: '#15171C', dim: '#6E7480', mid: '#9AA0AB' }
  };

  /* ---------- 본체 — 포스터형 (2026-08-16 v2) ----------
     v1(자료 카드: 긴 라벨·해석 문장·각주)은 폰에서 2.8배 축소되면 글자가 8px 이 돼 "빽빽하다" 만 남았다.
     v2 는 헤드라인 하나를 아주 크게, 축은 짧은 극 라벨(시장|개입)만, 각주 최소. */
  function draw(canvas, mode, level, theme, layout, extra) {
    const M = MODES[mode] || MODES.feed;
    const T = THEMES[theme] || THEMES.light;
    if (mode === 'og') return drawLandscape(canvas, M, T, theme);
    const W = M.w, H = M.h;
    const L = level || 0;
    const g = (v) => Math.round(v * (1 - 0.28 * L));
    const f = (v) => v - 3 * L;
    const sp = Math.max(0, Math.round((extra || 0) / 4));   // 남는 세로 공간을 위쪽 구간에 나눠 준다 (리듬)
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const pad = M.pad, cw = W - pad * 2;
    const story = mode === 'story';
    const isMap = layout === 'map' && Array.isArray(D.cloud) && D.cloud.length > 10;

    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = T.gold; ctx.fillRect(0, 0, W, 14);

    let y = M.top;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    // 킥커: 나의 정치 성향 ……… 날짜
    ctx.font = font(700, 26, SANS); ctx.fillStyle = T.goldT;
    ctx.fillText('나의 정치 성향', pad, y + 26);
    ctx.font = font(500, 24, MONO); ctx.fillStyle = T.sub2; ctx.textAlign = 'right';
    ctx.fillText(D.date, pad + cw, y + 25); ctx.textAlign = 'left';
    y += 26 + g(story ? 30 : 22);

    // 유형 이름 — 카드의 주인공 (MBTI 의 4글자 자리). 아래에 부제 한 줄
    const tn = typeName();
    let hs = (story ? 116 : mode === 'square' ? 88 : 100) - 8 * L;
    ctx.font = font(900, hs, SERIF); ctx.fillStyle = T.ink;
    // 오른쪽 여백 48px 은 남긴다 — 마지막 글자가 끝에 닿으면 갑갑하다 (피드백)
    while (ctx.measureText(tn).width > cw - 48 && hs > 60) { hs -= 6; ctx.font = font(900, hs, SERIF); }
    ctx.fillText(tn, pad, y + hs);
    y += hs + g(story ? 20 : 14);
    // 부제 한 줄 — 유형의 한 줄 문구(typeOf().sub, 9종 체계). 정치제도 축은 지도 아래 한 줄이 맡는다
    const sub1 = (D.type && D.type.sub) ? D.type.sub : headline();
    ctx.font = font(600, f(story ? 28 : 25), SANS); ctx.fillStyle = T.sub;
    ctx.fillText(ellipsize(ctx, sub1, cw), pad, y + 28);
    y += 28 + g(story ? 44 : 32) + sp;

    if (isMap) {
      // ── 좌표 지도: 경제(x) × 사회·문화(y). 의원 전원을 회색 점으로, 나를 큰 골드 점으로 ──
      const mh = g(story ? 560 : mode === 'square' ? 360 : 440), mx = pad, mw = cw, my = y;
      const ex = D.axes.find(a => a.key === 'economy'), sy = D.axes.find(a => a.key === 'social');
      const inset = 56;                                     // ±1 이어도 점이 테두리에 붙지 않게 (잘린 것처럼 보인다)
      const X = (v) => mx + inset + (Math.max(-1, Math.min(1, v)) + 1) / 2 * (mw - inset * 2);
      const Y = (v) => my + mh - inset - (Math.max(-1, Math.min(1, v)) + 1) / 2 * (mh - inset * 2);
      // 판
      ctx.fillStyle = T.tint; rr(ctx, mx, my, mw, mh, 24); ctx.fill();
      // 내가 있는 사분면을 옅게 — "이 판에서 나는 여기 쪽" 이 한눈에
      const ue0 = Number(D.axis.economy), us0 = Number(D.axis.social);
      const myQ = (Number.isFinite(ue0) && Number.isFinite(us0)) ? { r: ue0 >= 0, t: us0 >= 0 } : null;
      if (myQ) {
        ctx.save(); rr(ctx, mx, my, mw, mh, 24); ctx.clip();
        // 어두운 판은 골드를 얹으면 탁한 갈색이 된다 → 배경보다 밝기만 올린 무채색 (피드백). 밝은 판은 옅은 골드 틴트
        ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(184,116,12,0.09)';
        ctx.fillRect(myQ.r ? X(0) : mx, myQ.t ? my : Y(0), mw / 2, mh / 2);
        ctx.restore();
      }
      ctx.strokeStyle = T.line; ctx.lineWidth = 2; rr(ctx, mx, my, mw, mh, 24); ctx.stroke();
      // 십자 (중도선)
      ctx.strokeStyle = T.tick; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(X(0), my + 14); ctx.lineTo(X(0), my + mh - 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx + 14, Y(0)); ctx.lineTo(mx + mw - 14, Y(0)); ctx.stroke();
      ctx.setLineDash([]);
      // 의원 점구름 (익명)
      // 작고 반투명하게 — 개별 식별이 아니라 밀도(어디에 몰려 있나)가 보이게. 겹치는 곳이 저절로 진해진다
      ctx.fillStyle = theme === 'dark' ? 'rgba(200,205,215,0.34)' : 'rgba(75,83,98,0.26)';
      D.cloud.forEach(p => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), story ? 6 : 5, 0, Math.PI * 2); ctx.fill(); });
      // 사분면 이름 — 네 모서리. 내가 있는 칸만 진하게
      const L_ = ex ? ex.L : '', R_ = ex ? ex.R : '', B_ = sy ? sy.L : '', U_ = sy ? sy.R : '';
      const quads = [
        { x: mx + 24,      y: my + 44,      al: 'left',  t: `${L_} · ${U_}`, on: myQ && !myQ.r &&  myQ.t },
        { x: mx + mw - 24, y: my + 44,      al: 'right', t: `${R_} · ${U_}`, on: myQ &&  myQ.r &&  myQ.t },
        { x: mx + 24,      y: my + mh - 26, al: 'left',  t: `${L_} · ${B_}`, on: myQ && !myQ.r && !myQ.t },
        { x: mx + mw - 24, y: my + mh - 26, al: 'right', t: `${R_} · ${B_}`, on: myQ &&  myQ.r && !myQ.t }
      ];
      ctx.textBaseline = 'alphabetic';
      quads.forEach(q => {
        ctx.font = font(q.on ? 800 : 600, 26, SANS);
        ctx.fillStyle = q.on ? T.ink : T.sub2;
        ctx.textAlign = q.al; ctx.fillText(q.t, q.x, q.y);
      });
      ctx.textAlign = 'left';
      // 가까운 3명 = ①②③ 골드 배지 · 반대 3명 = ⒶⒷⒸ 회색 배지 — 아래 목록의 배지와 1:1 (외부 제안 채택)
      // 🔴 배지끼리 겹치면 비켜 놓고 리더선으로 점에 잇는다 — "가장 먼 3명" 은 한 구석에 몰려 구조적으로 겹친다 (피드백)
      const R_B = 14, placedB = [];
      const OFFS = [[0, 0], [-34, -26], [34, -26], [-34, 26], [34, 26], [-52, 0], [52, 0], [0, -44], [0, 44], [-60, -40], [60, -40], [-60, 40], [60, 40]];
      const inMap = (x, yy) => x > mx + R_B + 4 && x < mx + mw - R_B - 4 && yy > my + R_B + 4 && yy < my + mh - R_B - 4;
      const badgeDraw = ({ px, py, bx, by, label, on, moved }) => {
        if (moved) {   // 점 표시 + 리더선
          ctx.strokeStyle = on ? T.gold : (theme === 'dark' ? '#8B93A1' : '#8A909B'); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
          ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fillStyle = on ? T.gold : (theme === 'dark' ? '#8B93A1' : '#8A909B'); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(bx, by, R_B + 3, 0, Math.PI * 2); ctx.fillStyle = T.halo; ctx.fill();
        ctx.beginPath(); ctx.arc(bx, by, R_B, 0, Math.PI * 2); ctx.fillStyle = on ? T.gold : (theme === 'dark' ? '#8B93A1' : '#8A909B'); ctx.fill();
        ctx.font = font(800, 16, SANS); ctx.fillStyle = theme === 'dark' ? '#15171C' : '#FFFFFF';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, bx, by + 1);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      };
      const farPts  = (Array.isArray(D.far) ? D.far.slice(0, 3) : []).filter(m => Number.isFinite(m.e) && Number.isFinite(m.s));
      const nearPts = (Array.isArray(D.matches) ? D.matches.slice(0, 3) : []).filter(m => Number.isFinite(m.e) && Number.isFinite(m.s));
      // 배지 위치를 먼저 정하고(그리진 않음) → 나→①②③ 점선을 배지 자리를 오려낸 채 긋고 → 배지를 얹는다.
      // 점선이 다른 배지(①)를 관통하지 않게 (2차 피드백)
      const ue0b = Number(D.axis.economy), us0b = Number(D.axis.social);
      const hasMe = Number.isFinite(ue0b) && Number.isFinite(us0b);
      if (hasMe) placedB.push({ x: X(ue0b), y: Y(us0b) }, { x: X(ue0b), y: Y(us0b) });   // 나 자리 예약
      const plan = [];
      const planAt = (px, py, label, on) => {
        let bx = px, by = py, moved = false;
        for (const [dx, dy] of OFFS) {
          const cx_ = px + dx, cy_ = py + dy;
          if (!inMap(cx_, cy_)) continue;
          if (!placedB.some(q => Math.hypot(q.x - cx_, q.y - cy_) < R_B * 2 + 6)) { bx = cx_; by = cy_; moved = dx !== 0 || dy !== 0; break; }
        }
        placedB.push({ x: bx, y: by }); plan.push({ px, py, bx, by, label, on, moved });
      };
      farPts.forEach((m, i) => planAt(X(m.e), Y(m.s), 'ABC'[i], false));
      nearPts.forEach((m, i) => planAt(X(m.e), Y(m.s), String(i + 1), true));
      if (hasMe && nearPts.length) {
        ctx.save();
        // evenodd 클립: 판 전체에서 배지 원들을 뺀 영역에만 점선이 그려진다
        ctx.beginPath(); ctx.rect(mx, my, mw, mh);
        plan.forEach(b => { ctx.moveTo(b.bx + R_B + 6, b.by); ctx.arc(b.bx, b.by, R_B + 6, 0, Math.PI * 2); });
        ctx.clip('evenodd');
        ctx.strokeStyle = T.gold; ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.setLineDash([5, 7]);
        nearPts.forEach(m => { ctx.beginPath(); ctx.moveTo(X(ue0b), Y(us0b)); ctx.lineTo(X(m.e), Y(m.s)); ctx.stroke(); });
        ctx.restore();
      }
      plan.forEach(b => badgeDraw(b));
      // 나
      const ue = Number(D.axis.economy), us = Number(D.axis.social);
      if (Number.isFinite(ue) && Number.isFinite(us)) {
        const px = X(ue), py = Y(us);
        ctx.beginPath(); ctx.arc(px, py, 40, 0, Math.PI * 2); ctx.fillStyle = theme === 'dark' ? 'rgba(217,160,64,0.22)' : 'rgba(184,116,12,0.18)'; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, 26, 0, Math.PI * 2); ctx.fillStyle = T.halo; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, 20, 0, Math.PI * 2); ctx.fillStyle = T.gold; ctx.fill();
        // "나" 라벨 — 점 오른쪽 위, 판 밖으로 나가면 왼쪽으로
        ctx.font = font(800, 28, SANS); ctx.fillStyle = T.ink; ctx.textBaseline = 'middle';
        const lw = ctx.measureText('나').width;
        const lx = (px + 34 + lw > mx + mw - 20) ? px - 34 - lw : px + 34;
        ctx.fillText('나', lx, py);
        ctx.textBaseline = 'alphabetic';
      }
      y = my + mh + g(story ? 22 : 16);
      // 축 설명 두 줄 (짧게) — 사분면 이름만으로는 가로·세로가 무엇인지 안 온다는 지적과, 제안서 둘 다 이 두 줄을 뒀다
      const cap = (name, l, r, ar) => {
        ctx.font = font(800, 23, SANS); ctx.fillStyle = T.goldT; ctx.fillText(name, pad, y + 23);
        const nw = ctx.measureText(name).width + 12;
        ctx.font = font(500, 23, SANS); ctx.fillStyle = T.sub;
        ctx.fillText(`${ar[0]} ${l}  ·  ${r} ${ar[1]}`, pad + nw, y + 23);
        y += 23 + g(8);
      };
      if (ex) cap('가로', ex.Lx, ex.Rx, ['←', '→']);
      if (sy) cap('세로', sy.Lx, sy.Rx, ['↓', '↑']);
      y += g(6);
      // 지도에 안 실린 두 축은 한 줄로
      // 지도에 없는 축 중 의원 비교에 쓰는 축(정치제도)만 — 안보는 여기서 뺐다 (차트에 없는 축, 피드백)
      const rest = D.axes.filter(a => a.key !== 'economy' && a.key !== 'social' && a.measured).map(a => {
        const v = Number(D.axis[a.key]);
        const ph = axisPhrase(a, v);
        return `${a.name} ${ph === '중도' ? '중도' : (v > 0 ? a.R : a.L) + ' 쪽'}`;
      });
      ctx.font = font(500, 24, SANS); ctx.fillStyle = T.sub;
      ctx.fillText(rest.join('  ·  ') + `  ·  점 하나가 의원 한 명 (${D.polTotal || D.cloud.length}명)`, pad, y + 24);
      y += 24 + g(story ? 34 : 24) + sp;
    } else {
      // 축 4줄 — 이름 / [L] ━━━●━━ [R]  + 가까운 ①②③ · 먼 ⒶⒷⒸ 마커 (축별로 "어디는 같고 어디는 다른가" 가 보인다 — 막대형 피드백)
      const rowGap = g(story ? 30 : 22);
      const labW = 96;
      const AXK = { economy: 'e', social: 's', institution: 'i' };   // 의원 좌표 필드
      const nearB = (Array.isArray(D.matches) ? D.matches.slice(0, 3) : []);
      const farB  = (Array.isArray(D.far) ? D.far.slice(0, 3) : []);
      const greyM = theme === 'dark' ? '#8B93A1' : '#8A909B';
      for (const a of D.axes) {
        const v = Number(D.axis[a.key]);
        const has = Number.isFinite(v);
        ctx.font = font(700, f(30), SANS); ctx.fillStyle = T.ink;
        ctx.fillText(a.name, pad, y + 30);
        if (!a.measured) {
          const nw = ctx.measureText(a.name).width;
          ctx.font = font(400, 20, SANS); ctx.fillStyle = T.sub2;
          ctx.fillText('의원 비교 제외', pad + nw + 12, y + 29);
        }
        y += 30 + g(story ? 40 : 34);   // 마커 삼각형+라벨 자리(위) 포함
        const th = 16, tx = pad + labW, tw = cw - labW * 2, cy = y + th / 2;
        const inner = tw / 2 - 34;      // 핸들(반지름 22)이 트랙 끝을 넘지 않게
        const PX = (val) => tx + tw / 2 + Math.max(-1, Math.min(1, val)) * inner;
        const side = has ? (v < -0.05 ? 'L' : v > 0.05 ? 'R' : '') : '';
        ctx.font = font(700, 27, SANS); ctx.textBaseline = 'middle';
        ctx.fillStyle = side === 'L' ? T.ink : T.sub2; ctx.textAlign = 'right'; ctx.fillText(a.L, tx - 18, cy + 1);
        ctx.fillStyle = side === 'R' ? T.ink : T.sub2; ctx.textAlign = 'left';  ctx.fillText(a.R, tx + tw + 18, cy + 1);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        // 트랙 + 중앙 기준선 (조금 진하게 — 네 막대가 같은 x 라 세로로 정렬돼 보인다)
        ctx.fillStyle = T.track; rr(ctx, tx, y, tw, th, th / 2); ctx.fill();
        ctx.fillStyle = T.sub2; ctx.fillRect(tx + tw / 2 - 1, y - 10, 2, th + 20);
        // 의원 마커 — 트랙 위쪽에 작은 삼각형 + 번호. 겹치면 위로 한 단 올린다
        if (a.measured) {
          const marks = [];
          farB.forEach((m, i) => { const mv = Number(m[AXK[a.key]]); if (Number.isFinite(mv)) marks.push({ x: PX(mv), label: 'ABC'[i], on: false }); });
          nearB.forEach((m, i) => { const mv = Number(m[AXK[a.key]]); if (Number.isFinite(mv)) marks.push({ x: PX(mv), label: String(i + 1), on: true }); });
          // 가까운 마커끼리(<28px)는 한 덩어리로 묶어 삼각형 하나 + "ABC" 한 줄 — 세로로 쌓으면 개별 식별이 안 된다 (피드백)
          marks.sort((p, q) => p.x - q.x);
          const groups = [];
          marks.forEach(mk => {
            const g0 = groups[groups.length - 1];
            if (g0 && mk.x - g0.xs[g0.xs.length - 1] < 28) { g0.xs.push(mk.x); g0.items.push(mk); }
            else groups.push({ xs: [mk.x], items: [mk] });
          });
          groups.forEach(gr => {
            const gx = gr.xs.reduce((a2, b2) => a2 + b2, 0) / gr.xs.length;
            const anyOn = gr.items.some(i => i.on), allOn = gr.items.every(i => i.on);
            const col = allOn ? T.gold : anyOn ? T.gold : greyM;
            // 삼각형 (크게)
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.moveTo(gx, y - 2); ctx.lineTo(gx - 10, y - 16); ctx.lineTo(gx + 10, y - 16); ctx.closePath(); ctx.fill();
            // 라벨 — 골드/회색 섞이면 각 글자를 제 색으로
            ctx.font = font(800, 21, SANS); ctx.textAlign = 'left';
            // 묶인 라벨은 위치가 아니라 이름 순으로 ("32" 보다 "23", "BCA" 보다 "ABC" 가 읽힌다 — 어차피 한 자리다)
            const parts = gr.items.slice().sort((a2, b2) => a2.label.localeCompare(b2.label)).map(i => ({ t: i.label, c: i.on ? T.goldT : greyM }));
            const gap = 3;
            const total = parts.reduce((w, p_) => w + ctx.measureText(p_.t).width, 0) + gap * (parts.length - 1);
            let lx = gx - total / 2;
            const yl = y - 22;
            parts.forEach(p_ => { ctx.fillStyle = p_.c; ctx.fillText(p_.t, lx, yl); lx += ctx.measureText(p_.t).width + gap; });
          });
        }
        if (has) {
          const px = PX(v);
          ctx.fillStyle = a.measured ? T.gold : T.sub2;
          const bx = Math.min(px, tx + tw / 2), bw = Math.abs(px - tx - tw / 2);
          ctx.globalAlpha = 0.45; rr(ctx, bx, y, Math.max(bw, 1), th, th / 2); ctx.fill(); ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(px, cy, 22, 0, Math.PI * 2); ctx.fillStyle = T.halo; ctx.fill();
          ctx.beginPath(); ctx.arc(px, cy, 17, 0, Math.PI * 2); ctx.fillStyle = a.measured ? T.gold : T.sub2; ctx.fill();
        }
        y += th + rowGap;
      }
      // 마커 범례 한 줄
      if (nearB.length || farB.length) {
        ctx.font = font(500, 21, SANS); ctx.fillStyle = T.sub2;
        ctx.fillText('▲ 골드 ①②③ 좌표가 가장 가까운 의원  ·  ▲ 회색 ⒶⒷⒸ 가장 먼 의원  ·  안보·외교는 의원 좌표 없음', pad, y + 21);
        y += 21 + g(story ? 22 : 14);
      }
      y += g(story ? 24 : 12) + sp;
    }

    // 가까운 3 | 반대 3 — 이름 크게, 지역구는 작게
    const near = Array.isArray(D.matches) ? D.matches.slice(0, 3) : [];
    const far  = Array.isArray(D.far) ? D.far.slice(0, 3) : [];
    if (near.length || far.length) {
      ctx.fillStyle = T.line; ctx.fillRect(pad, y, cw, 2); y += g(story ? 32 : 24);
      const colGap = 40, colW = (cw - colGap) / 2;
      const cols = [
        { x: pad,                 title: '좌표가 가장 가까운', list: near },
        { x: pad + colW + colGap, title: '가장 먼 (반대 성향)',  list: far  }
      ];
      const rh = g(story ? 60 : 54);
      let yEnd = y;
      cols.forEach(col => {
        if (!col.list.length) return;
        let cy0 = y;
        ctx.font = font(700, 24, SANS); ctx.fillStyle = T.goldT;
        ctx.fillText(col.title, col.x, cy0 + 24);
        cy0 += 24 + g(story ? 16 : 12);
        col.list.forEach((m, i) => {
          // 배지 — 지도 위 배지와 같은 모양·같은 글자 (가까운 ①②③ 골드 / 반대 ⒶⒷⒸ 회색)
          const isNear = col.list === near;
          const bx = col.x + 15, by = cy0 + 22;
          ctx.beginPath(); ctx.arc(bx, by, 15, 0, Math.PI * 2);
          ctx.fillStyle = isNear ? T.gold : (theme === 'dark' ? '#8B93A1' : '#8A909B'); ctx.fill();
          ctx.font = font(800, 16, SANS); ctx.fillStyle = isNear ? (theme === 'dark' ? '#15171C' : '#FFFFFF') : (theme === 'dark' ? '#15171C' : '#FFFFFF');
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(isNear ? String(i + 1) : 'ABC'[i], bx, by + 1);
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
          ctx.font = font(800, f(story ? 32 : 29), SANS); ctx.fillStyle = T.ink;
          ctx.fillText(m.name, col.x + 42, cy0 + 33);
          let nx = col.x + 42 + ctx.measureText(m.name).width + 12;
          ctx.font = font(400, 21, SANS); ctx.fillStyle = T.sub2;
          const meta = (m.retired ? '퇴임 · ' : '') + (m.district || '');
          const dw = col.x + colW - nx;
          if (dw > 40 && meta) ctx.fillText(ellipsize(ctx, meta, dw), nx, cy0 + 33);
          cy0 += rh;
        });
        yEnd = Math.max(yEnd, cy0);
      });
      // 각주("공동발의 기록으로 만든 좌표 · 안보축 제외")는 이미지에서 뺐다 — 0.5초에 스치는 이미지에서 읽는 사람이 없고, 웹페이지에 있다 (피드백)
      y = yEnd + g(story ? 30 : 20) + sp;
    } else {
      y += g(story ? 20 : 10);
    }

    // CTA + 푸터
    const footH = 84;
    const footY = H - M.bottom - footH;
    const ctaH = g(story ? 156 : 132);
    let ctaY = y;
    const slack = footY - 24 - ctaH - y;
    if (slack > 0) ctaY = footY - 24 - ctaH - (story ? Math.min(30, slack) : 0);   // 남는 건 render() 가 extra 로 위쪽에 나눠 준 뒤라 여기선 푸터에 붙인다
    ctx.fillStyle = T.tint; rr(ctx, pad, ctaY, cw, ctaH, 22); ctx.fill();
    ctx.strokeStyle = T.gold; ctx.lineWidth = 2; rr(ctx, pad, ctaY, cw, ctaH, 22); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = font(900, f(story ? 46 : 40), SERIF); ctx.fillStyle = T.ink;
    ctx.fillText('당신은 어떤 유형일까요?', W / 2, ctaY + Math.round(ctaH * 0.44));
    ctx.font = font(500, f(story ? 30 : 27), MONO); ctx.fillStyle = T.goldT;
    ctx.fillText(`${D.siteHost}/balance-game`, W / 2, ctaY + Math.round(ctaH * 0.78));
    ctx.textAlign = 'left';

    ctx.fillStyle = T.line; ctx.fillRect(pad, footY, cw, 2);
    drawBrandRow(ctx, pad, footY + 24, cw, { mark: 46, wm: 34, tag: 26, url: story ? '' : D.siteHost, urlSize: 24, T });
    return { overflow: Math.max(0, (y + ctaH + 24) - footY), slack: Math.max(0, footY - 24 - ctaH - y) };
  }

  /* ---------- 링크 프리뷰 1200×628 (가로형) — 왼쪽 유형 이름·설명·브랜드, 오른쪽 지도 + 주소 ---------- */
  function drawLandscape(canvas, M, T, theme) {
    const W = M.w, H = M.h, pad = M.pad;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = T.gold; ctx.fillRect(0, 0, W, 12);
    // 오른쪽 지도 판
    const mw = 440, mh = 380, mx = W - pad - mw, my = 60;
    const isMap = Array.isArray(D.cloud) && D.cloud.length > 10;
    const leftW = mx - pad - 40;
    // 왼쪽 텍스트
    let y = 84;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = font(700, 20, SANS); ctx.fillStyle = T.goldT; ctx.fillText('나의 정치 성향 유형', pad, y);
    y += 44;
    const tn = typeName();
    let hs = 88; ctx.font = font(900, hs, SERIF); ctx.fillStyle = T.ink;
    while (ctx.measureText(tn).width > leftW && hs > 48) { hs -= 6; ctx.font = font(900, hs, SERIF); }
    ctx.fillText(tn, pad, y + hs - 12); y += hs + 14;
    const desc = (D.type && D.type.sub) ? D.type.sub : typeDesc().split('. ')[0];
    ctx.font = font(500, 24, SANS); ctx.fillStyle = T.sub;
    wrap(ctx, desc, leftW).slice(0, 2).forEach((l, i) => ctx.fillText(l, pad, y + 24 + i * 34));
    // 브랜드 (왼쪽 아래)
    drawBrandRow(ctx, pad, H - M.bottom - 44, leftW, { mark: 40, wm: 30, tag: 22, T });
    if (!isMap) { ctx.font = font(500, 22, MONO); ctx.fillStyle = T.goldT; ctx.textAlign = 'right'; ctx.fillText(`${D.siteHost}/balance-game`, W - pad, H - M.bottom - 20); return { overflow: 0, slack: 0 }; }
    const ex = D.axes.find(a => a.key === 'economy'), sy = D.axes.find(a => a.key === 'social');
    const inset = 36;
    const X = (v) => mx + inset + (Math.max(-1, Math.min(1, v)) + 1) / 2 * (mw - inset * 2);
    const Y = (v) => my + mh - inset - (Math.max(-1, Math.min(1, v)) + 1) / 2 * (mh - inset * 2);
    ctx.fillStyle = T.tint; rr(ctx, mx, my, mw, mh, 18); ctx.fill();
    const ue = Number(D.axis.economy), us = Number(D.axis.social);
    if (Number.isFinite(ue) && Number.isFinite(us)) {
      ctx.save(); rr(ctx, mx, my, mw, mh, 18); ctx.clip();
      ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(184,116,12,0.09)';
      ctx.fillRect(ue >= 0 ? X(0) : mx, us >= 0 ? my : Y(0), mw / 2, mh / 2); ctx.restore();
    }
    ctx.strokeStyle = T.line; ctx.lineWidth = 2; rr(ctx, mx, my, mw, mh, 18); ctx.stroke();
    ctx.strokeStyle = T.tick; ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.moveTo(X(0), my + 10); ctx.lineTo(X(0), my + mh - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx + 10, Y(0)); ctx.lineTo(mx + mw - 10, Y(0)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = theme === 'dark' ? 'rgba(200,205,215,0.34)' : 'rgba(75,83,98,0.26)';
    D.cloud.forEach(p => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 4, 0, Math.PI * 2); ctx.fill(); });
    ctx.font = font(600, 16, SANS); ctx.fillStyle = T.sub2;
    const L_ = ex ? ex.L : '', R_ = ex ? ex.R : '', B_ = sy ? sy.L : '', U_ = sy ? sy.R : '';
    ctx.textAlign = 'left';  ctx.fillText(`${L_} · ${U_}`, mx + 14, my + 26);  ctx.fillText(`${L_} · ${B_}`, mx + 14, my + mh - 14);
    ctx.textAlign = 'right'; ctx.fillText(`${R_} · ${U_}`, mx + mw - 14, my + 26); ctx.fillText(`${R_} · ${B_}`, mx + mw - 14, my + mh - 14);
    ctx.textAlign = 'left';
    // 배지 겹침 회피 + 리더선 · 나→①②③ 점선 — 세로형과 같은 규칙 (반지름만 작다)
    const R_B = 10, placedB = [];
    const OFFS = [[0, 0], [-24, -18], [24, -18], [-24, 18], [24, 18], [-36, 0], [36, 0], [0, -32], [0, 32], [-44, -30], [44, -30], [-44, 30], [44, 30]];
    const inMap = (x, yy) => x > mx + R_B + 3 && x < mx + mw - R_B - 3 && yy > my + R_B + 3 && yy < my + mh - R_B - 3;
    const grey = theme === 'dark' ? '#8B93A1' : '#8A909B', greyL = theme === 'dark' ? '#8B93A1' : '#8A909B';
    const nearL = (D.matches || []).slice(0, 3).filter(m => Number.isFinite(m.e) && Number.isFinite(m.s));
    const farL  = (D.far || []).slice(0, 3).filter(m => Number.isFinite(m.e) && Number.isFinite(m.s));
    const hasMe = Number.isFinite(ue) && Number.isFinite(us);
    if (hasMe) placedB.push({ x: X(ue), y: Y(us) });
    const plan = [];
    const planAt = (px, py, label, on) => {
      let bx = px, by = py, moved = false;
      for (const [dx, dy] of OFFS) {
        const cx_ = px + dx, cy_ = py + dy;
        if (!inMap(cx_, cy_)) continue;
        if (!placedB.some(q => Math.hypot(q.x - cx_, q.y - cy_) < R_B * 2 + 4)) { bx = cx_; by = cy_; moved = dx !== 0 || dy !== 0; break; }
      }
      placedB.push({ x: bx, y: by }); plan.push({ px, py, bx, by, label, on, moved });
    };
    farL.forEach((m, i) => planAt(X(m.e), Y(m.s), 'ABC'[i], false));
    nearL.forEach((m, i) => planAt(X(m.e), Y(m.s), String(i + 1), true));
    if (hasMe && nearL.length) {
      ctx.save();
      ctx.beginPath(); ctx.rect(mx, my, mw, mh);
      plan.forEach(q => { ctx.moveTo(q.bx + R_B + 4, q.by); ctx.arc(q.bx, q.by, R_B + 4, 0, Math.PI * 2); });
      ctx.clip('evenodd');
      ctx.strokeStyle = T.gold; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
      nearL.forEach(m => { ctx.beginPath(); ctx.moveTo(X(ue), Y(us)); ctx.lineTo(X(m.e), Y(m.s)); ctx.stroke(); });
      ctx.restore();
    }
    plan.forEach(({ px, py, bx, by, label, on, moved }) => {
      if (moved) {
        ctx.strokeStyle = on ? T.gold : greyL; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fillStyle = on ? T.gold : greyL; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(bx, by, R_B + 2, 0, Math.PI * 2); ctx.fillStyle = T.halo; ctx.fill();
      ctx.beginPath(); ctx.arc(bx, by, R_B, 0, Math.PI * 2); ctx.fillStyle = on ? T.gold : grey; ctx.fill();
      ctx.font = font(800, 12, SANS); ctx.fillStyle = theme === 'dark' ? '#15171C' : '#FFFFFF';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, bx, by + 1); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    });
    if (Number.isFinite(ue) && Number.isFinite(us)) {
      const px = X(ue), py = Y(us);
      ctx.beginPath(); ctx.arc(px, py, 26, 0, Math.PI * 2); ctx.fillStyle = theme === 'dark' ? 'rgba(217,160,64,0.22)' : 'rgba(184,116,12,0.18)'; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 17, 0, Math.PI * 2); ctx.fillStyle = T.halo; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.fillStyle = T.gold; ctx.fill();
      ctx.font = font(800, 20, SANS); ctx.fillStyle = T.ink; ctx.textBaseline = 'middle';
      const lw = ctx.measureText('나').width; const lx = (px + 24 + lw > mx + mw - 12) ? px - 24 - lw : px + 24;
      ctx.fillText('나', lx, py); ctx.textBaseline = 'alphabetic';
    }
    // 주소 (지도 아래)
    ctx.fillStyle = T.tint; rr(ctx, mx, my + mh + 20, mw, 60, 12); ctx.fill();
    ctx.strokeStyle = T.gold; ctx.lineWidth = 2; rr(ctx, mx, my + mh + 20, mw, 60, 12); ctx.stroke();
    ctx.font = font(500, 22, MONO); ctx.fillStyle = T.goldT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${D.siteHost}/balance-game`, mx + mw / 2, my + mh + 51);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    return { overflow: 0, slack: 0 };
  }

  /* ---------- 폰트 준비 ---------- */
  function allText() {
    const t = [headline(), '나의 정치 성향 · 당말사 진단', '개 문항에 답한 결과 · 네 축의 위치', '좌표가 가장 가까운 의원',
      '3축 거리 · 가까운 순', '퇴임', '당신은 어디쯤일까요?', '당말사', '당 말고 사람', '중도', '미세하게', '약간 뚜렷하게', '뚜렷하게', '쪽',
      '의원 좌표는 공동발의 기록 × 법안 방향 매핑 · 안보축은 입법 기록으로 잴 수 없어 제외', '응답 없음', '네 축 모두 중도에 가깝습니다'];
    D.axes.forEach(a => t.push(a.name, a.short, a.Lx, a.Rx));
    (D.matches || []).concat(D.far || []).forEach(m => t.push(m.name, m.district || ''));
    t.push(typeName(), typeDesc(), (D.type && D.type.sub) || '', '나의 정치 성향 유형', '당신은 어떤 유형일까요?', '가로', '세로', '가장 먼 (반대 성향)', '에 가깝습니다.', '나', '점 하나가 의원 한 명', '균형 조율자', '좌표가 가장 가까운', '반대 성향', '의원 비교 제외', '명 · 공동발의 기록으로 만든 좌표 · 안보축 제외', '퇴임 · ');
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
  // 정사각(square)·가로형(og)은 UI 에서 막아둠 — URL 로도 안 열리게 story/feed 만 받는다
  let mode = (new URLSearchParams(location.search).get('mode') === 'feed') ? 'feed' : 'story';
  let theme = (new URLSearchParams(location.search).get('theme') === 'dark') ? 'dark' : 'light';
  const themeBtns = document.querySelectorAll('[data-sc-theme]');
  // 기본은 막대형 — 4축 + 축별 의원 마커가 지도형보다 정보가 많다 (막대형 피드백으로 뒤집음). 지도형은 전체 분포를 보고 싶을 때
  let layout = (new URLSearchParams(location.search).get('layout') === 'map') ? 'map' : 'bars';
  const layoutBtns = document.querySelectorAll('[data-sc-layout]');
  let ready = false;

  function setStatus(t) { if (status) status.textContent = t || ''; }
  function render() {
    // 넘치면 한 단계씩 조여서 다시 그린다 (최대 2단계). 그래도 넘치면 마지막 결과를 둔다
    let lv = 0, r = draw(canvas, mode, 0, theme, layout, 0);
    for (lv = 0.5; lv <= 2 && r.overflow > 0; lv += 0.5) r = draw(canvas, mode, lv, theme, layout, 0);
    // 남는 공간이 크면 위쪽 구간(제목 아래·차트 아래·목록 아래)에 나눠 준다 — CTA 위만 비는 리듬을 막는다
    if (r.overflow === 0 && r.slack > 80) r = draw(canvas, mode, Math.max(0, lv - 0.5), theme, layout, Math.min(r.slack - 40, 360));
    layoutBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.scLayout === layout ? 'true' : 'false'));
    wrapEl.dataset.mode = mode; wrapEl.dataset.theme = theme;
    modeBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.scMode === mode ? 'true' : 'false'));
    themeBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.scTheme === theme ? 'true' : 'false'));
    if (r.overflow > 0) console.warn('[shareCard] 내용이 푸터를 넘음', r.overflow);
    prepareBlob();
  }
  function fileName() { return `당말사-성향-${(D.date || '').replace(/\./g, '')}-${mode}-${theme}-${layout}.png`; }
  function toBlob() {
    return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob 실패')), 'image/png'));
  }
  // 그릴 때마다 PNG 를 미리 만들어 둔다 — 공유/저장 클릭 순간에 await 없이 바로 쓰기 위해
  // (모바일 브라우저는 사용자 제스처 안에서만 share 를 허용하고, await 뒤에는 그 권한이 사라지는 경우가 있다)
  let readyBlob = null, blobSeq = 0;
  function prepareBlob() {
    const seq = ++blobSeq; readyBlob = null;
    toBlob().then(b => { if (seq === blobSeq) readyBlob = b; }).catch(() => {});
  }
  let busy = false;   // 공유/저장 재진입 차단 — 시트가 열렸다 닫혔다 반복하는 현상 방지
  // 삼성 인터넷은 Web Share 파일 공유 시트가 불안정하다 (2026-08-16 실기기 영상: 시트가 로딩 상태로 떴다 사라졌다 반복).
  // 한 번은 시도하되, 실패·취소되면 다음부터는 저장 경로로 보낸다
  const isSamsung = /SamsungBrowser/i.test(navigator.userAgent);
  let shareFailedOnce = false;
  async function save() {
    if (busy) return; busy = true;
    try {
      const blob = readyBlob || await toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName();
      a.setAttribute('data-no-loader', '');   // 페이지 전환 로더(layout.ejs)가 이 클릭을 내부 이동으로 오인하지 않게
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus('저장했습니다. 사진 앱에서 인스타에 올리세요.');
    } catch (e) {
      // iOS 사파리 등 download 가 안 먹으면 새 탭에 띄운다 (길게 눌러 저장)
      try { window.open(canvas.toDataURL('image/png'), '_blank'); setStatus('새 탭의 이미지를 길게 눌러 저장하세요.'); }
      catch (e2) { setStatus('저장에 실패했습니다.'); }
    } finally { setTimeout(() => { busy = false; }, 800); }
  }
  async function share() {
    if (busy) return; busy = true;
    // 삼성 인터넷: 폴드 펼침·태블릿(넓은 화면)에선 공유 시트가 떠 있는 창으로 뜨면서 재생성을 반복한다 (실기기 확인) → 처음부터 저장으로.
    // 접은 화면(좁은 폭)은 시트가 정상이라 그대로 두고, 실패한 적이 있으면 그때부터 저장으로
    if (isSamsung && (window.innerWidth >= 600 || shareFailedOnce)) {
      busy = false; await save(); setStatus('이 화면에선 공유 시트가 불안정해 저장으로 대신합니다. 갤러리에서 카톡·인스타에 올리세요.'); return;
    }
    try {
      // 미리 만들어 둔 PNG 가 있으면 await 없이 바로 시트를 연다 (사용자 제스처 안에서)
      const blob = readyBlob || await toBlob();
      const file = new File([blob], fileName(), { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '나의 정치 성향 · 당말사' });
        setStatus('');
        return;
      }
      busy = false;
      await save();   // 시스템 공유 시트가 없으면 저장으로
    } catch (e) {
      shareFailedOnce = true;
      if (e && e.name === 'AbortError') { if (isSamsung) setStatus('공유 시트가 닫혔어요. 다시 누르면 이미지 저장으로 안내합니다.'); return; }
      if (e && e.name === 'NotAllowedError') { setStatus('브라우저가 공유를 막았습니다. 이미지 저장을 이용하세요.'); return; }
      setStatus('공유에 실패했습니다. 이미지 저장을 이용하세요.');
    } finally { setTimeout(() => { busy = false; }, 800); }
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

  // ── 실험 모드 (?debug=1): 삼성 인터넷 펼친 화면에서 어떤 공유 형태가 정상인지 기기에서 직접 확인하기 위한 변형들 ──
  if (new URLSearchParams(location.search).get('debug') === '1') {
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:6px;font-size:12px';
    const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sc-btn secondary'; b.textContent = label; b.addEventListener('click', fn); box.appendChild(b); return b; };
    const say = (m) => setStatus('[실험] ' + m);
    const withFile = (type, ext) => new Promise(res => canvas.toBlob(b => res(new File([b], `card.${ext}`, { type })), type, 0.92));
    mk('실험 A · PNG 파일만 (title 없음)', async () => { const f = await withFile('image/png', 'png'); try { await navigator.share({ files: [f] }); say('A 완료'); } catch (e) { say('A 실패 ' + e.name); } });
    mk('실험 B · JPEG 파일 + 제목', async () => { const f = await withFile('image/jpeg', 'jpg'); try { await navigator.share({ files: [f], title: '당말사' }); say('B 완료'); } catch (e) { say('B 실패 ' + e.name); } });
    mk('실험 C · 파일 + 링크 텍스트', async () => { const f = await withFile('image/png', 'png'); try { await navigator.share({ files: [f], text: `${D.siteHost}/balance-game` }); say('C 완료'); } catch (e) { say('C 실패 ' + e.name); } });
    mk('실험 D · 미리 만든 PNG, 지연 0 (현재 방식)', () => { if (!readyBlob) { say('아직 준비 안 됨'); return; } const f = new File([readyBlob], 'card.png', { type: 'image/png' }); navigator.share({ files: [f], title: '당말사' }).then(() => say('D 완료')).catch(e => say('D 실패 ' + e.name)); });
    mk('실험 E · 링크만 (브리핑과 같은 방식)', () => { navigator.share({ title: '당말사', url: `https://${D.siteHost}/balance-game` }).then(() => say('E 완료')).catch(e => say('E 실패 ' + e.name)); });
    (shareBtn ? shareBtn.parentNode : document.body).insertBefore(box, shareBtn ? shareBtn.nextSibling : null);
    say('debug 모드 — 폴드 펼친 상태에서 A~E 눌러보고 어느 게 정상인지 알려주세요');
  }

  modeBtns.forEach(b => b.addEventListener('click', () => { mode = b.dataset.scMode; render(); }));
  themeBtns.forEach(b => b.addEventListener('click', () => { theme = b.dataset.scTheme; render(); }));
  layoutBtns.forEach(b => b.addEventListener('click', () => { layout = b.dataset.scLayout; render(); }));
  saveBtn?.addEventListener('click', () => { if (ready) save(); });
  shareBtn?.addEventListener('click', () => { if (ready) share(); });

  // 폰트 전 1차 렌더(빈 화면 방지) → 폰트 후 재렌더
  render();
  loadFonts().then(() => { render(); ready = true; wrapEl.classList.add('is-ready'); setStatus(''); });
  // 시스템 공유 시트가 없는 환경(대부분 데스크톱)은 공유 버튼을 숨긴다 — 저장이 곧 공유다
  if (!(navigator.share && navigator.canShare)) shareBtn?.setAttribute('hidden', '');
})();
