// utils/threadsPost.js — 브리핑 카드 → 쓰레드(Threads) 연결 게시물
//
// 쓰레드는 인스타와 제약이 다르다:
//   · 게시물당 500자 (한글도 1자)
//   · 링크가 살아 있다 (인스타 캡션은 죽는다)
//   · 이미지 없이 텍스트만으로 성립 → 제작 비용 0
//   · 여러 개를 이어 붙인 **체인**이 기본 형식
//
// 그래서 "본문을 통째로 붙여넣기" 가 아니라 **체인으로 쪼개는 것**이 이 모듈의 일이다.
//
// ⚠️ 첫 게시물이 피드에 노출되는 전부다. 여기서 멈추면 나머지는 안 읽힌다
//    → 날짜 + 헤드라인 + 숫자만 넣어 짧게 유지한다.

const LIMIT = 500;

// 서로게이트 페어(이모지 등)를 1자로 세려면 코드포인트 기준이어야 한다
export const charLen = (s) => [...String(s)].length;

/* 게시할 사이트 주소.
   ⚠️ BASE_URL 은 로컬에서 localhost 라 그대로 쓰면 복사 텍스트에 localhost 링크가 박힌다.
      canonicalHost.js 와 같은 방식으로 로컬을 걸러내고 대표 도메인으로 떨어뜨린다. */
export function siteUrl(explicit) {
    const b = explicit || process.env.BASE_URL || '';
    if (!b || /localhost|127\.0\.0\.1/.test(b)) return 'https://dangmalsa.kr';
    return b.replace(/\/$/, '');
}

/* 긴 글을 limit 이하 조각으로. **문장 경계를 먼저 지킨다** —
   글자수로 뚝 자르면 문장이 반토막 난 채 게시물이 끊긴다. */
export function splitToPosts(text, limit = LIMIT) {
    const t = String(text || '').trim();
    if (!t) return [];
    if (charLen(t) <= limit) return [t];

    // 한국어 서술문은 '다.' 로 끝나므로 마침표 뒤 공백이 문장 경계가 된다
    const sentences = t.split(/(?<=[.!?])\s+/);
    const out = [];
    let buf = '';

    const flush = () => { if (buf.trim()) out.push(buf.trim()); buf = ''; };

    for (const s of sentences) {
        if (charLen(s) > limit) {
            // 한 문장이 통째로 한도를 넘는 예외 — 공백 기준으로 다시 쪼갠다
            flush();
            let chunk = '';
            for (const w of s.split(/\s+/)) {
                // ⚠️ 단어 하나가 한도를 넘으면 여기서 멈추면 안 된다.
                //    공백이 전혀 없는 글은 "단어 1개" 라 그대로 통과해 초과 게시물이 나간다 (실측 1300자).
                //    최후 수단으로 코드포인트 단위로 자른다 — 자를 곳이 없으면 자르는 게 맞다.
                if (charLen(w) > limit) {
                    if (chunk) { out.push(chunk.trim()); chunk = ''; }
                    const cp = [...w];
                    for (let i = 0; i < cp.length; i += limit) out.push(cp.slice(i, i + limit).join(''));
                    continue;
                }
                if (charLen(chunk) + charLen(w) + 1 > limit) { if (chunk) out.push(chunk.trim()); chunk = ''; }
                chunk += (chunk ? ' ' : '') + w;
            }
            if (chunk.trim()) out.push(chunk.trim());
            continue;
        }
        if (charLen(buf) + charLen(s) + 1 > limit) flush();
        buf += (buf ? ' ' : '') + s;
    }
    flush();
    return out;
}

/* 카드 한 장 → 게시물 배열 [{ role, text, len }]
 *
 * opts.mode
 *   'full'  (기본) 6개 — 흐름을 하나씩 나누고 법안 목록·대표발의자까지 싣는다
 *   'short' 3개    — 복사 횟수를 줄이고 **링크를 첫 게시물로 올린다**
 *
 * 🔴 `short` 를 만든 이유는 길이가 아니라 **링크 위치**다.
 *    full 은 링크가 6번째라 체인을 끝까지 펼친 사람만 본다 — 쓰레드를 쓰는 유일한 이유가
 *    "링크가 살아 있다" 인데 그걸 맨 뒤에 둔 건 설계 착오였다.
 *    부수적으로 매일 복사가 6번 → 3번이 된다 (매일 하는 일이라 이 마찰이 곧 이탈이 된다).
 */
