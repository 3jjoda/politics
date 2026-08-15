// utils/gapBands.js — 자당·타당 찬성률 격차의 구간 정의
//
// 🔴 **단일 소스다.** 의원 목록의 격차 필터(`#pol-gap-filter`)와 의원 상세의 격차 눈금이 **같은 값을
//    써야 한다.** 어긋나면 상세에서 "뚜렷한 편" 이라고 써놓고 목록의 `뚜렷한 편` 필터에는 안 잡히는
//    상황이 생긴다 — 사용자는 둘 중 뭐가 틀렸는지 알 방법이 없다.
//    (구간을 손대려면 두 화면을 같이 확인할 것. 목록의 `<option>` 은 이 배열에서 렌더된다)
//
// 경계 2 / 5 / 10 은 2026-08-05 목록 필터에서 정한 값을 그대로 승계했다.
// 실측 분포 (in_cohort 266명, 2026-08-15):
//     법안 중심 100명(37.6%) · 중간 75명(28.2%) · 뚜렷한 편 62명(23.3%) · 매우 뚜렷 29명(10.9%)
//   → 네 구간 모두 표본이 충분하다. 경계를 옮기면 이 균형이 깨지니 실측부터 다시 할 것.
//
// ⚠️ 구간 이름은 **서술이지 평가가 아니다.** `법안 중심 ↔ 매우 뚜렷` 은 "어느 쪽이 낫다" 가 아니라
//    "표결이 정당을 따라 갈렸는가" 를 말한다. 다수당·소수당은 의사일정 구조가 달라 격차가 구조적으로
//    다르게 나오므로, 좋다/나쁘다로 읽히는 말(성실·소신·거수기 등)을 절대 쓰지 말 것.

/* min 이상 ~ max 미만. 마지막 구간의 max 는 null(상한 없음).
   filterKey 는 목록 필터의 `<option value>` 와 같아야 한다.

   🔴 `meaning`·`sentence` 는 장식이 아니다. 구간 이름 넷 중 **의미를 담은 건 `법안 중심` 하나뿐**이고
      나머지 셋(`중간`·`뚜렷한 편`·`매우 뚜렷`)은 **세기만 말할 뿐 무엇이 뚜렷한지를 말하지 않는다.**
      목록 필터에서는 select 자체가 `당 성향:` 이라 문맥이 잡히지만 상세에는 그 문맥이 없다.
      → 이름 옆에 항상 뜻을 같이 낼 것. 이름만 남기지 말 것. */
export const GAP_BANDS = [
    { key: 'lt2',   min: 0,  max: 2,    name: '법안 중심',  filterKey: 'lt2',
      meaning: '거의 차이 없음',   sentence: '자당·타당 법안을 거의 같게 대했습니다' },
    { key: 'b2_5',  min: 2,  max: 5,    name: '중간',       filterKey: 'lt5',
      meaning: '조금 더 찬성',     sentence: '자당 법안에 조금 더 찬성했습니다' },
    { key: 'b5_10', min: 5,  max: 10,   name: '뚜렷한 편',  filterKey: 'gte5',
      meaning: '뚜렷하게 더 찬성', sentence: '자당 법안에 뚜렷하게 더 찬성했습니다' },
    { key: 'gte10', min: 10, max: null, name: '매우 뚜렷',  filterKey: 'gte10',
      meaning: '크게 더 찬성',     sentence: '자당 법안에 크게 더 찬성했습니다' },
];

/* 이 지표가 무엇을 재는지 — 구간표 머리에 반드시 붙인다 */
export const GAP_AXIS_LABEL = '당 성향의 세기';
export const GAP_AXIS_DESC  = '자당 법안을 타당 법안보다 얼마나 더 지지했는지';

/* 격차(%p) → 구간. ⚠️ 음수(실측 12명)는 0 미만이라 첫 구간으로 접는다 —
   "타당 법안에 오히려 더 찬성" 이지만 그것도 '정당을 안 따랐다' 는 뜻이라 `법안 중심` 이 맞다. */
export const gapBandOf = (gap) => {
    if (gap == null || Number.isNaN(gap)) return null;
    const v = Number(gap);
    return GAP_BANDS.find((b) => v < (b.max ?? Infinity)) || GAP_BANDS[GAP_BANDS.length - 1];
};

/* 화면용 범위 문구 — `0~2%p` / `10%p 이상` */
export const gapBandRange = (b) => (b.max === null ? `${b.min}%p 이상` : `${b.min}~${b.max}%p`);
