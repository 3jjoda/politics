// utils/anonAxis.js — 비로그인 성향 진단 (2026-08-24)
//
// 🔴 이 파일이 존재하는 이유: 진단이 로그인 뒤에 있어서 퍼널이 끊겼다.
//    실측 가입 9명 · 응답 시작 7명 · **완료 3명**. 아무 가치도 주기 전에 계정을 요구했다.
//    그래서 로그인 없이 풀고 결과까지 보게 하되, **서버에는 아무것도 저장하지 않는다.**
//
// 저장 위치가 둘로 갈린다:
//   답변 20개 → 브라우저 localStorage('pb.bg.answers'). 채점 POST 한 번 말고는 서버로 안 간다
//   채점 결과 → pb.bg 쿠키 (4축 숫자 + 완료여부, 서버가 발급 · httpOnly)
//
// 🔴 왜 쿠키인가 — 결과를 쓰는 화면이 여섯 곳(reveal·invite·share·compare·의원 목록·의원 상세)인데
//    전부 서버 렌더다. 특히 의원 목록 309장은 `data-match-pct` 를 서버가 미리 계산한다.
//    localStorage 만 쓰면 그 여섯을 클라이언트에서 다시 그려야 하고, 무엇보다
//    거리·일치도 식이 JS 로 복제된다 — `utils/balanceDistance.js` 하나로 유지한다는 규칙과 충돌한다.
//    쿠키로 받으면 **기존 SSR 코드가 한 줄도 안 바뀐 채** 익명 사용자에게도 동작한다.
//
// 🔴 `path=/` 는 의도한 선택이다 (2026-08-24 사용자 결정). 좁히면 의원 카드 309장이 잠긴 채 남는데,
//    그게 익명 진단을 만드는 가장 큰 이유였다. 대가로 4축 숫자가 모든 요청 헤더에 실린다 —
//    서버는 저장하지 않고 앱은 헤더를 로깅하지 않는다. **요청 로깅을 붙일 일이 생기면 여기를 먼저 볼 것.**
//
// ⚠️ 세션을 만들지 않는다. 익명 방문자마다 세션 행을 만들면 2026-08-18 에 고친
//    익명 세션 폭증(8,599건)이 그대로 재발한다. `saveUninitialized: false` 를 건드리지 말 것.

export const ANON_COOKIE = 'pb.bg';
export const ANON_ANSWERS_KEY = 'pb.bg.answers';   // localStorage 키 (클라이언트와 같은 값이어야 한다)
const COOKIE_VERSION = 'v1';
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60 * 1000;   // 90일
const AXES_ORDER = ['economy', 'social', 'security', 'institution'];

/* 쿠키 문자열 ↔ 점수
   형식: v1_<경제>_<사회>_<안보>_<제도>_<응답수>_<완료0|1>_<epoch초>
   빈 축은 빈 칸 (`v1_0.35_-0.20__0.42_20_1_1756...`).
   ⚠️ 구분자·부호·소수점은 전부 쿠키에서 그대로 통과하는 문자다 — 인코딩이 끼지 않는다.
      다른 구분자로 바꾸면 express 가 %XX 로 인코딩해 파싱이 갈린다. */

const num1 = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < -1 || n > 1) return null;
    return Math.round(n * 100) / 100;
};

export function encodeAnonAxis(score) {
    const parts = AXES_ORDER.map((k) => {
        const n = num1(score[k]);
        return n === null ? '' : String(n);
    });
    parts.push(String(Math.max(0, Math.min(999, Number(score.total_responses) || 0))));
    parts.push(score.completed ? '1' : '0');
    parts.push(String(Math.floor((score.computed_at ? new Date(score.computed_at).getTime() : Date.now()) / 1000)));
    return `${COOKIE_VERSION}_${parts.join('_')}`;
}

/* 형식이 조금이라도 어긋나면 null — 손으로 고친 쿠키가 화면에 숫자로 나가면 안 된다 */
export function decodeAnonAxis(raw) {
    if (!raw || typeof raw !== 'string' || raw.length > 120) return null;
    const parts = raw.split('_');
    if (parts.length !== 8 || parts[0] !== COOKIE_VERSION) return null;

    const score = {};
    for (let i = 0; i < AXES_ORDER.length; i++) {
        const p = parts[i + 1];
        if (p === '') { score[AXES_ORDER[i]] = null; continue; }
        if (!/^-?\d+(\.\d{1,2})?$/.test(p)) return null;
        const n = num1(p);
        if (n === null) return null;
        score[AXES_ORDER[i]] = n;
    }
    if (!/^\d{1,3}$/.test(parts[5]) || !/^[01]$/.test(parts[6]) || !/^\d{1,12}$/.test(parts[7])) return null;

    const ts = Number(parts[7]) * 1000;
    if (!Number.isFinite(ts) || ts <= 0) return null;

    const completed = parts[6] === '1';
    return {
        ...score,
        total_responses: Number(parts[5]),
        // 🔴 `packs_completed` 문자열까지 맞춘다 — `BalanceGameService.isCompleted` 가 이걸 보므로
        //    로그인/비로그인이 같은 판정 함수를 탄다 (판정을 두 벌로 만들지 말 것)
        packs_completed: completed ? 'general' : '',
        computed_at: new Date(ts),
        is_anon: true,
    };
}