export function buildThreadsChain(post, opts = {}) {
    const site = siteUrl(opts.baseUrl);
    const short = opts.mode === 'short';
    const st = post.stats || {};
    const date = post.briefing_date.replace(/-/g, '.');
    const [, mm, dd] = post.briefing_date.split('-');
    const day = `${Number(mm)}월 ${Number(dd)}일`;
    const url = `${site}/briefing/${post.id}`;

    // 카드 종류 표시 — 첫 게시물에 짧게 붙인다.
    // ⚠️ 긴 고지문을 여기 넣으면 훅이 죽는다. 상세 고지는 마지막 게시물에 둔다.
    const kind = post.isAi ? 'AI 정리' : (post.isEmpty ? '활동 없음' : '데이터 집계');

    const posts = [];

    /* ① 훅 — 피드에 노출되는 유일한 게시물 */
    const nums = [];
    if (!post.isEmpty && st.proposed !== undefined) {
        nums.push(`발의 ${st.proposed}건`);
        if (st.proposers) nums.push(`대표발의 ${st.proposers}명`);
        if (st.cosign) nums.push(`공동발의 서명 ${st.cosign}건`);
    }
    posts.push({
        role: short ? '훅 (피드 노출 · 링크)' : '훅 (피드 노출)',
        text: [
            `[${day} 국회]`,
            '',
            post.headline,
            ...(nums.length ? ['', nums.join(' · ')] : []),
            // short 에서만 링크를 여기 둔다 — 펼치지 않아도 유입이 되게
            ...(short ? ['', `전문 → ${url}`] : []),
            '',
            `※ ${kind}`,
        ].join('\n'),
    });

    /* ── short: 본문 → 흐름 요약 + 고지 (3개) ────────────────── */
    if (short) {
        splitToPosts(post.body).forEach((t, i, arr) => {
            posts.push({ role: arr.length > 1 ? `본문 ${i + 1}/${arr.length}` : '본문', text: t });
        });

        // 흐름은 주제·설명만. 법안 목록은 버린다 — 그건 링크 너머에 전부 있다
        const lines = (post.threads || [])
            .flatMap((t) => [`· ${t.theme} (${t.bill_count}건)`, `  ${t.what}`]);
        const notice = post.isAi
            ? '숫자는 국회 공식 데이터 집계입니다. 문장과 주제 묶음은 AI가 법안 원문을 읽고 정리한 것으로 사실과 다를 수 있습니다.'
            : (post.isEmpty
                ? '국회 공식 데이터에 이날 기록된 활동이 없어 자동으로 남긴 기록입니다.'
                : 'AI 없이 국회 공식 데이터 집계만으로 만들었습니다.');

        const tail = [
            ...(lines.length ? ['이날의 흐름', '', ...lines, ''] : []),
            // ⚠️ 링크를 마지막에도 다시 둔다 — 쓰레드는 게시물 하나만 따로 돌아다닐 수 있어
            //    이 게시물만 본 사람에게도 출처로 가는 길이 있어야 한다
            `법안 원문과 의원별 표결 → ${url}`,
            '',
            notice,
            '출처: 열린국회정보',
        ].join('\n');

        splitToPosts(tail).forEach((text, i, arr) => {
            posts.push({ role: `흐름·마무리${arr.length > 1 ? ` ${i + 1}/${arr.length}` : ''}`, text });
        });

        return posts.map((p, i) => ({ ...p, n: i + 1, len: charLen(p.text), over: charLen(p.text) > LIMIT }));
    }

    /* ② 본문 — 500자 넘으면 문장 단위로 나뉜다 */
    splitToPosts(post.body).forEach((t, i, arr) => {
        posts.push({ role: arr.length > 1 ? `본문 ${i + 1}/${arr.length}` : '본문', text: t });
    });

    /* ③ 주제 묶음 — 하나씩 별도 게시물. 체인에서 스크롤이 멈추는 지점이라 나눠야 읽힌다 */
    (post.threads || []).forEach((t, i) => {
        const tb = post.thread_bills || {};
        const bills = (t.bill_ids || []).filter((id) => tb[id]).slice(0, 4)
            // ⚠️ 법안의 87%가 동명이라 대표발의자를 반드시 붙인다.
            //    정당은 넣지 않는다 — 이름이 늘어서는 순간 대비 구도가 된다
            .map((id) => `· ${tb[id].bill_name}${tb[id].proposer_name ? ` (${tb[id].proposer_name})` : ''}`);
        const head = `${t.theme} — ${t.bill_count}건`;
        const withBills = [head, '', t.what, ...(bills.length ? ['', ...bills] : [])].join('\n');

        if (charLen(withBills) <= LIMIT) {
            posts.push({ role: `흐름 ${i + 1}`, text: withBills });
            return;
        }
        // 1차: 법안 목록을 버린다 (주제·설명이 우선)
        const slim = [head, '', t.what].join('\n');
        if (charLen(slim) <= LIMIT) {
            posts.push({ role: `흐름 ${i + 1}`, text: slim });
            return;
        }
        // 2차: 설명 자체가 길면 문장 단위로 나눈다.
        // ⚠️ 여기까지 안 하면 흐름만 분할에서 빠져 초과 게시물이 나간다 (스트레스에서 727자 발생)
        splitToPosts(slim).forEach((text, k, arr) => {
            posts.push({ role: `흐름 ${i + 1}${arr.length > 1 ? ` (${k + 1}/${arr.length})` : ''}`, text });
        });
    });

    /* ④ 마무리 — 링크와 **전체 고지**. 쓰레드는 링크가 살아 있어 여기가 유입 지점이다 */
    const notice = post.isAi
        ? '숫자는 국회 공식 데이터 집계입니다. 문장과 주제 묶음은 AI가 법안 원문을 읽고 정리한 것으로 사실과 다를 수 있습니다.'
        : (post.isEmpty
            ? '국회 공식 데이터에 이날 기록된 활동이 없어 자동으로 남긴 기록입니다.'
            : 'AI 없이 국회 공식 데이터 집계만으로 만들었습니다.');
    posts.push({
        role: '마무리 (링크·고지)',
        text: [
            `${date} 브리핑 전문과 법안 원문`,
            url,
            '',
            '의원별 표결 기록까지 전부 볼 수 있습니다.',
            '',
            notice,
            '출처: 열린국회정보',
        ].join('\n'),
    });

    // 넘치는 게시물이 있으면 화면에서 빨갛게 보여주기 위해 길이를 같이 넘긴다
    return posts.map((p, i) => ({ ...p, n: i + 1, len: charLen(p.text), over: charLen(p.text) > LIMIT }));
}

export const THREADS_LIMIT = LIMIT;
