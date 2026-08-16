// services/xraySections.js — "숫자로 본 국회" 섹션/그룹 레지스트리 (단일 소스)
//
// 섹션 추가 = 아래 SECTIONS 에 한 줄 + views/xray/sections/<id>.ejs + XrayService 의 로더 하나.
// 그룹 추가 = GROUPS 에 한 줄. 둘 다 xray.ejs 는 손대지 않는다.
//
// 이전에는 섹션 정보가 세 곳(xray.ejs 의 배열 / 667줄 본문 / XrayService 의 Promise.all)에 흩어져
// 하나 끼워넣을 때마다 세 곳을 고치고 번호를 손으로 다시 매겨야 했다.
//
// 필드
//   id      URL 조각·DOM id·해시 키. `/xray/s/:id`, `#xr-<id>`
//   group   GROUPS 의 id. 오타로 매칭 안 되면 "기타" 그룹으로 밀리고 경고가 찍힌다
//   title   카드 제목. 🔴 kicker(작은 분류 라벨)는 2026-08-15 제거 —
//           제목 앞에 붙은 요약이 오히려 시선을 나눠서, 제목이 혼자 무슨 차트인지 말하게 했다.
//           ⚠️ 3열 그리드에서 한 줄에 들어가야 한다 (16자 내외). 길면 카드가 2줄로 커진다
//           ⚠️ 제목에 숫자를 박지 말 것 — 데이터가 쌓이면 조용히 거짓이 된다
//   desc    접힌 상태에서 보이는 한 줄 설명 (2행 클램프)
//   loader  XrayService.SECTION_LOADERS 의 키
//   partial 펼쳤을 때 렌더할 EJS 조각 (views/ 기준)
//
// ⚠️ 번호(no)는 **그룹 순서 → 그룹 내 순서** 로 자동 부여된다. 배열 어디에 끼워넣어도 손댈 곳이 없다.

import logger from '../utils/logger.js';

/* 그룹 — 순서가 화면 표시 순서 */
export const XRAY_GROUPS = [
    { id: 'voting',    label: '표결', desc: '본회의에서 실제로 어떻게 투표했는가' },
    { id: 'proposal',  label: '발의', desc: '법안을 누가 만들고 누가 서명하는가' },
    { id: 'lifecycle', label: '법안', desc: '발의된 법안이 어디까지 가는가' },
    { id: 'stance',    label: '성향', desc: '표결로 드러나는 정치 성향의 분포' },
    { id: 'citizen',   label: '국민', desc: '국민의 판단과 국회의 결정' }
];

