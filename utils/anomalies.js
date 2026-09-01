// utils/anomalies.js — 「설명이 필요한 숫자」 지표 정의 · 단일 소스
//
// 🔴 **현재 꺼져 있다 (2026-09-01, 사용자 결정).** 만들어는 뒀지만 "내용이 아직 잘 모르겠다" 는
//    판단이라 공개하지 않는다. 코드·데이터는 그대로 두고 **노출만** 막는다.
//
//    켜는 법: 아래 `ENABLED` 를 true 로. 그 한 줄이 네 곳을 동시에 연다 —
//      ① `/why`·`/why/:date` 라우트 등록 (routes/PageRoutes.js)
//      ② 홈 카드 조회 (controllers/InitController.js)
//      ③ 사이트맵 등재 (utils/sitemap.js)
//      ④ 목록·상세 화면
//    ⚠️ 끈 상태에서 `/why` 는 라우트가 아예 없어 **404** 다 (500 이 아니다).
//    ⚠️ 배치(`genAnomalyCard`)는 **계속 돈다** — 카드는 그날의 데이터로 굳는 것이라,
//       멈추면 나중에 켤 때 그 기간이 통째로 빈다. AI 호출 0 · 하루 0.4초라 비용이 없다.
//       완전히 멈추려면 package.json 의 `batch:daily` 에서 빼면 된다.
export const ENABLED = false;
//
// 이 파일이 정하는 것: 어떤 숫자를 꺼낼지 · 어떤 조건에서 꺼낼지 · 뭐라고 물을지 ·
// 어떤 한계를 같이 말할지. 배치·화면·목록이 전부 여기를 읽는다.
//
// 🔴 **순위표를 만들지 말 것.** 이 기능의 존재 이유는 "누가 제일 나쁜가" 가 아니라
//    "이 숫자는 왜 이럴까" 다. 그래서:
//      ① 하루 한 장 (목록에 늘어놓지 않는다)
//      ② 지표를 돌아가며 쓴다 (한 지표에 머물면 그 지표의 정당 쏠림이 그대로 드러난다 —
//         실측 자당·타당 격차 15%p 이상 14명 중 11명이 국민의힘이다)
//      ③ 번호·순위·"1위" 를 쓰지 않는다
//      ④ 평가어를 쓰지 않는다 (성실·소신·거수기·게으름 전부 금지)
//      ⑤ 정당색을 쓰지 않는다
//
// 🔴 **중앙값을 반드시 같이 낸다.** `불참률 80.4%` 만으로는 큰지 알 수 없다.
//    평균선 없는 막대와 같은 문제 — 기준 없는 숫자는 정보가 아니라 인상이다.

/* 지표 5종.
   ⚠️ `order` 가 곧 로테이션 순서다. 날짜로 순환하므로 배열 순서를 바꾸면 과거 카드와 무관하게
      앞으로의 순서만 바뀐다 (카드는 굳혀 저장하므로 과거는 안 흔들린다). */
