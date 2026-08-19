// utils/guideArticles.js — 「읽는 법」(/guide) 해설 글 목록 · 단일 소스
//
// 왜 있나 (2026-08-19): AdSense 가 「가치가 별로 없는 콘텐츠」 로 반려했다. 사이트의 텍스트 대부분이
// 국회 원문(bills.summary)·SQL 집계·AI 카드였고, **사람이 쓴 설명 페이지**가 /about·/glossary 뿐이었다.
// 이 섹션은 지표 각주에 흩어져 있던 "이 숫자를 어떻게 읽어야 하나" 를 글 한 편씩으로 모은 것이다.
//
// 🔴 규칙
//  - 본문은 views/guide/articles/<slug>.ejs. 여기엔 메타만 (라우트·목차·사이트맵·description 이 이걸 읽는다)
//  - 정확한 수치를 본문에 박지 말 것 — 배치가 매일 움직인다. 살아 있는 값은 컨트롤러가 넘기는 `facts`(getHomeFacts) 를 쓰고,
//    나머지는 "약"·"N건 안팎" 으로. (사이트 소개 페이지와 같은 규칙)
//  - 평가어·정당색 금지. 각 글 끝에 「이 글이 말하지 않는 것」(한계) 문단을 둔다 — 사이트 원칙
//  - 글을 추가하면: 이 배열 + articles/<slug>.ejs. 사이트맵·목차·이전/다음 링크는 자동
export const GUIDE_ARTICLES = [
    {
        slug: 'why-so-few-no-votes',
        title: '본회의 반대표는 왜 1%도 안 될까',
        sub: '법안이 걸러지는 진짜 자리는 어디인가',
        desc: '국회 본회의 표결에서 반대표는 1%가 안 된다. 그런데 법안 4건 중 3건은 통과되지 않는다. 두 숫자가 동시에 참인 이유: 법안이 걸러지는 곳은 본회의가 아니라 위원회다.',
        minutes: 4,
        related: [
            { href: '/xray#xr-ratedist', label: '차트 · 자당 법안엔 예외가 없다' },
            { href: '/xray#xr-monthly',  label: '차트 · 월별 추이' },
        ],
    },
    {
        slug: 'how-a-bill-moves',
        title: '법안 하나가 국회를 통과하기까지',
        sub: '발의부터 본회의 의결까지, 그리고 그 사이에서 사라지는 길',
        desc: '발의 → 소관위 회부 → 위원회 상정·처리 → 법사위 → 본회의. 법안 상세의 「처리 경과」 줄이 뜻하는 것과, 대안반영폐기·철회처럼 본회의를 거치지 않고 끝나는 경우.',
        minutes: 5,
        related: [
            { href: '/guide/glossary#sec-bill-result', label: '용어 · 법안 처리 결과' },
            { href: '/bill', label: '법안 목록' },
        ],
    },
    {
        slug: 'proposing-is-not-contribution',
        title: '대표발의와 공동발의, 그리고 건수가 말하지 않는 것',
        sub: '발의 887건은 무엇을 센 숫자인가',
        desc: '대표발의는 법안을 낸 것, 공동발의는 이름을 올린 것. 두 숫자가 왜 따로 있어야 하는지, 왜 건수 순위표가 이 사이트에 없는지, 특화 분야는 건수가 아니라 배수로 보는 이유.',
        minutes: 4,
        related: [
            { href: '/politician', label: '의원 목록' },
            { href: '/xray#xr-propose', label: '차트 · 발의 vs 가결' },
        ],
    },
    {
        slug: 'party-line-or-bill',
        title: '당을 보고 찍나, 법안을 보고 찍나',
        sub: '자당·타당 찬성률 격차를 읽는 법',
        desc: '자기 정당이 낸 법안과 상대 정당이 낸 법안에 대한 찬성률 차이. 격차 0~2%p 는 무슨 뜻이고 10%p 이상은 무슨 뜻인지, 그리고 이 숫자를 정당끼리 비교하면 안 되는 이유.',
        minutes: 5,
        related: [
            { href: '/xray#xr-gapdist', label: '차트 · 당을 보나, 법안을 보나' },
            { href: '/politician?sort=gap-desc', label: '의원 목록 · 당 성향 뚜렷한 순' },
        ],
    },
    {
        slug: 'how-we-place-politicians',
        title: '의원 성향 좌표는 어떻게 만들었나',
        sub: '그리고 무엇을 재지 못하는가',
        desc: '표결이 아니라 공동발의 서명으로 좌표를 만드는 이유, 법안마다 방향을 붙이는 방식, 안보축을 아예 만들지 않은 이유, 불참으로 드러낸 입장이 빠져 있다는 한계까지.',
        minutes: 6,
        related: [
            { href: '/balance-game', label: '성향 진단' },
            { href: '/balance-game/types', label: '성향 유형 9종' },
        ],
    },
    {
        slug: 'abstain-vs-absent',
        title: '기권과 불참은 다르다',
        sub: '표결 참여율을 읽을 때 먼저 갈라야 하는 것',
        desc: '기권은 표결에 참여해 어느 쪽도 고르지 않은 것, 불참은 그 표결에 없었던 것. 왜 둘을 다른 분모로 세는지, 불참률이 높다고 태만이라 부르지 않는 이유, 국회의장과 장관은 왜 비교에서 빼는지.',
        minutes: 4,
        related: [
            { href: '/xray#xr-absent', label: '차트 · 불참률' },
            { href: '/guide/glossary#vote-absent', label: '용어 · 불참' },
        ],
    },
    {
        slug: 'committee-speech-rate',
        title: '상임위는 왜 안 보였나',
        sub: '회의 발언 기록과 참여율을 읽는 법',
        desc: '법안이 실제로 걸러지는 곳은 위원회인데, 발의·표결 지표는 전부 본회의 기준이다. 회의 발언 기록으로 상임위를 보는 방법, 질의석과 위원장석을 나누는 이유, 참여율이 실제보다 후한 값인 이유.',
        minutes: 5,
        related: [
            { href: '/politician', label: '의원 목록' },
            { href: '/guide/glossary#cmt-rate', label: '용어 · 상임위 회의 참여율' },
        ],
    },
    {
        slug: 'how-far-to-trust-ai',
        title: 'AI 가 쓴 브리핑과 분석, 어디까지 믿을 수 있나',
        sub: '숫자는 AI 가 만들지 않는다, 그리고 그래도 남는 것',
        desc: '매일 아침 브리핑과 법안 분석은 AI 가 쓴다. 숫자는 집계값만 쓰고 AI 에게서 받지 않는 이유, 정당 평가를 걸러내는 검사, 그래도 틀릴 수 있어 원문을 옆에 두는 이유. 무엇을 믿고 무엇을 의심해야 하는지.',
        minutes: 5,
        related: [
            { href: '/briefing', label: '국회 브리핑' },
            { href: '/bill?has_analysis=Y', label: 'AI 분석이 있는 법안' },
        ],
    },
];

export const guideBySlug = (slug) => GUIDE_ARTICLES.find((a) => a.slug === slug) || null;

/* 이전/다음 — 목록 순서 기준 */
export const guideNeighbors = (slug) => {
    const i = GUIDE_ARTICLES.findIndex((a) => a.slug === slug);
    if (i < 0) return { prev: null, next: null };
    return {
        prev: i > 0 ? GUIDE_ARTICLES[i - 1] : null,
        next: i < GUIDE_ARTICLES.length - 1 ? GUIDE_ARTICLES[i + 1] : null,
    };
};
