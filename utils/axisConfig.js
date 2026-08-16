// utils/axisConfig.js — 4축 좌표의 **버전·측정 가능 축** 단일 소스 (2026-08-16)
//
// 🔴 버전은 두 갈래다. 같은 문자열 'v1' 을 사용자·의원 양쪽이 쓰다가 갈랐다:
//   · 사용자 좌표(밸런스게임 문항 → user_axis_score)      : services/BalanceGameService.js MAPPING_VERSION = 'v1'  (그대로)
//   · 의원 좌표(법안 매핑 → politician_axis_score)         : 여기 POL_MAPPING_VERSION = 'v2'
//   사용자 쪽까지 올리면 기존 진단 결과가 통째로 안 보이게 된다.
//
// 🔴 안보축은 의원 좌표를 만들지 않는다 (MATCH_AXES 에 없다).
//   전 코퍼스 18,590건 분류에서 `자주` 방향 법안이 59건뿐 — 안보 쟁점은 법률이 아니라 대통령·정부 권한이라
//   입법 기록으로 잴 수 없다 (분할-반 신뢰도 0.52). 사용자는 안보 문항을 계속 풀지만(본인 성향 보기용),
//   의원과의 거리·순위에는 세 축만 쓴다. 화면은 그 이유를 밝혀야 한다 (UNMEASURED_REASON).
//
// 거리 = sqrt(Σ_MATCH_AXES (u−p)²) / 2 · 근사 일치도 = max(0, (1 − d/MATCH_DENOM) × 100)
//   ⚠️ 축이 4→3 이 되어 최대 거리가 2 → 1.73 으로 줄었지만 분모 1.5 는 그대로 둔다 — 화면의 주인공은
//      순위고 % 는 "근사" 보조라 스케일 보정을 다시 하지 않는다 (CLAUDE.md 「성향 일치도 로직 점검」).

export const POL_MAPPING_VERSION = 'v2';
export const ALL_AXES   = ['economy', 'social', 'security', 'institution'];
export const MATCH_AXES = ['economy', 'social', 'institution'];
export const UNMEASURED_AXES = ALL_AXES.filter(a => !MATCH_AXES.includes(a));
export const UNMEASURED_REASON = '안보·외교 쟁점은 법률이 아니라 정부 권한으로 다뤄져 국회 입법 기록에 거의 남지 않습니다. 이 축은 의원 좌표를 만들지 않고 일치도 계산에서 뺍니다.';
export const MATCH_DENOM = 1.5;
export const MIN_SIGNATURES = 5;   // 축당 이 미만이면 그 축 좌표를 내지 않는다 (calcPoliticianAxis · 분할-반 검증과 동일)

// 안보축을 왜 못 재는지 — 숫자로 말한다. 2026-08-16 전 코퍼스 분류(`bill_axis_mapping_pilot`, 18,590건) 실측값.
// ⚠️ 매핑을 재분류하면 같이 갱신할 것 (파일럿 테이블이 지워지면 이 상수만 남는다)
export const UNMEASURED_STATS = {
    security: { classified: 18590, mapped: 312, scarceDir: '자주', scarceN: 59, otherDir: '동맹', otherN: 253 },
};