export const METRICS = [
    {
        key: 'absent',
        label: '본회의 불참률',
        /* ⚠️ `short` 는 탭·행에 쓴다. 긴 `label` 은 탭 한 줄에 안 들어간다 (실측 5개 합 폭) */
        short: '불참률',
        // 왜 이 숫자가 질문이 되나
        why: '본회의 표결에 참여하지 않은 비율',
        unit: '%',
        // 후보 조건 (쿼리와 같이 읽을 것)
        min: 60,
        note: '표결 100건 이상 기록된 의원만',
        headline: (v, d) => `${d.total}번의 본회의 표결 중 ${d.absent}번 자리에 없던 의원이 있습니다.`,
        medianLabel: '의원 중앙값',
        unknownText: '국회는 불참 사유를 공개하지 않습니다. 지역구 일정일 수도, 다른 이유일 수도 있습니다. 우리는 모릅니다.',
        caveats: [
            '불참은 게으름과 다릅니다. 장관 겸직·의장단 관례·표결 보이콧이 섞여 있습니다.',
            '국회는 불참 사유를 공개하지 않습니다.',
        ],
        // 이 지표를 볼 수 있는 사이트 안의 자리
        link: { href: '/guide/abstain-vs-absent', text: '「기권과 불참은 다르다」 읽기' },
    },
    {
        key: 'gap',
        label: '자당·타당 법안 찬성률 격차',
        short: '당 성향 격차',
        why: '자기 당이 낸 법안과 다른 당이 낸 법안에 얼마나 다르게 투표했는지',
        unit: '%p',
        min: 15,
        note: '자당·타당 표결이 각각 50건 이상인 의원만',
        headline: (v, d) => `자기 당 법안에는 ${d.own}% 찬성하고, 다른 당 법안에는 ${d.other}% 찬성한 의원이 있습니다.`,
        medianLabel: '의원 중앙값',
        unknownText: '표결에는 이유가 남지 않습니다. 법안 하나하나를 보고 판단한 결과일 수도, 당의 방침을 따른 결과일 수도 있습니다. 기록만으로는 가릴 수 없습니다.',
        caveats: [
            '격차가 크다고 당파적이라고 단정할 수 없습니다. 다수당은 자기 법안이 무난히 통과되는 의사일정 구조라 격차가 낮게 나오는 경향이 있습니다.',
            '불참은 분모에서 뺐습니다. 넣으면 성향과 출석이 섞입니다.',
        ],
        link: { href: '/guide/party-line-or-bill', text: '「당을 보고 찍나, 법안을 보고 찍나」 읽기' },
    },
    {
        key: 'propose',
        label: '대표발의 건수',
        short: '대표발의',
        why: '자기 이름으로 낸 법안 수',
        unit: '건',
        max: 20,                   // 이 지표만 "적을수록" 후보다
        lower: true,
        note: '22대 임기 전체를 재직한 의원만',
        headline: (v, d) => (v === 0
            ? '22대 국회 내내 자기 이름으로 법안을 한 건도 내지 않은 의원이 있습니다.'
            : `22대 국회 내내 자기 이름으로 낸 법안이 ${v}건인 의원이 있습니다.`),
        medianLabel: '의원 중앙값',
        unknownText: '법안을 적게 낸 이유는 어디에도 기록되지 않습니다. 공동발의로 참여했거나, 상임위에서 다른 방식으로 일했을 수도 있습니다.',
        caveats: [
            '발의 건수는 기여도가 아닙니다. 한 건을 오래 다듬는 것과 여러 건을 내는 것은 다른 일입니다.',
            '국회의장·국무위원은 발의를 거의 하지 않습니다.',
        ],
        link: { href: '/guide/proposing-is-not-contribution', text: '「발의가 곧 기여는 아니다」 읽기' },
    },
    {
        key: 'committee',
        label: '상임위 회의 참여율',
        short: '상임위 참여',
        why: '소속 상임위 회의에서 발언한 비율',
        unit: '%',
        max: 25,
        lower: true,
        note: '소속 후 회의가 11번 이상 열린 경우만',
        headline: (v, d) => `소속 상임위 회의 ${d.denom}번 중 ${d.spoke}번만 발언한 의원이 있습니다.`,
        medianLabel: '의원 평균',
        unknownText: '국회는 상임위 출석을 개인 단위로 공개하지 않습니다. 참석하고 듣기만 했는지, 아예 오지 않았는지 우리는 구분할 수 없습니다.',
        caveats: [
            '발언하지 않았다고 참석하지 않은 것은 아닙니다. 국회는 상임위 출석을 개인 단위로 공개하지 않아, 발언이 유일한 관측 수단입니다.',
            '소속 시작일은 그 위원회에서 처음 발언한 날로 근사한 경우가 많아, 실제보다 후한 값입니다.',
            '위원회를 두 곳 이상 맡으면 한쪽 참여가 낮아질 수 있습니다.',
        ],
        link: { href: '/guide/committee-speech-rate', text: '「상임위 참여율은 무엇을 재나」 읽기' },
    },
    {
        key: 'axis',
        label: '소속 정당 평균과 다른 자리',
        short: '당 평균과 거리',
        why: '공동발의 기록으로 만든 경제 정책 좌표가 같은 당 평균에서 얼마나 떨어져 있는지',
        unit: '',
        min: 0.3,
        note: '좌표가 있는 의원이 20명 이상인 정당만',
        /* ⚠️ 이 지표만 **표시값과 선정값이 다르다.** 후보는 거리(|본인 − 당 평균|)로 고르지만
           화면에 쓰는 건 본인 좌표다. 거리(0.35)는 혼자 떠 있으면 뜻이 안 통한다. */
        showMe: true,
        /* 🔴 **숫자를 그대로 내보내지 말 것** (2026-09-01 사용자 지적: "저렇게만 보면 무슨 말인지 모르겠다").
           `0.07` · `0.41` 은 단위도 축도 방향도 없어 아무 뜻이 없다 — 다른 네 지표(%·건·%p)와 달리
           이 값만 자명하지 않다. **방향을 말로 먼저 하고 숫자는 근거로 내린다.**
           화면에는 양극 막대를 같이 그린다 (`AXIS_META` 의 긴 라벨 + 사이트 공통 평균 마커).
           ⚠️ `시장`·`개입` 처럼 짧은 라벨만 두면 "무엇의 어느 쪽인지" 가 안 읽힌다 — 의원 상세에서 이미 겪은 지적이다. */
        axisKey: 'economy',
        headline: (v, d) => `같은 당 의원들은 평균적으로 ${d.pavgSide}인데, 이 의원은 ${d.meSide}입니다.`,
        medianLabel: '같은 당 평균',
        unknownText: '좌표가 당 평균과 먼 이유는 기록에 없습니다. 담당 분야가 달라서일 수도, 실제로 다른 생각을 해서일 수도 있습니다.',
        caveats: [
            '좌표는 공동발의 기록으로 만든 것이라, 표결이나 발언에서 드러난 입장은 담기지 않습니다.',
            '당 평균에서 멀다고 소신이라고 부를 수 없습니다. 담당 분야가 달라서일 수도 있습니다.',
        ],
        link: { href: '/guide/how-we-place-politicians', text: '「의원 성향 좌표는 어떻게 만들었나」 읽기' },
    },
];

