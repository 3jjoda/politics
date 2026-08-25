/* public/scripts/cardShot.js — 카드 미리보기에서 PNG 를 **브라우저에서 바로** 받는다 (2026-08-22)
 *
 * 왜: 이미지를 얻는 길이 `npm run insta`(로컬 · 크롬 실행 파일 필요) 와
 *     DevTools 의 `Capture node screenshot`(F12 → Elements → 우클릭) 둘뿐이었다.
 *     둘 다 폰에서는 불가능하고, 매일 하는 일에 마찰이 크면 그 일은 곧 안 하게 된다.
 *
 * 🔴 캡처 방식 — **SVG `<foreignObject>` 에 카드를 통째로 넣어 브라우저가 그리게 한다.**
 *    의존성 0 (html2canvas·puppeteer 없음), 서버에 크롬을 올리지 않아도 되고,
 *    무엇보다 **미리보기와 산출물이 같은 DOM·같은 CSS** 라 "미리보기는 멀쩡한데 저장한 게 깨지는" 일이 없다.
 *
 * 🔴 SVG 이미지 안에서는 **외부 리소스를 못 받는다** (폰트·이미지 fetch 가 아예 일어나지 않는다).
 *    그래서 그리기 전에 두 가지를 직접 심는다:
 *      ① 웹폰트 — Google Fonts `css2?...&text=` 로 **카드에 실제로 쓰인 글자만** 받아 base64 로 인라인.
 *         한글 전체를 받으면 수 MB 지만 이 방식은 파일 3개 · 수 KB 다 (Noto 는 가변폰트라 굵기별로 안 나뉜다).
 *         안 심으면 조용히 시스템 폰트(바탕체 등)로 폴백해 **눈으로만 이상한** PNG 가 나간다.
 *      ② 브랜드 SVG(마크·워드마크·태그라인) — 같은 출처라 fetch 해서 data URI 로.
 *
 * ⚠️ 캡처는 **미리보기 모드에서만** 로드한다 (`?slide=N`·`?story=1` 에는 넣지 않는다).
 *    그쪽은 문서 자체가 캔버스라 버튼 하나만 끼어도 배치(genInstaCards)의 PNG 가 오염된다.
 * ⚠️ 미리보기 전용 요소(스티커 자리 안내선 등)에는 `data-shot-omit` 을 달 것 — 클론에서 제거한다.
 *    `body.story .sl-sticker-hint { display:none }` 같은 **조상 선택자는 클론 안에서 안 먹는다** (조상이 없다).
 */
