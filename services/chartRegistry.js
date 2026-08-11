// services/chartRegistry.js — 커스텀 차트 빌더의 화이트리스트 레지스트리 (단일 소스)
//
// ⚠️ 보안 원칙: **사용자가 보낸 문자열은 절대 SQL 에 닿지 않는다.**
//    사용자는 아래에 등록된 "키" 만 고를 수 있고, SQL 조각은 전부 이 파일의 상수다.
//    필터 "값" 만 파라미터 바인딩($1, $2 …)으로 들어간다.
//    ⚠️ 아래 sql 문자열에 변수를 템플릿 리터럴로 끼워넣지 말 것 — 이게 유일한 방어선이다.
//
// ⚠️ 해석 주의(note)는 장식이 아니다. 사용자가 만든 차트가 그대로 공유되므로,
//    표본 편향이 있는 지표는 차트에 각주가 자동으로 붙어야 오독의 근거가 되지 않는다.
//
// 구조: 축·지표·필터는 **소스별로** sql 과 join 이 다르다 (`per` 객체).
//       `per` 에 그 소스 키가 없으면 그 소스에서는 선택지에 뜨지 않는다.

/* ── 데이터 소스 ──
   base 테이블이 다르면 조인 대상도 달라진다 (법안 기준 = 대표발의자 / 표결 기준 = 표결한 의원). */
export const SOURCES = [
    {
        id: 'bills', label: '법안', kicker: '18,692건',
        from: 'FROM bills b',
        joins: {
            politicians: 'LEFT JOIN politicians p ON p.mona_cd = b.mona_cd',   // 대표발의자
            analysis: 'LEFT JOIN bill_ai_analysis a ON a.bill_id = b.bill_id',
        },
    },
    {
        id: 'votes', label: '본회의 표결', kicker: '177,260건',
        from: 'FROM bill_votes v',
        joins: {
            politicians: 'LEFT JOIN politicians p ON p.mona_cd = v.mona_cd',   // 표결한 의원
            bills: 'LEFT JOIN bills b ON b.bill_id = v.bill_id',
            analysis: 'LEFT JOIN bill_ai_analysis a ON a.bill_id = v.bill_id',
        },
        // 표결 기록은 남아있지만 politicians 에 없는 의원(퇴임·사직 등)이 3,348행 있다.
        // 숨기지 않고 '기타/무소속' 으로 묶어 보여준다 — 빼면 합이 안 맞아 더 헷갈린다.
        note: '표결 기록은 있으나 현직 명부에 없는 의원(퇴임·사직 등) 3,348건은 "명부 없음" 으로 묶입니다. '
            + '실제 정당인 "무소속" 과는 다릅니다.',
    },
];

// ⚠️ 폴백 라벨을 '기타/무소속' 으로 쓰면 **실제 정당인 '무소속' 과 나란히 떠서 구분이 안 된다**
//    (표결 소스 실측: 무소속 99.2% / 기타/무소속 98.4% — 사용자가 둘을 구별할 방법이 없다).
//    빌더에서는 '명부 없음' 으로 명시한다. `/bill?party=` 필터의 라벨과 다른 건 의도된 것.
const PARTY_SQL = `COALESCE(NULLIF(p.party_name, ''), '명부 없음')`;