export const metricByKey = (k) => METRICS.find((m) => m.key === k) || null;

/* ── 축 좌표를 말로 옮긴다 ────────────────────────────────────
   🔴 좌표값은 **혼자 두면 아무 뜻이 없다.** `0.07` 을 보고 "가운데" 를 읽어낼 사람은 없다.
      경계는 사이트 공통 상수를 쓴다 (`utils/axisConfig.js` 의 AXIS_MID 0.25 · D_STRONG 0.55) —
      성향 진단 결과·공유 카드가 같은 기준으로 말하므로 여기만 다르면 같은 좌표가 다르게 설명된다. */
const AXIS_MID = 0.25, AXIS_STRONG = 0.55;

/** 좌표(−1~1) → 사람이 읽는 자리. `meta` 는 AXIS_META 의 한 축 */
export const axisSide = (v, meta) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '알 수 없음';
    const pole = n < 0 ? meta.Lx : meta.Rx;          // 긴 형 라벨 (`시장 자율` · `정부 개입`)
    if (Math.abs(n) < AXIS_MID) return '가운데에 가까운 편';
    if (Math.abs(n) < AXIS_STRONG) return `약간 ${pole} 쪽`;
    return `${pole} 쪽`;
};

/** 행·탭처럼 좁은 자리용 짧은 라벨 (`가운데` · `약간 개입` · `개입`) */
export const axisSideShort = (v, meta) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    const pole = n < 0 ? meta.L : meta.R;            // 짧은 형 (`시장` · `개입`)
    if (Math.abs(n) < AXIS_MID) return '가운데';
    if (Math.abs(n) < AXIS_STRONG) return `약간 ${pole}`;
    return pole;
};

