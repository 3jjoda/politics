/**
 * 정치 바로미터 공용 JS 헬퍼
 *   - window.__USER__ : 서버에서 주입 ({id, nickname} | null)
 *   - PB.fetch        : JSON + credentials 래핑
 *   - PB.escapeHtml
 *   - PB.renderStars  : 별점 SVG 문자열
 *   - PB.initials     : 이니셜 아바타 HTML (클라이언트용 fallback)
 *   - PB.timeAgo      : "N분 전" 포맷
 *   - PB.mountRating  : 의원 별점 위젯
 *   - PB.mountComments: 댓글 목록 + 작성 위젯
 *   - PB.mountCitizenVote : 법안 국민 찬반 위젯
 *   - PB.mountBillAnalysis : 법안 AI 분석 5-Zone 위젯
 *   - PB.redirectToLogin : 로그인 유도
 */
(function () {
  const PB = {};

  const isLoggedIn = () => !!(window.__USER__ && window.__USER__.id);

  PB.isLoggedIn = isLoggedIn;
  PB.currentUser = () => window.__USER__ || null;

  PB.redirectToLogin = () => {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = `/auth/login?next=${next}`;
  };

  PB.fetch = async (path, opts = {}) => {
    const res = await fetch(path, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers || {})
      },
      ...opts
    });
    if (res.status === 401) {
      // 401: 로그인 필요
      const err = new Error('로그인이 필요합니다.');
      err.status = 401;
      throw err;
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  PB.escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ===================================================================
     공용 스피너 — /assets/imgs/spinner.svg 기반
       PB.spinner({ size, label }) → HTML 문자열 (컨테이너 innerHTML 에 그대로 사용)
       PB.spinner.overlay({ label })  → 부모에 absolute 로 깔리는 오버레이 HTML
  =================================================================== */
  PB.spinner = (opts = {}) => {
    const size  = opts.size  || 36;
    const label = opts.label || '불러오는 중…';
    return `<div class="pb-spinner" role="status" aria-live="polite">
      <img src="/assets/imgs/spinner.svg" width="${size}" height="${size}" alt="" aria-hidden="true">
      <span class="pb-spinner-label">${PB.escapeHtml(label)}</span>
    </div>`;
  };
  PB.spinner.overlay = (opts = {}) => {
    const size  = opts.size  || 36;
    const label = opts.label || '불러오는 중…';
    return `<div class="pb-spinner-overlay" role="status" aria-live="polite">
      <img src="/assets/imgs/spinner.svg" width="${size}" height="${size}" alt="" aria-hidden="true">
      <span class="pb-spinner-label">${PB.escapeHtml(label)}</span>
    </div>`;
  };

  /* ===================================================================
     한글 초성 검색
       - PB.toChoseong('김철수')       → 'ㄱㅊㅅ'
       - PB.matchesQuery('김철수','ㄱㅊ') → true  (초성 부분일치)
       - PB.matchesQuery('김철수','김')  → true  (직접 부분일치)
       - query가 compat-jamo 자음만일 때 초성 매칭, 그 외는 일반 substring
  =================================================================== */
  const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const CHOSEONG_SET = new Set(CHOSEONG);
  PB.toChoseong = (str) => {
    if (!str) return '';
    let out = '';
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const code = s.charCodeAt(i);
      if (code >= 0xAC00 && code <= 0xD7A3) {
        out += CHOSEONG[Math.floor((code - 0xAC00) / 588)];
      } else {
        out += ch;
      }
    }
    return out;
  };
  PB.isChoseongOnly = (q) => {
    if (!q) return false;
    for (let i = 0; i < q.length; i++) {
      if (!CHOSEONG_SET.has(q[i])) return false;
    }
    return true;
  };
  PB.matchesQuery = (target, query) => {
    const q = String(query || '').trim();
    if (!q) return true;
    if (target == null) return false;
    const t = String(target);
    if (t.toLowerCase().includes(q.toLowerCase())) return true;
    if (PB.isChoseongOnly(q)) return PB.toChoseong(t).includes(q);
    return false;
  };

  PB.renderStars = (score, { size = 16, interactive = false } = {}) => {
    const s = Math.max(0, Math.min(5, Number(score) || 0));
    let html = `<span class="pb-stars" data-score="${s}" style="font-size:${size}px">`;
    for (let i = 1; i <= 5; i++) {
      const cls = i <= s ? 'pb-star filled' : 'pb-star empty';
      html += `<span class="${cls}" data-val="${i}" ${interactive ? 'role="button" tabindex="0"' : ''}>★</span>`;
    }
    html += '</span>';
    return html;
  };

  PB.initials = (name) => {
    if (!name) return '?';
    const hasKr = /[가-힣]/.test(name);
    if (hasKr) return name.trim().charAt(0);
    const parts = name.trim().split(/\s+/);
    return parts.length === 1 ? parts[0].charAt(0).toUpperCase() : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const AVATAR_PALETTE = [
    { bg: '#DBE3F0', fg: '#1E3A5F' }, { bg: '#E5DBF0', fg: '#4A2A6B' },
    { bg: '#D8EBE0', fg: '#2A5F42' }, { bg: '#F0E3D0', fg: '#6B4A1F' },
    { bg: '#F0D8DF', fg: '#6B2A40' }, { bg: '#E6F0D4', fg: '#4F6B22' },
    { bg: '#D4EBEF', fg: '#1F5962' }, { bg: '#E8DEF0', fg: '#5A2F6B' }
  ];
  const hashCode = (s) => {
    let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  };
  PB.avatarSvg = (name, size = 32) => {
    const c = AVATAR_PALETTE[hashCode(name || '') % AVATAR_PALETTE.length];
    const fs = Math.floor(size * 0.42);
    return `<svg width="100%" height="100%" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="display:block">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${c.bg}"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="Noto Sans KR,sans-serif" font-size="${fs}" font-weight="700" fill="${c.fg}">${PB.escapeHtml(PB.initials(name))}</text>
    </svg>`;
  };

  PB.timeAgo = (isoLike) => {
    if (!isoLike) return '';
    // 서버 포맷 'YYYY-MM-DD HH:mm' 을 Date 로 변환.
    // 이 문자열은 DB 가 AT TIME ZONE 'Asia/Seoul' 로 만든 KST 벽시계라 오프셋이 없다.
    // 그냥 파싱하면 "브라우저 로컬 시간"으로 해석돼 해외 접속자에게 시간이 어긋난다.
    let safe = isoLike.replace(' ', 'T');
    if (!/(Z|[+-]\d{2}:?\d{2})$/.test(safe)) {
      if (safe.length === 16) safe += ':00';      // YYYY-MM-DDTHH:mm
      safe += '+09:00';
    }
    const t = new Date(safe);
    if (isNaN(t)) return isoLike;
    const diff = (Date.now() - t.getTime()) / 1000;
    if (diff < 60)    return '방금 전';
    if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
    return isoLike.replace('T', ' ').slice(0, 10);
  };

  /* ===================================================================
     별점 위젯 — 의원 상세
     옵션: { containerId, monaCd, summaryId? }
     컨테이너 구조:
       <div id="..." data-rate-widget></div>
  =================================================================== */
  PB.mountRating = async (opts) => {
    const root = document.getElementById(opts.containerId);
    if (!root) return;
    const monaCd = opts.monaCd;

    const render = (data) => {
      const avg = data.avg || 0;
      const total = data.total || 0;
      const dist = data.distribution || {};
      const my = data.myScore;
      const maxDist = Math.max(1, ...Object.values(dist).map(Number));
      root.innerHTML = `
        <div class="eval-summary">
          <div class="eval-score-wrap">
            <div class="eval-score">${total > 0 ? avg.toFixed(1) : '—'}</div>
            ${PB.renderStars(Math.round(avg), { size: 18 })}
            <div class="eval-score-label">${total > 0 ? `${total}명 평가` : '아직 평가 없음'}</div>
          </div>
          <div class="eval-dist">
            ${[5,4,3,2,1].map(n => {
              const c = Number(dist[n] || 0);
              const w = total > 0 ? (c / total * 100).toFixed(0) : 0;
              return `
                <div class="eval-dist-item">
                  <span class="eval-dist-label">${n} <span>★</span></span>
                  <div class="eval-dist-bar-wrap"><div class="eval-dist-bar" style="width:${w}%"></div></div>
                  <span class="eval-dist-count">${c}</span>
                </div>`;
            }).join('')}
          </div>
        </div>
        <div class="my-rating">
          <span class="my-rating-label">내 평점:</span>
          <span class="my-rating-stars" data-my-stars>
            ${PB.renderStars(my || 0, { size: 22, interactive: true })}
          </span>
          <span class="my-rating-hint" data-my-hint>
            ${!isLoggedIn() ? '로그인 후 평가할 수 있습니다'
              : my ? `현재 ${my}점 — 다시 클릭하면 변경됩니다`
              : '별을 눌러 1~5점을 남겨보세요'}
          </span>
        </div>
      `;
      // 클릭 바인딩
      if (isLoggedIn()) {
        root.querySelectorAll('[data-my-stars] .pb-star').forEach(star => {
          star.addEventListener('click', async () => {
            const score = Number(star.dataset.val);
            try {
              await PB.fetch(`/api/ratings/politician/${monaCd}`, {
                method: 'POST',
                body: JSON.stringify({ score })
              });
              PB.mountRating(opts); // 새로고침
            } catch (err) {
              if (err.status === 401) return PB.redirectToLogin();
              alert('평가 저장 실패: ' + err.message);
            }
          });
        });
      } else {
        root.querySelectorAll('[data-my-stars] .pb-star').forEach(star => {
          star.addEventListener('click', () => PB.redirectToLogin());
        });
      }
    };

    root.innerHTML = PB.spinner();
    try {
      const data = await PB.fetch(`/api/ratings/politician/${monaCd}`);
      render(data);
    } catch (err) {
      root.innerHTML = `<div class="pb-muted">평가 데이터를 불러올 수 없습니다: ${PB.escapeHtml(err.message)}</div>`;
    }
  };

  /* ===================================================================
     댓글 위젯 — type/targetId 기반 (대댓글 1-레벨 중첩 지원)
     옵션: { containerId, type, targetId, title? }
  =================================================================== */
  PB.mountComments = async (opts) => {
    const root = document.getElementById(opts.containerId);
    if (!root) return;
    const { type, targetId } = opts;
    const state = { items: [], sort: 'new', likes: {} };

    const refreshLikes = async (items) => {
      const results = await Promise.all(items.map(c =>
        PB.fetch(`/api/likes?type=comment&targetId=${c.id}`).catch(() => ({ count: 0, liked: false }))
      ));
      const map = {};
      items.forEach((c, i) => { map[c.id] = results[i]; });
      state.likes = map;
    };

    // 1-레벨 트리 — 답글에 대한 답글도 최상위 parent 아래로 플랫화
    const buildTree = (items) => {
      const byId = new Map(items.map(c => [c.id, { ...c, replies: [] }]));
      const roots = [];
      byId.forEach(c => {
        if (c.parent_id == null) {
          roots.push(c);
        } else {
          // parent_id 가 답글이면 그 답글의 root 로 올라간다
          let p = byId.get(c.parent_id);
          while (p && p.parent_id != null) p = byId.get(p.parent_id);
          if (p) p.replies.push(c);
          else roots.push(c); // 부모 없음 (edge case) — 루트로
        }
      });
      byId.forEach(c => c.replies.sort((a, b) => a.id - b.id));
      return roots;
    };

    const sortRoots = (roots) => {
      const copy = [...roots];
      if (state.sort === 'new') copy.sort((a, b) => b.id - a.id);
      else if (state.sort === 'like') copy.sort((a, b) => (state.likes[b.id]?.count || 0) - (state.likes[a.id]?.count || 0));
      return copy;
    };

    const render = () => {
      const user = PB.currentUser();
      const myId = user ? user.id : null;
      const tree = buildTree(state.items);

      // 삭제된 최상위 — 살아있는 답글이 있으면 tombstone 유지, 없으면 숨김
      const visibleRoots = tree
        .map(c => ({ ...c, replies: c.replies.filter(r => !r.is_deleted) }))
        .filter(c => !c.is_deleted || c.replies.length > 0);

      const sorted = sortRoots(visibleRoots);
      const totalCount = visibleRoots.reduce((s, c) => s + (c.is_deleted ? 0 : 1) + c.replies.length, 0);

      root.innerHTML = `
        <div class="comment-write">
          ${user ? `
            <div class="comment-write-top">
              <div class="write-avatar">${PB.avatarSvg(user.nickname, 32)}</div>
              <span class="write-hint">${PB.escapeHtml(user.nickname)} · 평가 댓글</span>
            </div>
            <textarea class="write-input" data-comment-input
              placeholder="자유롭게 의견을 남겨주세요. 허위 사실·욕설·개인정보는 삭제될 수 있습니다."></textarea>
            <div class="write-footer">
              <span class="write-hint"><span data-count>0</span> / 2000</span>
              <button class="write-submit" data-submit>댓글 작성</button>
            </div>
          ` : `
            <div class="comment-login-cta">
              <span>댓글을 작성하려면 로그인하세요.</span>
              <a class="write-submit" href="/auth/login?next=${encodeURIComponent(location.pathname)}">로그인</a>
            </div>
          `}
        </div>

        <div class="comment-sort" data-sort-bar>
          <span>정렬:</span>
          <button class="sort-btn ${state.sort === 'like' ? 'active' : ''}" data-sort-key="like">추천순</button>
          <button class="sort-btn ${state.sort === 'new' ? 'active' : ''}" data-sort-key="new">최신순</button>
          <span class="sort-count">총 ${totalCount}개</span>
        </div>

        <div class="comments">
          ${sorted.length === 0
            ? `<div class="comments-empty">아직 등록된 댓글이 없습니다. 첫 댓글을 남겨보세요.</div>`
            : sorted.map(c => renderThread(c, myId)).join('')}
        </div>
      `;

      bindEvents();
    };

    const renderThread = (c, myId) => `
      <div class="comments-thread">
        ${renderCard(c, myId, false)}
        ${c.replies.length ? `
          <div class="comment-replies">
            ${c.replies.map(r => renderCard(r, myId, true)).join('')}
          </div>
        ` : ''}
      </div>
    `;

    const renderCard = (c, myId, isReply) => {
      if (c.is_deleted) {
        return `
          <div class="comment-card comment-card-tombstone" data-cid="${c.id}">
            <div class="comment-body">삭제된 댓글입니다.</div>
          </div>`;
      }
      const liked = state.likes[c.id]?.liked;
      const likeCnt = state.likes[c.id]?.count || 0;
      const mine = myId && c.user_id === myId;
      const isDeletedUser = !c.nickname;
      const displayName = isDeletedUser ? '탈퇴한 사용자' : c.nickname;
      const avatarSeed  = isDeletedUser ? '탈퇴' : c.nickname;
      return `
        <div class="comment-card ${isDeletedUser ? 'comment-card-deleted' : ''}" data-cid="${c.id}">
          <div class="comment-header">
            <div class="comment-avatar">${PB.avatarSvg(avatarSeed, isReply ? 28 : 32)}</div>
            <div class="comment-meta">
              <div class="comment-nickname">${PB.escapeHtml(displayName)}</div>
              <div class="comment-date">${PB.escapeHtml(c.created_at)}${c.updated_at && c.updated_at !== c.created_at ? ' · 수정됨' : ''}</div>
            </div>
          </div>
          <div class="comment-body" data-body>${PB.escapeHtml(c.content).replace(/\n/g, '<br>')}</div>
          <div class="comment-footer">
            <span class="comment-action ${liked ? 'liked' : ''}" data-like>
              👍 도움돼요 <strong data-like-count>${likeCnt}</strong>
            </span>
            ${!isReply ? `<span class="comment-action" data-reply>↩ 답글</span>` : ''}
            ${mine && !isDeletedUser ? `
              <span class="comment-action" data-edit>✎ 수정</span>
              <span class="comment-action" data-delete>🗑 삭제</span>
            ` : ''}
          </div>
          ${!isReply ? `<div class="comment-reply-form" data-reply-form style="display:none"></div>` : ''}
        </div>`;
    };

    const bindEvents = () => {
      // 글자수 카운트
      const input = root.querySelector('[data-comment-input]');
      const cnt = root.querySelector('[data-count]');
      if (input && cnt) {
        input.addEventListener('input', () => { cnt.textContent = input.value.length; });
      }

      // 작성 (최상위)
      const submitBtn = root.querySelector('[data-submit]');
      if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
          const content = input.value.trim();
          if (!content) return alert('내용을 입력하세요.');
          submitBtn.disabled = true;
          try {
            await PB.fetch('/api/comments', {
              method: 'POST',
              body: JSON.stringify({ type, targetId, content })
            });
            input.value = '';
            await load();
          } catch (err) {
            if (err.status === 401) return PB.redirectToLogin();
            alert('작성 실패: ' + err.message);
          } finally {
            submitBtn.disabled = false;
          }
        });
      }

      // 정렬
      root.querySelectorAll('[data-sort-key]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.sort = btn.dataset.sortKey;
          render();
        });
      });

      // 카드 이벤트
      root.querySelectorAll('.comment-card').forEach(card => {
        const cid = Number(card.dataset.cid);
        if (!cid) return;

        card.querySelector('[data-like]')?.addEventListener('click', async () => {
          if (!isLoggedIn()) return PB.redirectToLogin();
          try {
            const r = await PB.fetch('/api/likes', {
              method: 'POST',
              body: JSON.stringify({ type: 'comment', targetId: cid })
            });
            state.likes[cid] = { count: r.count, liked: r.liked };
            render();
          } catch (err) {
            if (err.status === 401) return PB.redirectToLogin();
            alert('좋아요 실패: ' + err.message);
          }
        });

        // 답글 토글 (최상위 댓글만)
        card.querySelector('[data-reply]')?.addEventListener('click', () => {
          if (!isLoggedIn()) return PB.redirectToLogin();
          const formEl = card.querySelector('[data-reply-form]');
          if (!formEl) return;
          if (formEl.style.display !== 'none') {
            formEl.style.display = 'none';
            formEl.innerHTML = '';
            return;
          }
          formEl.style.display = '';
          formEl.innerHTML = `
            <textarea class="write-input" data-reply-input placeholder="답글을 남겨주세요"></textarea>
            <div class="comment-reply-actions">
              <button class="sort-btn" data-reply-cancel>취소</button>
              <button class="write-submit" data-reply-save style="padding:6px 14px;font-size:13px">답글 등록</button>
            </div>`;
          formEl.querySelector('[data-reply-input]').focus();
          formEl.querySelector('[data-reply-cancel]').addEventListener('click', () => {
            formEl.style.display = 'none';
            formEl.innerHTML = '';
          });
          formEl.querySelector('[data-reply-save]').addEventListener('click', async () => {
            const content = formEl.querySelector('[data-reply-input]').value.trim();
            if (!content) return alert('내용을 입력하세요.');
            try {
              await PB.fetch('/api/comments', {
                method: 'POST',
                body: JSON.stringify({ type, targetId, parentId: cid, content })
              });
              await load();
            } catch (err) {
              if (err.status === 401) return PB.redirectToLogin();
              alert('답글 실패: ' + err.message);
            }
          });
        });

        card.querySelector('[data-edit]')?.addEventListener('click', () => {
          const comment = state.items.find(x => x.id === cid);
          if (!comment) return;
          const body = card.querySelector('[data-body]');
          body.innerHTML = `
            <textarea class="write-input" data-edit-input style="min-height:80px">${PB.escapeHtml(comment.content)}</textarea>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="sort-btn" data-edit-cancel>취소</button>
              <button class="write-submit" data-edit-save style="padding:6px 14px;font-size:13px">저장</button>
            </div>`;
          body.querySelector('[data-edit-cancel]').addEventListener('click', () => render());
          body.querySelector('[data-edit-save]').addEventListener('click', async () => {
            const newContent = body.querySelector('[data-edit-input]').value.trim();
            if (!newContent) return;
            try {
              await PB.fetch(`/api/comments/${cid}`, {
                method: 'PUT',
                body: JSON.stringify({ content: newContent })
              });
              await load();
            } catch (err) {
              alert('수정 실패: ' + err.message);
            }
          });
        });

        card.querySelector('[data-delete]')?.addEventListener('click', async () => {
          if (!confirm('댓글을 삭제하시겠습니까?')) return;
          try {
            await PB.fetch(`/api/comments/${cid}`, { method: 'DELETE' });
            await load();
          } catch (err) {
            alert('삭제 실패: ' + err.message);
          }
        });
      });
    };

    const load = async () => {
      root.innerHTML = PB.spinner({ label: '댓글 불러오는 중…' });
      try {
        const { items } = await PB.fetch(`/api/comments?type=${encodeURIComponent(type)}&targetId=${encodeURIComponent(targetId)}`);
        // 삭제된 댓글도 보관 (tombstone 처리용). 좋아요는 살아있는 것만.
        state.items = items;
        await refreshLikes(items.filter(c => !c.is_deleted));
        render();
      } catch (err) {
        root.innerHTML = `<div class="pb-muted">댓글을 불러올 수 없습니다: ${PB.escapeHtml(err.message)}</div>`;
      }
    };

    load();
  };

  /* ===================================================================
     법안 국민 찬반 위젯
  =================================================================== */
  PB.mountCitizenVote = async (opts) => {
    const root = document.getElementById(opts.containerId);
    if (!root) return;
    const { billId } = opts;

    const render = (data) => {
      const agree = data.agree || 0, disagree = data.disagree || 0, total = data.total || 0;
      const agreeRate = data.agreeRate || 0;
      const disagreeRate = total > 0 ? 100 - agreeRate : 0;
      const my = data.myVote;
      root.innerHTML = `
        <div class="cv-bar">
          <div class="cv-seg cv-agree"    style="width:${total > 0 ? agreeRate : 50}%">
            ${agreeRate >= 10 ? `<span>${agreeRate.toFixed(0)}%</span>` : ''}
          </div>
          <div class="cv-seg cv-disagree" style="width:${total > 0 ? disagreeRate : 50}%">
            ${disagreeRate >= 10 ? `<span>${disagreeRate.toFixed(0)}%</span>` : ''}
          </div>
        </div>
        <div class="cv-legend">
          <div class="cv-legend-item">
            <span class="cv-dot cv-dot-agree"></span>찬성 <strong>${agree}</strong>명
          </div>
          <div class="cv-legend-item">
            <span class="cv-dot cv-dot-disagree"></span>반대 <strong>${disagree}</strong>명
          </div>
          <div class="cv-total">총 <strong>${total}</strong>명 참여</div>
        </div>
        <div class="cv-actions">
          <button class="cv-btn cv-btn-agree    ${my === 'agree'    ? 'active' : ''}" data-vote="agree">찬성</button>
          <button class="cv-btn cv-btn-disagree ${my === 'disagree' ? 'active' : ''}" data-vote="disagree">반대</button>
          ${my ? `<span class="cv-my-hint">내 투표: <strong>${my === 'agree' ? '찬성' : '반대'}</strong> (다시 누르면 변경)</span>` : ''}
        </div>
      `;
      root.querySelectorAll('[data-vote]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!isLoggedIn()) return PB.redirectToLogin();
          try {
            await PB.fetch(`/api/votes/bill/${encodeURIComponent(billId)}`, {
              method: 'POST',
              body: JSON.stringify({ vote: btn.dataset.vote })
            });
            const d = await PB.fetch(`/api/votes/bill/${encodeURIComponent(billId)}`);
            render(d);
          } catch (err) {
            if (err.status === 401) return PB.redirectToLogin();
            alert('투표 실패: ' + err.message);
          }
        });
      });
    };

    root.innerHTML = PB.spinner();
    try {
      const d = await PB.fetch(`/api/votes/bill/${encodeURIComponent(billId)}`);
      render(d);
    } catch (err) {
      root.innerHTML = `<div class="pb-muted">국민 찬반을 불러올 수 없습니다: ${PB.escapeHtml(err.message)}</div>`;
    }
  };

  /* ===================================================================
     PB.mountBillAnalysis — 법안 AI 분석 5-Zone 위젯
     opts: { containerId, analysisData, bill, scrollTargetId }
     MVP: Zone 1~4 만 렌더. Zone 5 는 추후 구현.
  =================================================================== */
  // <strong> 태그만 허용한 선별 이스케이프
  const renderRichText = (body) => {
    const escaped = String(body == null ? '' : body)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .replace(/&lt;strong&gt;/g, '<strong>')
      .replace(/&lt;\/strong&gt;/g, '</strong>');
  };

  const ISSUE_LABEL = { pro: '찬성 논리', con: '반대 우려', gap: '법안 빈틈' };

  PB.mountBillAnalysis = (opts) => {
    const root = document.getElementById(opts.containerId);
    if (!root) return;
    const a = opts.analysisData;
    if (!a) { root.style.display = 'none'; return; }

    const bill = opts.bill || {};
    const proposers = Array.isArray(opts.proposers) ? opts.proposers : [];
    const scrollTargetId = opts.scrollTargetId || 'citizen-vote-section';

    const changes = a.changes || {};
    const affected = a.affected || {};
    const issues = Array.isArray(a.issues) ? a.issues : [];
    const questions = Array.isArray(a.judgment_questions) ? a.judgment_questions : [];

    const joinDot = (parts) =>
      parts.filter(Boolean).reduce((acc, p, i) => acc + (i ? '<span class="ba-sep">·</span>' : '') + p, '');

    const fmtDate = (s) => String(s || '').replace(/-/g, '.');

    /* 메타 1줄: #번호 · 위원회 · 결과 */
    const metaIdParts = [];
    if (bill.bill_no)   metaIdParts.push(`<span>#${PB.escapeHtml(bill.bill_no)}</span>`);
    if (bill.committee) metaIdParts.push(`<span>${PB.escapeHtml(bill.committee)}</span>`);
    metaIdParts.push(`<span>${PB.escapeHtml(bill.status || '계류')}</span>`);

    /* 메타 2줄: 발의일 — "공동발의 N인" 은 아바타 스택이 그 정보 대체하므로 제거.
       대표발의 한 줄도 스택 라벨에 포함되므로 제거. */
    const metaProposerParts = [];
    if (bill.propose_dt) metaProposerParts.push(`<span>발의일 ${PB.escapeHtml(fmtDate(bill.propose_dt))}</span>`);

    /* 발의자 컴팩트 스택 — 대표 + 9명 까지 표시, 정당 분포 텍스트, 펼침 토글 */
    const buildProposerStack = () => {
      if (!proposers.length) return '';
      const total = proposers.length;
      const reps = proposers.filter(p => p.is_rep);
      const others = proposers.filter(p => !p.is_rep);
      const repPrimary = reps[0] || others[0];

      // 정당 분포 — 카운트 desc, 이름 sort 폴백
      const partyCount = new Map();
      proposers.forEach(p => {
        const k = p.party_name || '무소속';
        partyCount.set(k, (partyCount.get(k) || 0) + 1);
      });
      const partyArr = [...partyCount.entries()].sort((a, b) => b[1] - a[1]);
      let partyText;
      if (partyArr.length === 1) partyText = `모두 ${partyArr[0][0]}`;
      else partyText = partyArr.map(([n, c]) => `${n} ${c}`).join(', ');

      // 라벨: "{대표명} 외 {N}인 · {정당분포}"
      const repName = repPrimary && repPrimary.name ? repPrimary.name : '대표';
      const repHref = repPrimary && repPrimary.mona_cd ? `/politician/${encodeURIComponent(repPrimary.mona_cd)}` : null;
      const repNameHtml = repHref
        ? `<a class="ba-pp-rep-name" href="${repHref}">${PB.escapeHtml(repName)}</a>`
        : `<strong class="ba-pp-rep-name">${PB.escapeHtml(repName)}</strong>`;
      const othersCount = total - 1;
      const labelHtml = `
        ${repNameHtml}${othersCount > 0 ? `<span class="ba-pp-others"> 외 ${othersCount}인</span>` : ''}
        <span class="ba-pp-sep"> · </span>
        <span class="ba-pp-parties">${PB.escapeHtml(partyText)}</span>
      `;

      // 컴팩트 스택 — 대표 1 + 비대표 9 (총 10)
      const stackList = [];
      if (repPrimary) stackList.push(repPrimary);
      others.forEach(o => { if (stackList.length < 10) stackList.push(o); });
      const renderStackItem = (p, isRep) => {
        const titleAttr = `${PB.escapeHtml(p.name || '(퇴임)')}${p.party_name ? ' (' + PB.escapeHtml(p.party_name) + ')' : ''}`;
        const inner = p.photo
          ? `<img src="${PB.escapeHtml(p.photo)}" alt="">`
          : `<span class="ba-pp-stack-initial">${PB.escapeHtml((p.name || '?').slice(0, 1))}</span>`;
        const cls = ['ba-pp-stack-item'];
        if (isRep) cls.push('is-rep');
        if (!p.name) cls.push('is-retired');
        const wrapTag = p.mona_cd ? 'a' : 'span';
        const hrefAttr = p.mona_cd ? ` href="/politician/${encodeURIComponent(p.mona_cd)}"` : '';
        return `<${wrapTag} class="${cls.join(' ')}" title="${titleAttr}"${hrefAttr}>${inner}</${wrapTag}>`;
      };
      const stackHtml = stackList.map((p, i) => renderStackItem(p, i === 0)).join('');

      // 펼친 그리드 카드
      const cardsHtml = proposers.map(p => {
        const cls = ['ba-pp-card'];
        if (p.is_rep) cls.push('is-rep');
        if (!p.name) cls.push('is-retired');
        const inner = p.photo
          ? `<img src="${PB.escapeHtml(p.photo)}" alt="">`
          : `<span class="ba-pp-stack-initial">${PB.escapeHtml((p.name || '?').slice(0, 1))}</span>`;
        const repTag = p.is_rep ? `<span class="ba-pp-card-rep-tag">대표</span>` : '';
        const tag = p.mona_cd ? 'a' : 'div';
        const hrefAttr = p.mona_cd ? ` href="/politician/${encodeURIComponent(p.mona_cd)}"` : '';
        return `
          <${tag} class="${cls.join(' ')}"${hrefAttr}>
            <span class="ba-pp-card-avatar">${inner}</span>
            <div class="ba-pp-card-meta">
              <div class="ba-pp-card-name">${PB.escapeHtml(p.name || '(퇴임)')}${repTag}</div>
              <div class="ba-pp-card-party">${PB.escapeHtml(p.party_name || '—')}</div>
            </div>
          </${tag}>
        `;
      }).join('');

      return `
        <div class="ba-proposers" data-expanded="false">
          <div class="ba-proposers-bar">
            <div class="ba-proposers-stack">${stackHtml}</div>
            <div class="ba-proposers-label">${labelHtml}</div>
            <button type="button" class="ba-pp-toggle" data-action="toggle-proposers">
              <span class="ba-pp-toggle-text">전체 보기</span>
              <span class="ba-pp-toggle-arrow">▾</span>
            </button>
          </div>
          <div class="ba-proposers-grid">${cardsHtml}</div>
        </div>
      `;
    };
    const proposerStackHtml = buildProposerStack();

    /* 카테고리/읽기/결과 텍스트 메타 (배지 → 텍스트로) */
    const taglineParts = [];
    const catMain = a.category_main || a.category || '';
    const catSub  = a.category_sub  || '';
    if (catMain) taglineParts.push(`<span>${PB.escapeHtml(catSub ? `${catMain} · ${catSub}` : catMain)}</span>`);
    if (a.reading_time_min) taglineParts.push(`<span>읽기 ${Number(a.reading_time_min)}분</span>`);
    if (bill.status) taglineParts.push(`<span>${PB.escapeHtml(bill.status)}</span>`);

    /* Zone 2 본문 */
    const changesHtml = changes.revised
      ? `${renderRichText(changes.revised)}${changes.current ? `<div class="ba-card-sub">현행: ${renderRichText(changes.current)}</div>` : ''}`
      : '<span class="ba-muted">정보 없음</span>';
    const benefitText = affected.benefit
      || (Array.isArray(affected.direct) ? affected.direct.slice(0, 3).join(', ') : '');
    const lossText = affected.loss
      || (Array.isArray(affected.indirect) ? affected.indirect.slice(0, 3).join(', ') : '');

    /* Zone 3 — 항목별 H3 + 본문 + 좌측 마진노트 */
    const issueItemsHtml = issues.map((is) => {
      const type = (is.type === 'pro' || is.type === 'con' || is.type === 'gap') ? is.type : 'gap';
      const label = ISSUE_LABEL[type];
      return `
        <article class="ba-issue ba-issue-${type}">
          <div class="ba-margin-note">${PB.escapeHtml(label)}</div>
          <h3 class="ba-issue-title">${PB.escapeHtml(is.title || '')}</h3>
          <div class="ba-issue-body">${renderRichText(is.body || '')}</div>
        </article>
      `;
    }).join('');

    /* Zone 5 — 질문 */
    const questionsHtml = questions.map((q) => {
      const text = typeof q === 'string' ? q : (q.question || '');
      const hint = typeof q === 'object' && q.hint ? `<p class="ba-q-hint">${PB.escapeHtml(q.hint)}</p>` : '';
      return `<li><span class="ba-q-num"></span><div class="ba-q-content"><p class="ba-q-text">${PB.escapeHtml(text)}</p>${hint}</div></li>`;
    }).join('');

    const originalLinkHtml = bill.link_url
      ? `<a href="${PB.escapeHtml(bill.link_url)}" target="_blank" rel="noopener" class="ba-original-link">국회 원문 ↗</a>`
      : '';

    root.innerHTML = `
      <div class="ba-shell">
        <article class="ba-content">
          <!-- Zone 1: 메타 + 헤드라인 (+ 발의자 컴팩트 스택) -->
          <section class="ba-zone ba-z1" id="ba-summary">
            <div class="ba-meta-line">${joinDot(metaIdParts)}</div>
            ${metaProposerParts.length ? `<div class="ba-meta-line ba-meta-line-sub">${joinDot(metaProposerParts)}</div>` : ''}
            ${proposerStackHtml}
            ${bill.bill_name ? `<h1 class="ba-bill-name">${PB.escapeHtml(bill.bill_name)}</h1>` : ''}
            <h2 class="ba-summary">${renderRichText(a.summary || '')}</h2>
            ${taglineParts.length ? `<div class="ba-tagline">${joinDot(taglineParts)}</div>` : ''}
            ${originalLinkHtml ? `<div class="ba-source-line">${originalLinkHtml}</div>` : ''}
          </section>

          <!-- Zone 2: 핵심 변화 (8 / 4 / 4 비대칭) -->
          <section class="ba-zone ba-z2" id="ba-changes">
            <div class="ba-cards">
              <div class="ba-card ba-card-changes">
                <div class="ba-card-label">바뀌는 것</div>
                <div class="ba-card-body">${changesHtml}</div>
              </div>
              <div class="ba-card ba-card-benefit ${benefitText ? '' : 'ba-card-empty'}">
                <div class="ba-card-label">혜택받는 사람</div>
                <div class="ba-card-body">${benefitText ? renderRichText(benefitText) : '<span class="ba-muted">직접적 혜택 없음</span>'}</div>
              </div>
              <div class="ba-card ba-card-loss ${lossText ? '' : 'ba-card-empty'}">
                <div class="ba-card-label">손해보는 곳</div>
                <div class="ba-card-body">${lossText ? renderRichText(lossText) : '<span class="ba-muted">직접적 손해 없음</span>'}</div>
              </div>
            </div>
          </section>

          ${issues.length ? `
          <!-- Zone 3: 분석 -->
          <section class="ba-zone ba-z3" id="ba-analysis">
            ${issueItemsHtml}
          </section>` : ''}

          ${questions.length ? `
          <!-- Zone 5: 함께 생각 -->
          <section class="ba-zone ba-z5" id="ba-questions">
            <h2 class="ba-section-h">이 법안, 어떻게 생각하세요?</h2>
            <p class="ba-section-hint">답이 없는 질문들이에요. 투표 전 한 번만 생각해보세요.</p>
            <ol class="ba-questions">${questionsHtml}</ol>
            <div class="ba-cta">
              <button type="button" class="ba-cta-primary" data-action="scroll-to-vote">찬반 투표하기</button>
            </div>
          </section>` : ''}
        </article>
      </div>
    `;

    // Zone 5 CTA — 국민 찬반 섹션으로 스크롤
    const ctaVote = root.querySelector('[data-action="scroll-to-vote"]');
    if (ctaVote) {
      ctaVote.addEventListener('click', () => {
        const target = document.getElementById(scrollTargetId);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // Zone 1 발의자 스택 — 전체 보기 토글 (data-expanded 한 곳에서만 제어)
    const ppToggle = root.querySelector('[data-action="toggle-proposers"]');
    if (ppToggle) {
      ppToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const wrap = ppToggle.closest('.ba-proposers');
        if (!wrap) return;
        const wasExpanded = wrap.dataset.expanded === 'true';
        wrap.dataset.expanded = (!wasExpanded).toString();
        const arrow = wrap.querySelector('.ba-pp-toggle-arrow');
        const txt   = wrap.querySelector('.ba-pp-toggle-text');
        if (arrow) arrow.textContent = wasExpanded ? '▾' : '▴';
        if (txt)   txt.textContent   = wasExpanded ? '전체 보기' : '접기';
      });
    }
  };

  /* ===================================================================
     PB.mountAnalysisRequest — 법안 AI 분석 요청 위젯
     opts: { containerId }
     읽는 data-* 속성: bill-id / count / threshold / has-requested / logged-in
  =================================================================== */
  PB.mountAnalysisRequest = (opts) => {
    const widget = document.getElementById(opts.containerId);
    if (!widget) return;
    const billId = widget.dataset.billId;
    const button = widget.querySelector('#btn-request-analysis');
    if (!button) return;  // 비로그인·이미 요청한 경우엔 button 없음

    const updateUi = (count, threshold) => {
      const cur = widget.querySelector('.count-current');
      if (cur) cur.textContent = count;
      const fill = widget.querySelector('.request-progress-fill');
      if (fill) fill.style.width = Math.min(100, (count / threshold) * 100) + '%';
      // "요청했어요" 버튼으로 교체
      const done = document.createElement('button');
      done.type = 'button';
      done.className = 'btn-request-done';
      done.disabled = true;
      done.textContent = '✓ 요청했어요';
      button.replaceWith(done);
      // 임계값 도달 시 메시지 추가
      if (count >= threshold && !widget.querySelector('.threshold-reached')) {
        const div = document.createElement('div');
        div.className = 'threshold-reached';
        div.textContent = '🎉 충분한 요청이 모였어요. 곧 분석됩니다.';
        const action = widget.querySelector('.request-action');
        if (action) action.parentNode.insertBefore(div, action);
      }
    };

    button.addEventListener('click', async () => {
      button.disabled = true;
      const orig = button.textContent;
      button.textContent = '요청 중...';
      try {
        const res = await fetch(`/bill/${encodeURIComponent(billId)}/request-analysis`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json' }
        });
        if (res.status === 401) {
          // 미들웨어가 redirect 줬을 수도 있고 401 JSON 줬을 수도 있음
          const next = encodeURIComponent(window.location.pathname);
          window.location.href = `/auth/login?next=${next}`;
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || '요청 실패');
        }
        const data = await res.json();
        updateUi(Number(data.count || 0), Number(data.threshold || 5));
      } catch (err) {
        button.disabled = false;
        button.textContent = orig;
        alert('요청 실패: ' + (err.message || '잠시 후 다시 시도해주세요.'));
      }
    });
  };

  window.PB = PB;

  /* ===================================================================
     pb-help 용어 설명 링크 — <a> 중첩 방지용 <span> + 클릭 위임
     대상: <span class="pb-help" data-help-href="/glossary#...">?</span>
  =================================================================== */
  document.addEventListener('click', (e) => {
    const help = e.target.closest('.pb-help[data-help-href]');
    if (!help) return;
    e.preventDefault();
    e.stopPropagation();
    location.href = help.dataset.helpHref;
  });
})();