/* ── 가를 축 (x) ── */
export const DIMENSIONS = [
    {
        id: 'party', label: '정당',
        note: '의석수가 정당마다 다릅니다. 절대 건수를 그대로 비교하면 오해가 됩니다.',
        per: {
            bills: { sql: PARTY_SQL, joins: ['politicians'] },
            votes: { sql: PARTY_SQL, joins: ['politicians'] },
        },
    },
    {
        id: 'committee', label: '위원회',
        note: '아직 회부되지 않은 법안은 제외됩니다.',
        per: {
            bills: { sql: `NULLIF(b.committee, '')`, joins: [] },
            votes: { sql: `NULLIF(b.committee, '')`, joins: ['bills'] },
        },
    },
    {
        id: 'proc_result', label: '처리 결과',
        per: {
            bills: { sql: `COALESCE(NULLIF(b.proc_result_name, ''), '계류')`, joins: [] },
            votes: { sql: `COALESCE(NULLIF(b.proc_result_name, ''), '계류')`, joins: ['bills'] },
        },
    },
    {
        id: 'month', label: '발의 월', timeLike: true,
        note: '최근 달일수록 아직 심사 중인 법안이 많아 처리 관련 지표가 낮게 나옵니다.',
        per: {
            bills: { sql: `TO_CHAR(b.propose_dt, 'YYYY-MM')`, joins: [] },
            votes: { sql: `TO_CHAR(b.propose_dt, 'YYYY-MM')`, joins: ['bills'] },
        },
    },
    {
        id: 'vote_month', label: '표결 월', timeLike: true,
        per: { votes: { sql: `TO_CHAR(v.vote_date, 'YYYY-MM')`, joins: [] } },
    },
    {
        id: 'vote_result', label: '표결 결과',
        per: { votes: { sql: `v.vote_result`, joins: [] } },
    },
    {
        id: 'member', label: '의원',
        note: '표결 수가 많은 의원 순으로 잘립니다 — 전체 의원이 다 나오지 않습니다.',
        per: { votes: { sql: `p.name`, joins: ['politicians'] } },
    },
    {
        id: 'stage', label: '처리 단계',
        per: {
            bills: {
                sql: `CASE WHEN b.proc_dt IS NOT NULL THEN '본회의 처리'
                           WHEN b.law_proc_dt IS NOT NULL THEN '법사위 통과'
                           WHEN b.cmt_proc_dt IS NOT NULL THEN '위원회 처리'
                           WHEN b.committee_dt IS NOT NULL THEN '위원회 심사 중'
                           ELSE '회부 전' END`,
                joins: [],
            },
        },
    },
    {
        id: 'ai_category', label: 'AI 주제',
        note: 'AI 분석이 끝난 법안만 집계됩니다 — 전체의 일부입니다.',
        per: {
            bills: { sql: `a.category_main`, joins: ['analysis'] },
            votes: { sql: `a.category_main`, joins: ['analysis'] },
        },
    },
    {
        id: 'sex', label: '의원 성별',
        note: '국회 구성 자체가 성비가 다릅니다. 건수 비교는 인원 차이를 반영하지 않습니다.',
        per: {
            bills: { sql: `NULLIF(p.sex_gbn_nm, '')`, joins: ['politicians'] },
            votes: { sql: `NULLIF(p.sex_gbn_nm, '')`, joins: ['politicians'] },
        },
    },
    {
        id: 'reele', label: '선수(選數)',
        note: '선수별 인원수가 다릅니다.',
        per: {
            bills: { sql: `NULLIF(p.reele_gbn_nm, '')`, joins: ['politicians'] },
            votes: { sql: `NULLIF(p.reele_gbn_nm, '')`, joins: ['politicians'] },
        },
    },
];

/* ── 잴 지표 (y) ── */

// 찬성/반대/기권 = "표결에 참여한 것". 불참을 분모에 넣으면 성향과 성실성이 섞인다.
// (교차 표결 지표에서 이미 쓰는 기준 — CLAUDE.md "불참 제외" 참조)
const VOTED = `COUNT(*) FILTER (WHERE v.vote_result IN ('찬성','반대','기권'))`;

export const MEASURES = [
    {
        id: 'count', label: '건수', unit: '건',
        per: { bills: { sql: `COUNT(*)::numeric` }, votes: { sql: `COUNT(*)::numeric` } },
    },
    {
        id: 'avg_cosign', label: '평균 공동발의자', unit: '명',
        note: '이름을 얼마나 걸었는지일 뿐, 법안의 중요도와는 다릅니다.',
        per: { bills: { sql: `ROUND(AVG(b.co_proposer_count)::numeric, 1)` } },
    },
    {
        id: 'pass_rate', label: '가결률', unit: '%',
        note: '분모는 처리가 끝난 법안입니다. 계류 중인 법안은 결과가 없으므로 제외됩니다.',
        per: {
            bills: {
                sql: `ROUND(100.0 * COUNT(*) FILTER (WHERE b.proc_result_name IN ('원안가결','수정가결'))
                            / NULLIF(COUNT(*) FILTER (WHERE b.proc_result_name IS NOT NULL AND b.proc_result_name <> ''), 0), 1)`,
            },
        },
    },
    {
        id: 'avg_days', label: '평균 처리 소요일', unit: '일',
        // ⚠️ 이 빌더에서 가장 오독되기 쉬운 지표. 각주를 반드시 붙일 것.
        note: '처리가 끝난 법안만 계산됩니다. 오래 걸리는 법안일수록 아직 계류 중일 가능성이 높아(전체의 76%), '
            + '실제보다 짧게 나오는 생존 편향이 있습니다.',
        per: { bills: { sql: `ROUND(AVG(b.proc_dt - b.propose_dt)::numeric)` } },
    },
    {
        id: 'pending_rate', label: '계류 비율', unit: '%',
        note: '최근 발의된 법안일수록 계류 비율이 높은 것은 자연스러운 현상입니다.',
        per: {
            bills: {
                sql: `ROUND(100.0 * COUNT(*) FILTER (WHERE b.proc_result_name IS NULL OR b.proc_result_name = '')
                            / NULLIF(COUNT(*), 0), 1)`,
            },
        },
    },
    /* ── 표결 전용 ── */
    {
        id: 'agree_rate', label: '찬성률', unit: '%',
        // 각주는 텍스트 그대로 출력된다 — 마크다운 표기(**)를 쓰면 별표가 그대로 보인다
        note: '분모에서 불참을 뺐습니다(찬성·반대·기권만). 불참을 넣으면 "성향" 과 "출석" 이 섞여 '
            + '출석률 낮은 쪽의 찬성률이 같이 깎입니다. 참고로 전체 표결의 74%가 찬성이라 값이 대체로 높게 나옵니다.',
        per: { votes: { sql: `ROUND(100.0 * COUNT(*) FILTER (WHERE v.vote_result = '찬성') / NULLIF(${VOTED}, 0), 1)` } },
    },
    {
        id: 'oppose_rate', label: '반대·기권률', unit: '%',
        note: '분모에서 불참을 뺐습니다. 반대·기권은 전체의 2%뿐이라 표본이 적은 그룹은 크게 흔들립니다.',
        per: { votes: { sql: `ROUND(100.0 * COUNT(*) FILTER (WHERE v.vote_result IN ('반대','기권')) / NULLIF(${VOTED}, 0), 1)` } },
    },
    {
        id: 'absent_rate', label: '불참률', unit: '%',
        note: '불참에는 본회의 불참뿐 아니라 사·보임, 해외출장 등도 섞여 있습니다. 성실성의 직접 지표가 아닙니다.',
        per: { votes: { sql: `ROUND(100.0 * COUNT(*) FILTER (WHERE v.vote_result = '불참') / NULLIF(COUNT(*), 0), 1)` } },
    },
];