// 🔴 양끝 라벨은 **긴 형(Lx/Rx)이 기본**이다. 짧은 형(L/R)은 폭이 없는 곳(홈 카드·범례)에서만 쓰고,
//    `short` 는 홈 카드처럼 폭이 없는 곳의 축 설명 한 조각(무엇을 다루는 축인지). `시장`·`안정`·`전통` 만 두면 무엇의 어느 쪽인지 안 읽힌다 (사용자 지적).
//    services/BalanceGameService.js 의 AXES(문항 화면)와 같은 어휘 — 두 곳이 갈리면 진단 화면과 의원 화면이 다른 말을 한다
export const AXIS_META = {
    economy:     { name: '경제',      L: '시장', R: '개입', Lx: '시장 자율',     Rx: '정부 개입',   short: '세제·규제·노동',      desc: '세제·규제·노동·공공성 법안에서 시장에 맡기는 쪽인가, 정부가 개입하는 쪽인가' },
    social:      { name: '사회·문화', L: '전통', R: '자율', Lx: '전통·질서',     Rx: '자율·다양성', short: '가족·형벌·이민', desc: '가족·형벌·이민·표현 등에서 질서와 전통을 지키는 쪽인가, 개인의 자율과 다양성을 넓히는 쪽인가' },
    security:    { name: '안보·외교', L: '동맹', R: '자주', Lx: '동맹·대북강경', Rx: '자주·대북대화', short: '한미동맹·대북',      desc: '한미동맹·대북 강경 쪽인가, 자주·대화 쪽인가 (입법 기록으로는 잴 수 없어 좌표 없음)' },
    institution: { name: '정치제도',  L: '안정', R: '개혁', Lx: '현 제도 유지',   Rx: '제도 개혁',   short: '검찰·선거·국회', desc: '검찰·사법·선거·국회 권한 등 권력 구조를 지금대로 두는 쪽인가, 바꾸는 쪽인가' },
};

/* ── 유형 이름 · 9종 체계 (2026-08-16, 외부 디자인 제안 2건 채택) ──
   MBTI 가 퍼진 건 "INFP" 라는 이름표 때문 — 사람들은 좌표가 아니라 이름표를 공유한다.
   경제(x) × 사회·문화(y) 사분면 이름 4종 × 강도 2단계(뚜렷 / 온건한) + 중심 1종(균형 조율자) = 9종.
   🔴 네 이름은 **똑같이 긍정적**이어야 한다 (한쪽만 멋있어 보이면 그 순간 편향이다). 정당명·이념명(보수/진보) 금지, 4~5음절 명사형.
   판정: d = √(x²+y²)  (원점 거리)
     · d < D_CENTER(0.20)                → 균형 조율자 (사분면을 따지지 않는다)
     · D_CENTER ≤ d < D_STRONG(0.55)     → 온건한 [사분면명]
     · d ≥ D_STRONG                      → [사분면명]  (수식어 없음 — 짧은 쪽이 기본값)
     · 🔴 단, 한 축이라도 |v| < AXIS_MID(0.25) 면 d 와 무관하게 **온건**으로 내린다 — 이름은 부호로 정해지므로
       경제 +0.05·사회 +0.9 인 사람을 `포용 개혁가(개입·자율)` 로 부르면 "개입" 이 거짓이 된다. 제안서 함수엔 없는 안전장치
   ⚠️ 임계값 0.20/0.55 는 "9종이 고르게 나뉜다" 는 가정값 — 응답이 쌓이면 분포를 보고 옮길 것 (한 유형에 40%+ 몰리면 공유 가치가 떨어진다)
   카드(shareCard.js) · 사이트 결과 화면(_result_axes.ejs) · 유형 안내 페이지(/balance-game/types) 가 여기 하나를 본다. */
export const D_CENTER = 0.20, D_STRONG = 0.55, AXIS_MID = 0.25;
export const TYPE_THRESHOLD = AXIS_MID;   // (구 이름 호환)