const SECTIONS = [
    /* ── 표결 ── */
    {
        id: 'consensus', group: 'voting',
        title: '본회의 표결, 얼마나 갈리나',
        desc: '본회의 표결이 이뤄진 법안의 찬성률 분포입니다. 뉴스는 싸우는 법안만 보여주지만, 실제 분포는 다릅니다.',
        loader: 'consensus', partial: 'xray/sections/consensus'
    },
    {
        id: 'dissent', group: 'voting',
        title: '당론과 다르게 투표한 의원',
        desc: '소속 정당 다수의 선택과 다르게 투표한 비율입니다. 이탈이 곧 좋고 나쁨은 아닙니다.',
        loader: 'dissent', partial: 'xray/sections/dissent'
    },
    {
        id: 'absent', group: 'voting',
        title: '본회의 표결에 빠진 비율',
        desc: '본회의 표결 기록에서 불참으로 기록된 비율입니다.',
        loader: 'absent', partial: 'xray/sections/absent'
    },

    /* ── 발의 ── */
    {
        id: 'propose', group: 'proposal',
        title: '많이 낸 의원과 통과시킨 의원',
        desc: '많이 발의하는 의원과 통과시키는 의원은 다릅니다. 대표발의 건수와 가결된 비율을 함께 봅니다.',
        loader: 'propose', partial: 'xray/sections/propose'
    },
    {
        id: 'crossparty', group: 'proposal',
        title: '여러 당이 함께 낸 법안',
        desc: '2개 이상 정당이 함께 이름을 올린 법안 비율과, 다른 당 법안에 가장 많이 서명한 의원입니다.',
        loader: 'crossparty', partial: 'xray/sections/crossparty'
    },
    {
        id: 'leader', group: 'proposal',
        title: '이름만 올렸나, 직접 냈나',
        desc: '발의 건수 랭킹의 착시를 벗깁니다. 남의 법안에 서명한 공동발의와 직접 주도한 대표발의를 나눠 봅니다.',
        loader: 'leader', partial: 'xray/sections/leader'
    },

    /* ── 법안 ── */
    {
        id: 'funnel', group: 'lifecycle',
        title: '발의부터 가결까지 남는 비율',
        desc: '발의부터 가결까지 단계마다 얼마나 걸러지는지 봅니다. 위원회별 처리율도 함께.',
        loader: 'funnel', partial: 'xray/sections/funnel'
    },
    {
        id: 'monthly', group: 'lifecycle',
        title: '발의는 쌓이고, 처리는 밀린다',
        desc: '달마다 몇 건이 발의되고 그중 몇 %가 처리됐는지 봅니다. 최근 법안이 가결되지 않은 건 아직 심사 중이기 때문입니다.',
        loader: 'monthly', partial: 'xray/sections/monthly'
    },
    {
        id: 'category', group: 'lifecycle',
        title: '국회가 많이 다룬 분야',
        desc: 'AI 분석이 완료된 법안의 16종 분야 분포입니다.',
        loader: 'category', partial: 'xray/sections/category'
    },

    /* ── 성향 ── */
    {
        id: 'gapdist', group: 'stance',
        title: '당을 보나, 법안을 보나',
        desc: '자기 당이 낸 법안과 다른 당이 낸 법안에 찬성하는 비율의 차이입니다. 의원 상세의 순위가 이 분포 위에서 나옵니다.',
        loader: 'gapdist', partial: 'xray/sections/gapdist'
    },
    {
        id: 'ratedist', group: 'stance',
        title: '자당 법안엔 예외가 없다',
        desc: '자기 당 법안과 다른 당 법안에 찬성한 비율을 각각 분포로 폈습니다. 위 격차가 두 값의 차이라면, 이건 그 값 자체입니다.',
        loader: 'ratedist', partial: 'xray/sections/ratedist'
    },
    {
        id: 'spectrum', group: 'stance',
        title: '같은 당 안에서도 갈린다',
        desc: '공동발의 기록으로 산출한 의원 성향 좌표(경제·사회·정치제도)를 정당별로 펼쳤습니다. 한 당 안의 편차가 생각보다 클 수 있습니다.',
        loader: 'spectrum', partial: 'xray/sections/spectrum'
    },

    /* ── 국민 ── */
    {
        id: 'gap', group: 'citizen',
        title: '국민 찬반과 국회 표결',
        desc: '당말사 이용자의 찬반 투표와 실제 본회의 표결의 찬성률 격차입니다. 우리 서비스에서만 볼 수 있는 지표입니다.',
        loader: 'gap', partial: 'xray/sections/gap'
        /* 🔴 **데이터가 없어도 목록에 남긴다. `hidden` 을 붙이지 말 것** (2026-08-16).
              `bill_citizen_votes` 가 비어 있어 지금은 빈 카드지만, 이용자가 찬반 투표를 시작하면
              **저절로 채워진다.** 한 번 숨기면 그때 누군가 기억해서 수동으로 풀어야 하는데
              그건 잊힌다 — 조용히 없는 기능이 되는 쪽이 빈 카드보다 나쁘다.
           ⚠️ 그래서 빈 상태 문구가 중요하다: 왜 비었는지 + 어떻게 채우는지를 말해야
              "고장" 이 아니라 "아직" 으로 읽힌다 (views/xray/sections/gap.ejs) */
    }
];

/* 그룹 순서대로 묶고, 그 순서대로 전역 번호를 매긴다.
   group 오타 등으로 어디에도 못 들어간 섹션이 조용히 사라지면 안 되므로 "기타"로 모아 노출 + 경고. */
function build() {
    const known = new Set(XRAY_GROUPS.map(g => g.id));
    const orphans = SECTIONS.filter(s => !known.has(s.group));
    if (orphans.length > 0) {
        logger.warn(`X레이 섹션 그룹 미매칭 ${orphans.length}건 — "기타"로 표시됨: ${orphans.map(s => `${s.id}(group=${s.group})`).join(', ')}`);
    }

    const defs = [...XRAY_GROUPS];
    if (orphans.length > 0) defs.push({ id: '__etc__', label: '기타', desc: '분류가 지정되지 않은 지표' });

    let n = 0;
    return defs
        .map(g => ({
            ...g,
            /* 🔴 **섹션을 목록에서 감추는 장치를 두지 않는다** (2026-08-16에 `hidden` 플래그를 넣었다 뺐다).
               데이터가 아직 없는 지표(`gap`)를 숨겼더니, 데이터가 생겨도 **누군가 기억해서
               수동으로 풀어야** 하는 상태가 됐다. 그건 잊힌다 — 조용히 없는 기능이 되는 쪽이
               빈 카드보다 나쁘다. 빈 지표는 감추지 말고 **빈 상태 문구로** 설명할 것 */
            sections: (g.id === '__etc__' ? orphans : SECTIONS.filter(s => s.group === g.id))
                .map(s => ({ ...s, no: String(++n).padStart(2, '0') }))
        }))
        .filter(g => g.sections.length > 0);
}

export const XRAY_GROUPED = build();

/* 평면 목록 — 번호는 위에서 매긴 값을 그대로 승계 */
export const XRAY_SECTIONS = XRAY_GROUPED.flatMap(g => g.sections);

/* 조회는 원본 SECTIONS 기준 — 그룹 매칭에 실패한 섹션도 `/xray/s/:id` 로는 열린다 */
const BY_ID = new Map(SECTIONS.map(s => [s.id, s]));

export function getSection(id) {
    return BY_ID.get(id) || null;
}

export default XRAY_SECTIONS;
