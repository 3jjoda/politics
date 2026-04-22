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
 *   - PB.mountCitizenVote : 법안 시민 찬반 위젯
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
    // 서버 포맷 'YYYY-MM-DD HH:mm' 을 Date 로 변환
    const safe = isoLike.replace(' ', 'T');
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

    try {
      const data = await PB.fetch(`/api/ratings/politician/${monaCd}`);
      render(data);
    } catch (err) {
      root.innerHTML = `<div class="pb-muted">평가 데이터를 불러올 수 없습니다: ${PB.escapeHtml(err.message)}</div>`;
    }
  };

  /* ===================================================================
     댓글 위젯 — type/targetId 기반
     옵션: { containerId, type, targetId, title? }
  =================================================================== */
  PB.mountComments = async (opts) => {
    const root = document.getElementById(opts.containerId);
    if (!root) return;
    const { type, targetId } = opts;
    const state = { items: [], sort: 'new', likes: {} };

    const refreshLikes = async (items) => {
      // 각 댓글의 좋아요 count 와 내 상태
      const results = await Promise.all(items.map(c =>
        PB.fetch(`/api/likes?type=comment&targetId=${c.id}`).catch(() => ({ count: 0, liked: false }))
      ));
      const map = {};
      items.forEach((c, i) => { map[c.id] = results[i]; });
      state.likes = map;
    };

    const sortItems = (items) => {
      const copy = [...items];
      if (state.sort === 'new') copy.sort((a, b) => b.id - a.id);
      else if (state.sort === 'like') copy.sort((a, b) => (state.likes[b.id]?.count || 0) - (state.likes[a.id]?.count || 0));
      return copy;
    };

    const render = () => {
      const user = PB.currentUser();
      const myId = user ? user.id : null;
      const sorted = sortItems(state.items.filter(c => !c.is_deleted || c.parent_id == null));
      const visible = state.items.filter(c => !c.is_deleted); // 최종 표시

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
          <span class="sort-count">총 ${sorted.length}개</span>
        </div>

        <div class="comments">
          ${sorted.length === 0
            ? `<div class="comments-empty">아직 등록된 댓글이 없습니다. 첫 댓글을 남겨보세요.</div>`
            : sorted.map(c => renderCard(c, myId)).join('')}
        </div>
      `;

      bindEvents();
    };

    const renderCard = (c, myId) => {
      const liked = state.likes[c.id]?.liked;
      const likeCnt = state.likes[c.id]?.count || 0;
      const mine = myId && c.user_id === myId;
      // nickname NULL == 탈퇴 유저 (provider='deleted')
      const isDeletedUser = !c.nickname;
      const displayName   = isDeletedUser ? '탈퇴한 사용자' : c.nickname;
      const avatarSeed    = isDeletedUser ? '탈퇴' : c.nickname;
      return `
        <div class="comment-card ${isDeletedUser ? 'comment-card-deleted' : ''}" data-cid="${c.id}">
          <div class="comment-header">
            <div class="comment-avatar">${PB.avatarSvg(avatarSeed, 32)}</div>
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
            ${mine && !isDeletedUser ? `
              <span class="comment-action" data-edit>✎ 수정</span>
              <span class="comment-action" data-delete>🗑 삭제</span>
            ` : ''}
          </div>
        </div>`;
    };

    const bindEvents = () => {
      // 글자수 카운트
      const input = root.querySelector('[data-comment-input]');
      const cnt = root.querySelector('[data-count]');
      if (input && cnt) {
        input.addEventListener('input', () => { cnt.textContent = input.value.length; });
      }

      // 작성
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
      try {
        const { items } = await PB.fetch(`/api/comments?type=${encodeURIComponent(type)}&targetId=${encodeURIComponent(targetId)}`);
        state.items = items.filter(c => !c.is_deleted);
        await refreshLikes(state.items);
        render();
      } catch (err) {
        root.innerHTML = `<div class="pb-muted">댓글을 불러올 수 없습니다: ${PB.escapeHtml(err.message)}</div>`;
      }
    };

    load();
  };

  /* ===================================================================
     법안 시민 찬반 위젯
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
          <button class="cv-btn cv-btn-agree    ${my === 'agree'    ? 'active' : ''}" data-vote="agree">
            👍 찬성
          </button>
          <button class="cv-btn cv-btn-disagree ${my === 'disagree' ? 'active' : ''}" data-vote="disagree">
            👎 반대
          </button>
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

    try {
      const d = await PB.fetch(`/api/votes/bill/${encodeURIComponent(billId)}`);
      render(d);
    } catch (err) {
      root.innerHTML = `<div class="pb-muted">시민 찬반을 불러올 수 없습니다: ${PB.escapeHtml(err.message)}</div>`;
    }
  };

  window.PB = PB;
})();