(() => {
  'use strict';

  const W = 1080;
  // 카드 텍스트 밖에서 쓰일 수 있는 글자 최소 세트 (혹시 innerText 에 안 잡히는 게 있어도 깨지지 않게)
  const BASE_CHARS = 'dangmalsa.kr0123456789 ·-~%()건명일월화수목금토';

  const cache = { font: new Map(), img: new Map() };

  const bytesToB64 = (buf) => {
    const a = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  };

  /* 폰트 CSS — 카드가 들어 있는 문서가 이미 걸어둔 <link> 를 재료로 쓴다.
     뷰에서 폰트를 바꾸면 여기도 자동으로 따라가게 하려는 것 (목록을 두 곳에 적지 않는다).
     ⚠️ `doc` 은 최상위 문서일 수도, 카드를 담은 **같은 출처 iframe** 의 문서일 수도 있다
        (쓰레드 페이지가 표지 한 장을 iframe 으로 물어온다). 어느 쪽이든 그 문서에서만 재료를 모은다 */
  function fontCss(doc) {
    const link = [...doc.querySelectorAll('link[rel="stylesheet"]')]
      .find((l) => /fonts\.googleapis\.com\/css2/.test(l.href));
    if (!link) return Promise.resolve('');
    const text = [...doc.querySelectorAll('.sl')].map((n) => n.innerText).join('') + BASE_CHARS;
    const chars = [...new Set([...text])].filter((c) => c.trim()).sort().join('');
    const url = link.href.replace(/&display=[^&]*/, '') + '&text=' + encodeURIComponent(chars);
    if (cache.font.has(url)) return cache.font.get(url);
    const job = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('웹폰트를 받지 못했습니다 (' + res.status + ')');
      let css = await res.text();
      const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
      for (const u of urls) {
        const buf = await (await fetch(u)).arrayBuffer();
        css = css.split(u).join('data:font/woff2;base64,' + bytesToB64(buf));
      }
      return css;
    })().catch((e) => { cache.font.delete(url); throw e; });
    cache.font.set(url, job);
    return job;
  }

  /* 같은 출처 SVG 를 data URI 로 — 외부 참조가 하나라도 남으면 그 자리가 빈 채로 찍힌다 */
  async function inlineImages(root) {
    for (const img of root.querySelectorAll('img')) {
      const src = img.getAttribute('src');
      if (!src || /^data:/.test(src)) continue;
      if (!cache.img.has(src)) {
        cache.img.set(src, fetch(src).then(async (r) => {
          const type = (r.headers.get('content-type') || '').split(';')[0] || 'image/svg+xml';
          return type.includes('svg')
            ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(await r.text())
            : 'data:' + type + ';base64,' + bytesToB64(await r.arrayBuffer());
        }));
      }
      img.setAttribute('src', await cache.img.get(src));
    }
  }

  async function toCanvas(node) {
    const doc = node.ownerDocument;            // iframe 안의 카드도 그대로 받는다 (같은 출처)
    const H = node.classList.contains('is-story') ? 1920 : 1350;
    const fcss = await fontCss(doc);

    const clone = node.cloneNode(true);
    clone.querySelectorAll('[data-shot-omit]').forEach((el) => el.remove());
    clone.style.transform = 'none';   // 미리보기는 scale(.35) 로 줄여 보여준다 — 산출물은 1:1
    clone.style.margin = '0';
    await inlineImages(clone);

    const pageCss = [...doc.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    const body = new XMLSerializer().serializeToString(clone);
    // CSS 는 CDATA 로 감싼다 — SVG 는 XML 이라 `<`·`&` 가 파싱 에러가 된다
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<foreignObject x="0" y="0" width="${W}" height="${H}">` +
      `<div xmlns="http://www.w3.org/1999/xhtml">` +
      `<style>/*<![CDATA[*/${fcss}\n${pageCss}/*]]>*/</style>${body}</div>` +
      `</foreignObject></svg>`;

    const img = new Image();   // 최상위 문서에서 만든다 — 그려 넣을 canvas 도 여기 있다
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error('이 브라우저가 카드를 그리지 못했습니다'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;     // 🔴 기기 배율을 곱하지 말 것 — 규격이 정확히 1080 이어야 한다
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getComputedStyle(node).backgroundColor || '#F7F6F1';
    ctx.fillRect(0, 0, W, H);                // SVG 밖 여백이 투명 PNG 로 나가지 않게
    ctx.drawImage(img, 0, 0, W, H);

    // 🔴 빈 그림을 조용히 저장하지 않는다 — foreignObject 지원이 부실한 브라우저는
    //    에러 없이 **하얀 PNG** 를 돌려준다. 정상 카드는 3% 이상이 배경색과 다르다 (실측 3.6~8.4% · 빈 카드 0%)
    // ⚠️ 1/10 로 줄인 사본에서 잰다 — 원본에 getImageData 를 걸면 GPU 읽기를 반복하게 된다
    const small = document.createElement('canvas');
    small.width = W / 10; small.height = H / 10;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(canvas, 0, 0, small.width, small.height);
    const d = sctx.getImageData(0, 0, small.width, small.height).data;
    let ink = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 247) > 10 || Math.abs(d[i + 2] - 241) > 10) ink++;
    if (ink / (d.length / 4) < 0.01) throw new Error('카드가 비어 있게 그려졌습니다');

    return canvas;
  }

  const toBlob = (canvas) => new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG 변환에 실패했습니다'))), 'image/png'));

  let busy = false;   // 재진입 차단 (shareCard.js 와 같은 이유 — 시트가 열렸다 닫혔다 반복하는 것 방지)

  // 폰·태블릿에서만 공유 시트를 쓴다. 맥 사파리·크롬도 navigator.share 를 갖고 있어서
  // 그대로 두면 **데스크톱에서 8장을 받을 때마다 시트가 뜬다** (다운로드가 맞는 자리다)
  const isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches;

  // files 가 비면 "공유 시트가 있는가" 만 본다 (빈 배열로 canShare 를 물으면 false 를 주는 브라우저가 있다)
  const canShareFiles = (files) =>
    !!(navigator.share && navigator.canShare && (!files.length || navigator.canShare({ files })));

  function download(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    a.setAttribute('data-no-loader', '');   // 페이지 전환 로더가 이 클릭을 내부 이동으로 오인하지 않게
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const toFile = async (node, name) =>
    new File([await toBlob(await toCanvas(node))], name, { type: 'image/png' });

  /* 카드 여러 장 → File[] (`onStep(i, total)` 로 진행 표시).
     🔴 모바일에서 여러 장이 필요한 이유는 아래 `shareFiles` 주석 참조 */
  async function toFiles(items, onStep) {
    const out = [];
    for (let i = 0; i < items.length; i++) {
      if (onStep) onStep(i, items.length);
      out.push(await toFile(items[i].node, items[i].name));
    }
    return out;
  }

  /* 🔴 준비된 File[] 를 **한 번의 시트로** 넘긴다.
     모바일 브라우저는 프로그래매틱 다운로드를 **사용자 제스처당 한 개만** 허용해서,
     `a.download` 를 연달아 부르면 첫 장만 저장되고 나머지는 조용히 버려진다 (2026-08-22 실기기 보고).
     ⚠️ 이 함수를 부르기 **전에 await 를 두지 말 것** — 모바일은 제스처 안에서만 share 를 허용하고
        await 뒤에는 그 권한이 사라진다. 그래서 파일은 앞선 탭에서 미리 만들어 둔다 (shareCard.js 와 같은 수법) */
  async function shareFiles(files, text) {
    try { await navigator.share({ files, text }); return true; }
    catch (e) { if (e && e.name === 'AbortError') return false; throw e; }   // 시트를 닫은 것은 에러가 아니다
  }

  async function save(node, name, opt = {}) {
    if (busy) return false;
    busy = true;
    try {
      const file = await toFile(node, name);
      const wantShare = opt.share !== undefined ? opt.share : isTouch;
      if (wantShare && canShareFiles([file])) {
        try { await navigator.share({ files: [file], text: name }); return true; }
        catch (e) { if (e && e.name === 'AbortError') return false; }
      }
      download(file);
      return true;
    } finally { setTimeout(() => { busy = false; }, 350); }
  }

  /* 같은 출처 iframe 안의 카드 노드를 꺼낸다 (로드가 끝날 때까지 기다린다).
     쓰레드 페이지가 표지 한 장(`/card?slide=1`)을 iframe 으로 물어와 쓴다 —
     카드 마크업·CSS 를 그 페이지에 **복사하지 않기 위해서**다 (복사하면 두 곳이 갈린다) */
  function frameCard(iframe) {
    const pick = () => {
      const el = iframe.contentDocument && iframe.contentDocument.querySelector('.sl');
      if (!el) throw new Error('표지 카드를 불러오지 못했습니다');
      return el;
    };
    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') return Promise.resolve(pick());
    return new Promise((res, rej) => {
      iframe.addEventListener('load', () => { try { res(pick()); } catch (e) { rej(e); } }, { once: true });
      iframe.addEventListener('error', () => rej(new Error('표지 카드를 불러오지 못했습니다')), { once: true });
    });
  }

  window.PBCard = { toCanvas, save, frameCard, toFiles, canShareFiles, shareFiles, download, isTouch };
})();