function readRawCookie(header, name) {
    if (!header) return null;
    for (const part of header.split(';')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        if (part.slice(0, i).trim() !== name) continue;
        const v = part.slice(i + 1).trim();
        try { return decodeURIComponent(v); } catch (e) { return v; }
    }
    return null;
}

/* 요청에서 익명 좌표를 읽는다 — user_axis_score 행과 같은 모양이라 호출부가 분기할 필요가 없다 */
export function readAnonAxis(req) {
    return decodeAnonAxis(readRawCookie(req.headers?.cookie, ANON_COOKIE));
}

export function setAnonAxisCookie(res, score) {
    res.cookie(ANON_COOKIE, encodeAnonAxis(score), {
        maxAge: COOKIE_MAX_AGE,
        httpOnly: true,          // JS 가 읽을 일이 없다 — 지울 때도 서버가 지운다
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });
}

export function clearAnonAxisCookie(res) {
    res.clearCookie(ANON_COOKIE, { path: '/' });
}

/* ===========================================================
   채점 — 답변 맵 → 4축 평균
   🔴 `BalanceGameDao.recomputeUserAxisScore` 의 SQL 과 **같은 규칙**이어야 한다:
      · 활성 문항의 응답만 센다 (비활성 옛 문항은 통째로 무시)
      · 축 평균은 `score <> 0` 인 응답만 (C = '잘 모르겠다' 는 분모에서 빠진다)
      · total_responses 는 C 포함 전체
      · 완료 판정은 `balance_game_packs.question_count` 기준
      한쪽만 고치면 로그인 전후로 좌표가 달라진다.
   =========================================================== */
export function scoreAnswers({ questions, answers, packs }) {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const sums = {}; const counts = {}; const perPack = new Map();
    for (const k of AXES_ORDER) { sums[k] = 0; counts[k] = 0; }
    let total = 0;

    for (const [qid, ans] of Object.entries(answers || {})) {
        const q = byId.get(qid);
        if (!q) continue;                                   // 없는·비활성 문항은 버린다
        const a = String(ans).toUpperCase();
        if (a !== 'A' && a !== 'B' && a !== 'C') continue;
        const score = a === 'A' ? Number(q.option_a_score)
                    : a === 'B' ? Number(q.option_b_score)
                    : 0;
        total += 1;
        perPack.set(q.pack_id, (perPack.get(q.pack_id) || 0) + 1);
        if (!Number.isFinite(score) || score === 0) continue;
        if (!(q.axis in sums)) continue;
        sums[q.axis] += score;
        counts[q.axis] += 1;
    }

    const out = { total_responses: total };
    for (const k of AXES_ORDER) {
        out[k] = counts[k] > 0 ? Math.round((sums[k] / counts[k]) * 100) / 100 : null;
    }
    const done = (packs || [])
        .filter((p) => p.question_count > 0 && (perPack.get(p.id) || 0) >= p.question_count)
        .map((p) => p.id)
        .sort();
    out.packs_completed = done.join(',');
    out.completed = done.includes('general');
    out.computed_at = new Date();
    out.is_anon = true;
    return out;
}

/* 답변 맵 검증 — 클라이언트가 보낸 것이라 그대로 믿지 않는다.
   ⚠️ 상한 200개: 문항이 60개뿐인데 수천 개를 받아 파싱할 이유가 없다 */
export function sanitizeAnswers(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const out = {};
    let n = 0;
    for (const [k, v] of Object.entries(raw)) {
        if (n >= 200) break;
        if (typeof k !== 'string' || k.length > 40 || !/^[A-Za-z0-9_-]+$/.test(k)) continue;
        const a = String(v).toUpperCase();
        if (a !== 'A' && a !== 'B' && a !== 'C') continue;
        out[k] = a;
        n += 1;
    }
    return out;
}
