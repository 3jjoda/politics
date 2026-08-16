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