// key = `${경제 부호},${사회 부호}`  (L=−, R=+)
export const TYPE_NAMES = {
    'L,R': { name: '자유 개척자', quad: '시장 · 자율',
             sub:  '경제는 시장에, 삶의 방식은 개인에게 맡기는 쪽',
             desc: '규제를 덜고 개인의 선택지를 넓히는 방향을 지지합니다. 정부의 역할은 최소한으로, 문화적 다양성은 최대한으로 봅니다.',
             mildSub:  '시장과 자율을 선호하되 안전장치는 인정하는 쪽',
             mildDesc: '방향은 자유 개척자와 같지만 강도가 낮습니다. 시장 원리를 지지하면서도 최소한의 사회적 보호망은 필요하다고 봅니다.' },
    'R,R': { name: '포용 개혁가', quad: '개입 · 자율',
             sub:  '국가가 나서서 격차를 줄이고 다양성을 넓히는 쪽',
             desc: '공적 개입으로 불평등을 교정하고, 소수자 권리와 문화적 다양성을 함께 확대하는 방향을 지지합니다.',
             mildSub:  '복지와 다양성을 지지하되 속도는 점진적으로 보는 쪽',
             mildDesc: '개입과 다양성의 방향에 동의하지만, 변화의 폭과 속도는 사회적 합의를 거쳐 조절해야 한다고 봅니다.' },
    'L,L': { name: '자립 원칙가', quad: '시장 · 전통',
             sub:  '경제는 자유롭게, 공동체의 규범은 지키는 쪽',
             desc: '작은 정부를 지지하면서 사회의 전통적 질서와 규범은 유지되어야 한다고 봅니다. 개인의 책임을 강조합니다.',
             mildSub:  '시장과 전통을 지지하되 사안별로 유연한 쪽',
             mildDesc: '기본 방향은 시장과 질서에 있지만, 필요하다면 공적 개입이나 제도 변화도 받아들일 수 있다고 봅니다.' },
    'R,L': { name: '질서 설계자', quad: '개입 · 전통',
             sub:  '국가가 책임지고 사회의 안정을 관리하는 쪽',
             desc: '공적 개입을 통해 사회의 안정과 질서를 유지하는 방향을 지지합니다. 급격한 제도 변화보다 예측 가능성을 중시합니다.',
             mildSub:  '안정을 중시하되 변화의 필요성도 인정하는 쪽',
             mildDesc: '안정과 질서를 중시하되 변화의 필요성도 인정합니다. 제도는 신중하게, 그러나 닫아두지는 않는 태도입니다.' },
};
export const TYPE_MID = { name: '균형 조율자', quad: '중심', key: 'mid',
    sub:  '사안마다 저울질하며 한쪽으로 기울지 않는 쪽',
    desc: '진영보다 사안을 먼저 봅니다. 경제와 사회·문화 어느 축에서도 뚜렷한 편향이 없어, 법안별로 판단이 갈리는 유형입니다.' };
export const TYPE_MILD_PREFIX = '온건한 ';

// 9종 전부 (안내 페이지용) — 표시 순서: 중심 → 사분면 4 × (뚜렷, 온건)
export const TYPE_LIST = [
    { key: 'mid', zone: 'center', ...TYPE_MID, cond: `d < ${D_CENTER}` },
    ...['L,R', 'R,R', 'L,L', 'R,L'].flatMap(k => {
        const t = TYPE_NAMES[k];
        return [
            { key: k, zone: 'strong',   name: t.name, quad: t.quad, sub: t.sub, desc: t.desc, cond: `d ≥ ${D_STRONG}` },
            { key: k, zone: 'moderate', name: TYPE_MILD_PREFIX + t.name, quad: t.quad, sub: t.mildSub, desc: t.mildDesc, cond: `${D_CENTER} ≤ d < ${D_STRONG}` },
        ];
    }),
];

export function typeOf(axis) {
    const e = Number(axis && axis.economy), s = Number(axis && axis.social);
    if (!Number.isFinite(e) || !Number.isFinite(s)) return { ...TYPE_MID, zone: 'center', mild: false, d: null };
    const d = Math.hypot(e, s);
    if (d < D_CENTER) return { ...TYPE_MID, zone: 'center', mild: false, d };
    const key = `${e >= 0 ? 'R' : 'L'},${s >= 0 ? 'R' : 'L'}`;
    const t = TYPE_NAMES[key];
    const eMid = Math.abs(e) < AXIS_MID, sMid = Math.abs(s) < AXIS_MID;
    const mild = d < D_STRONG || eMid || sMid;
    const midAxis = eMid && !sMid ? '경제' : sMid && !eMid ? '사회·문화' : '';
    return {
        key, zone: mild ? 'moderate' : 'strong', mild, d, midAxis, quad: t.quad,
        base: t.name,
        name: (mild ? TYPE_MILD_PREFIX : '') + t.name,
        sub:  mild ? t.mildSub : t.sub,
        desc: (mild ? t.mildDesc : t.desc) + (midAxis ? ` ${midAxis} 축은 가운데에 가까워 이 이름을 강하게 붙이지 않았습니다.` : ''),
    };
}