/* ── 필터 ──
   sql 의 `$` 자리에 파라미터 번호가 채워진다 (ChartDao). 값은 항상 바인딩. */
export const FILTERS = [
    {
        id: 'party', label: '정당', type: 'multi', optionsKey: 'parties',
        per: {
            bills: { sql: `${PARTY_SQL} = ANY($)`, joins: ['politicians'] },
            votes: { sql: `${PARTY_SQL} = ANY($)`, joins: ['politicians'] },
        },
    },
    {
        id: 'committee', label: '위원회', type: 'multi', optionsKey: 'committees',
        per: {
            bills: { sql: `b.committee = ANY($)`, joins: [] },
            votes: { sql: `b.committee = ANY($)`, joins: ['bills'] },
        },
    },
    {
        id: 'vote_result', label: '표결 결과', type: 'enum',
        options: [
            { value: '찬성', label: '찬성' }, { value: '반대', label: '반대' },
            { value: '기권', label: '기권' }, { value: '불참', label: '불참' },
        ],
        per: { votes: { sql: `v.vote_result = $`, joins: [] } },
    },
    {
        id: 'has_analysis', label: 'AI 분석', type: 'enum',
        options: [{ value: 'Y', label: '분석 있음' }, { value: 'N', label: '분석 없음' }],
        cast: (v) => v === 'Y',
        per: {
            bills: { sql: `(a.bill_id IS NOT NULL) = $`, joins: ['analysis'] },
            votes: { sql: `(a.bill_id IS NOT NULL) = $`, joins: ['analysis'] },
        },
    },
    {
        id: 'from', label: '시작일', type: 'date',
        per: {
            bills: { sql: `b.propose_dt >= $`, joins: [] },
            votes: { sql: `v.vote_date >= $`, joins: [] },      // 표결 소스에서는 표결일 기준
        },
    },
    {
        id: 'to', label: '종료일', type: 'date',
        per: {
            bills: { sql: `b.propose_dt <= $`, joins: [] },
            votes: { sql: `v.vote_date <= $`, joins: [] },
        },
    },
];

export const CHART_TYPES = [
    { id: 'bar', label: '세로 막대' },
    { id: 'hbar', label: '가로 막대' },
    { id: 'line', label: '선 그래프', timeOnly: true },
    { id: 'donut', label: '도넛' },
];

export const SORTS = [
    { id: 'value_desc', label: '값 큰 순' },
    { id: 'value_asc', label: '값 작은 순' },
    { id: 'label_asc', label: '이름·시간 순' },
];

/* 결과 행 상한 — 축 최대 카디널리티(의원 305)를 감안하되 무한대는 아니게 */
export const ROW_LIMIT = 60;
/* 이보다 표본이 적은 그룹은 "표본 적음" 으로 표시한다 (숨기지는 않는다 — 숨기면 그것도 왜곡) */
export const SMALL_SAMPLE = 5;

const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
export const SOURCE_MAP = byId(SOURCES);
export const DIM_MAP = byId(DIMENSIONS);
export const MEASURE_MAP = byId(MEASURES);
export const FILTER_MAP = byId(FILTERS);
export const TYPE_IDS = new Set(CHART_TYPES.map((t) => t.id));
export const SORT_IDS = new Set(SORTS.map((s) => s.id));

/* 소스에서 쓸 수 있는 것만 골라준다 (화면 select 구성 + 검증에 공용) */
export const dimsFor = (src) => DIMENSIONS.filter((d) => d.per[src]);
export const measuresFor = (src) => MEASURES.filter((m) => m.per[src]);
export const filtersFor = (src) => FILTERS.filter((f) => f.per[src]);

/* 소스별 기본 스펙 — 빈 화면 대신 바로 뭔가 보이게 (빈 캔버스 문제 회피) */
export const DEFAULTS = {
    bills: { x: 'committee', y: 'count', type: 'hbar', sort: 'value_desc' },
    votes: { x: 'party', y: 'agree_rate', type: 'hbar', sort: 'value_desc' },
};
export const DEFAULT_SOURCE = 'bills';

export default { SOURCES, DIMENSIONS, MEASURES, FILTERS, CHART_TYPES, SORTS };