/** 좌표(−1~1) → 막대 위 위치(%). ⚠️ 범위를 벗어난 값도 트랙 안에 가둔다 */
export const axisPct = (v) => Math.max(0, Math.min(100, ((Number(v) + 1) / 2) * 100));

/* 🔴 선정 규칙 — 화면에 그대로 공개한다.
   "우리가 골랐다" 가 아니라 "조건에 걸린 것을 규칙이 꺼냈다" 여야 편집이 아니다. */
export const SELECTION_RULES = [
    '지표 다섯 가지를 날짜 순서대로 돌아가며 씁니다. 사람을 먼저 고르지 않습니다.',
    '각 지표의 문턱을 넘은 의원만 후보가 됩니다. 문턱은 지표마다 화면에 적혀 있습니다.',
    '후보 안에서는 회차에 따라 차례로 돌아갑니다. 값이 가장 큰 사람만 반복해서 꺼내지 않습니다.',
    '정당을 안배하지 않습니다. 안배하는 순간 그것이 편집이 됩니다.',
    '무작위가 아닙니다. 같은 날짜는 언제 다시 계산해도 같은 사람이 나옵니다.',
];

/* 판단 질문 — 우리가 답하지 않는다. 이 사이트가 지표에 등수를 매기지 않기로 한 이상,
   "그래서 이게 문제냐" 의 답은 읽는 사람이 갖는다. 법안 5-Zone 의 Zone 5 와 같은 장치. */
export const JUDGMENT_QUESTIONS = {
    absent: [
        '이 숫자만으로 판단할 수 있을까요? 더 알아야 할 것이 있다면 무엇일까요?',
        '불참 사유를 공개하지 않는 것은 괜찮은 일일까요?',
    ],
    gap: [
        '자기 당 법안에 더 찬성하는 것은 자연스러운 일일까요, 아니면 문제일까요?',
        '반대로 격차가 거의 없는 의원은 무엇을 뜻할까요?',
    ],
    propose: [
        '법안을 적게 내는 것은 일을 적게 한 것일까요?',
        '의정활동을 건수로 재는 것이 맞을까요? 다른 방법이 있을까요?',
    ],
    committee: [
        '발언하지 않았다는 것과 일하지 않았다는 것은 같은 말일까요?',
        '국회가 상임위 출석을 개인 단위로 공개해야 할까요?',
    ],
    axis: [
        '같은 당 안에서 다른 위치에 있는 것은 어떤 의미일까요?',
        '내가 뽑은 사람은 당 평균과 얼마나 가까울까요?',
    ],
};

/* 설명 종류 — 관측 데이터에서 나온다.
   🔴 `politician_titles` 를 쓰지 않는다. 그 테이블은 **현재만** 담는데 지표는 **임기 전체 누적**이라
      시간 축이 안 맞는다. 실측: 우원식은 2024-06~2026-05 국회의장이었는데(발언 기록 917건)
      후반기 의장이 조정식으로 바뀌면서 titles 에서 빠져, 대표발의 0건에 "설명 없음" 이 붙는다.
      `politician_committees` 가 스냅샷이라 이력 테이블을 따로 만든 것과 같은 문제인데,
      이번엔 새로 쌓을 필요가 없다 — **발언 기록이 이미 이력이다.** */
