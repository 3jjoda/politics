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
//   kicker  카드 상단 작은 라벨 (지표 분류)
//   title   카드 제목
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
        kicker: '표결 합의 분포',
        title: '국회는 얼마나 싸우는가',
        desc: '본회의 표결이 이뤄진 법안의 찬성률 분포입니다. 뉴스는 싸우는 법안만 보여주지만, 실제 분포는 다릅니다.',
        loader: 'consensus', partial: 'xray/sections/consensus'
    },
    {
        id: 'dissent', group: 'voting',
        kicker: '당론 이탈',
        title: '소신 표결',
        desc: '소속 정당 다수의 선택과 다르게 투표한 비율입니다. 이탈이 곧 좋고 나쁨은 아닙니다.',
        loader: 'dissent', partial: 'xray/sections/dissent'
    },
    {
        id: 'absent', group: 'voting',
        kicker: '본회의 참여',
        title: '표결 불참률',
        desc: '본회의 표결 기록에서 불참으로 기록된 비율입니다.',
        loader: 'absent', partial: 'xray/sections/absent'
    },

    /* ── 발의 ── */
    {
        id: 'propose', group: 'proposal',
        kicker: '발의 산점도',
        title: '발의왕 vs 입법왕',
        desc: '많이 발의하는 의원과 통과시키는 의원은 다릅니다. 대표발의 건수와 가결된 비율을 함께 봅니다.',
        loader: 'propose', partial: 'xray/sections/propose'
    },
    {
        id: 'crossparty', group: 'proposal',
        kicker: '공동발의 네트워크',
        title: '초당적 협력',
        desc: '2개 이상 정당이 함께 이름을 올린 법안 비율과, 다른 당 법안에 가장 많이 서명한 의원입니다.',
        loader: 'crossparty', partial: 'xray/sections/crossparty'
    },
    {
        id: 'leader', group: 'proposal',
        kicker: '발의 스타일',
        title: '주도자 vs 서명러',
        desc: '발의 건수 랭킹의 착시를 벗깁니다. 남의 법안에 서명한 공동발의와 직접 주도한 대표발의를 나눠 봅니다.',
        loader: 'leader', partial: 'xray/sections/leader'
    },

    /* ── 법안 ── */
    {
        id: 'funnel', group: 'lifecycle',
        kicker: '생존율 깔때기',
        title: '법안 생존율',
        desc: '발의부터 가결까지 단계마다 얼마나 걸러지는지 봅니다. 위원회별 처리율도 함께.',
        loader: 'funnel', partial: 'xray/sections/funnel'
    },
    {
        id: 'monthly', group: 'lifecycle',
        kicker: '월별 발의 추이',
        title: '발의는 쌓이고, 처리는 밀린다',
        desc: '달마다 몇 건이 발의되고 그중 몇 %가 처리됐는지 봅니다. 최근 법안이 가결되지 않은 건 아직 심사 중이기 때문입니다.',
        loader: 'monthly', partial: 'xray/sections/monthly'
    },
    {
        id: 'category', group: 'lifecycle',
        kicker: 'AI 분석 카테고리',
        title: '국회의 관심사',
        desc: 'AI 분석이 완료된 법안의 16종 분야 분포입니다.',
        loader: 'category', partial: 'xray/sections/category'
    },

    /* ── 성향 ── */
    {
        id: 'gapdist', group: 'stance',
        kicker: '당 성향 격차',
        title: '당을 보나, 법안을 보나',
        desc: '자기 당이 낸 법안과 다른 당이 낸 법안에 찬성하는 비율의 차이입니다. 의원 상세의 순위가 이 분포 위에서 나옵니다.',
        loader: 'gapdist', partial: 'xray/sections/gapdist'
    },
    {
        id: 'spectrum', group: 'stance',
        kicker: '성향 스펙트럼',
        title: '같은 당, 다른 생각',
        desc: '실제 표결로 산출한 의원 4축 좌표를 정당별로 펼쳤습니다. 한 당 안의 편차가 생각보다 클 수 있습니다.',
        loader: 'spectrum', partial: 'xray/sections/spectrum'
    },

    /* ── 국민 ── */
    {
        id: 'gap', group: 'citizen',
        kicker: '여론 괴리',
        title: '국민 vs 국회',
        desc: '당말사 이용자의 찬반 투표와 실제 본회의 표결의 찬성률 격차입니다. 우리 서비스에서만 볼 수 있는 지표입니다.',
        loader: 'gap', partial: 'xray/sections/gap'
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
            sections: (g.id === '__etc__' ? orphans : SECTIONS.filter(s => s.group === g.id))
                .map(s => ({ ...s, no: String(++n).padStart(2, '0') }))
        }))
        .filter(g => g.sections.length > 0);
}

export const XRAY_GROUPED = build();

/* 평면 목록 — 번호는 위에서 매긴 값을 그대로 승계 */
export const XRAY_SECTIONS = XRAY_GROUPED.flatMap(g => g.sections);

const BY_ID = new Map(XRAY_SECTIONS.map(s => [s.id, s]));

export function getSection(id) {
    return BY_ID.get(id) || null;
}

export default XRAY_SECTIONS;