export const EXPLAIN = {
    speaker: (d) => `${d.period} 국회의장을 맡았습니다. 국회의장은 관례상 법안을 발의하지 않고, 본회의 표결에도 참여하지 않습니다.`,
    vicespeaker: (d) => `${d.period} 국회부의장을 맡았습니다. 의장단은 본회의 진행을 맡아 표결 참여가 구조적으로 적습니다.`,
    minister: (d) => `${d.period} ${d.org} 장관을 맡았습니다. 부처를 맡으면 의정활동이 줄어드는 것이 당연합니다.`,
    multi: (d) => `위원회를 ${d.n}곳 맡고 있습니다. 한 곳에 쓸 수 있는 시간이 그만큼 나뉩니다.`,
    joined: (d) => `임기 도중 합류해 표결 기록이 ${d.total}건입니다. 임기 전체를 재직한 의원(${d.max}건)과 같은 기준으로 볼 수 없습니다.`,
    /* 🔴 이게 이 기능의 핵심이다. 모르면 모른다고 쓴다 — 숨기거나 추측하지 않는다.
       ⚠️ 지표마다 "왜 모르는지" 가 다르다. 한 문장으로 뭉뚱그리면 열 장이 전부 같은 말이 되어
          읽히지 않는다 (실측: 12장 중 10장이 설명 없음이다). METRICS 의 `unknownText` 를 쓴다. */
    unknown: (metric) => metric?.unknownText || '우리는 이유를 모릅니다. 국회가 공개하는 자료에 답이 없습니다.',
};

/* 관측 근거에서 설명을 고른다. 순서가 곧 우선순위 —
   의장직이 장관 겸직보다 앞이다 (겸할 수 없지만, 둘 다 잡히면 더 강한 제약을 쓴다). */
export const resolveExplain = (metricKey, ctx) => {
    if (ctx.speaker) return { kind: 'speaker', text: EXPLAIN.speaker(ctx.speaker), explained: true };
    if (ctx.viceSpeaker) return { kind: 'vicespeaker', text: EXPLAIN.vicespeaker(ctx.viceSpeaker), explained: true };
    if (ctx.minister) return { kind: 'minister', text: EXPLAIN.minister(ctx.minister), explained: true };
    // 임기 중 합류는 "적게 한 것처럼 보이는" 지표에만 해당한다
    if (ctx.joined && (metricKey === 'propose' || metricKey === 'absent')) {
        return { kind: 'joined', text: EXPLAIN.joined(ctx.joined), explained: true };
    }
    // 다중 소속은 상임위 참여율에만 해당한다 (다른 지표와는 무관하다)
    if (metricKey === 'committee' && ctx.multi?.n > 1) {
        return { kind: 'multi', text: EXPLAIN.multi(ctx.multi), explained: true };
    }
    return { kind: 'unknown', text: EXPLAIN.unknown(metricByKey(metricKey)), explained: false };
};

/* 날짜 → 일련번호. `new Date(s).getDay()` 같은 로컬 getter 를 쓰지 말 것 (프로세스 타임존을 탄다) */
const dayNumber = (dateStr) => {
    const [y, m, d] = String(dateStr).split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};

/* 날짜 → 지표. 결정적이다 (같은 날짜면 언제 계산해도 같은 지표) */
export const metricForDate = (dateStr) => {
    const days = dayNumber(dateStr);
    return METRICS[((days % METRICS.length) + METRICS.length) % METRICS.length];
};

/* 🔴 날짜 → 그 지표의 **몇 번째 회차**인가. 이게 후보 목록 안에서의 위치를 정한다.
   후보 1등만 계속 뽑으면 5일마다 같은 사람이 나와 "이 사이트가 저 사람을 저격한다" 로 읽힌다.
   회차로 순환하면 후보를 골고루 돌고(16명이면 80일 주기), **DB 상태에 의존하지 않아**
   backfill 순서나 재생성과 무관하게 같은 날짜는 항상 같은 사람이 된다.
   ⚠️ 후보 목록 자체는 데이터가 갱신되면 조금씩 바뀐다. 그래서 카드는 굳혀 저장한다. */
export const rotationRound = (dateStr) => Math.floor(dayNumber(dateStr) / METRICS.length);

/** 후보 배열에서 그날 뽑을 사람. 배열은 이미 값 순으로 정렬돼 있다고 본다 */
export const pickFromPool = (pool, dateStr) => {
    if (!pool || pool.length === 0) return null;
    const r = rotationRound(dateStr);
    return pool[((r % pool.length) + pool.length) % pool.length];
};
