// services/ChartService.js — 커스텀 차트 스펙 검증 + 실행
//
// 스펙은 **URL 쿼리스트링에 그대로 담긴다.** 그래서 저장 테이블 없이도 링크 복사만으로 공유된다.
// (Phase B 갤러리는 이 URL 을 저장하는 것뿐이다)

import ChartDao from '../daos/ChartDao.js';
import {
    SOURCE_MAP, DIM_MAP, MEASURE_MAP, FILTER_MAP, TYPE_IDS, SORT_IDS,
    DEFAULTS, DEFAULT_SOURCE, SMALL_SAMPLE, CHART_TYPES,
    dimsFor, measuresFor, filtersFor,
} from './chartRegistry.js';

const OPTIONS_TTL_MS = 30 * 60 * 1000;   // 정당·위원회 목록은 배치가 하루 1회만 바꾼다

export default (db) => {
    const dao = ChartDao(db);
    let optionsCache = null;

    /**
     * 쿼리스트링 → 검증된 스펙. **모르는 값은 조용히 기본값으로 떨어뜨린다** (에러 페이지 대신).
     * 사용자가 URL 을 손으로 고쳐도 안전해야 하고, 링크가 깨져도 빈 화면보다 기본 차트가 낫다.
     *
     * ⚠️ 소스를 바꾸면 축·지표가 그 소스에 없을 수 있다 (예: 법안→표결 전환 시 '평균 처리 소요일').
     *    그때도 에러가 아니라 그 소스의 기본값으로 떨어뜨린다.
     */
    function parseSpec(query = {}) {
        const source = SOURCE_MAP[query.source] ? query.source : DEFAULT_SOURCE;
        const def = DEFAULTS[source];

        const x = DIM_MAP[query.x]?.per?.[source] ? query.x : def.x;
        const y = MEASURE_MAP[query.y]?.per?.[source] ? query.y : def.y;
        let type = TYPE_IDS.has(query.type) ? query.type : def.type;
        const sort = SORT_IDS.has(query.sort) ? query.sort : def.sort;

        // 선 그래프는 시간축에서만 의미가 있다 — 다른 축이면 막대로 되돌린다
        const typeDef = CHART_TYPES.find((t) => t.id === type);
        if (typeDef?.timeOnly && !DIM_MAP[x].timeLike) type = 'bar';

        const filters = {};
        for (const f of filtersFor(source)) {
            const raw = query[`f_${f.id}`];
            if (raw === undefined || raw === null || raw === '') continue;

            if (f.type === 'multi') {
                const list = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
                if (list.length) filters[f.id] = list;
            } else if (f.type === 'enum') {
                if ((f.options || []).some((o) => o.value === raw)) filters[f.id] = raw;
            } else if (f.type === 'date') {
                // YYYY-MM-DD 형태만 통과 — 바인딩이지만 형식까지 좁힌다
                if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) filters[f.id] = raw;
            }
        }
        return { source, x, y, type, sort, filters };
    }

    /* 스펙 → 공유용 쿼리스트링 (기본값은 생략해서 URL 을 짧게) */
    function toQuery(spec) {
        const def = DEFAULTS[spec.source];
        const parts = [];
        if (spec.source !== DEFAULT_SOURCE) parts.push(`source=${encodeURIComponent(spec.source)}`);
        if (spec.x !== def.x) parts.push(`x=${encodeURIComponent(spec.x)}`);
        if (spec.y !== def.y) parts.push(`y=${encodeURIComponent(spec.y)}`);
        if (spec.type !== def.type) parts.push(`type=${encodeURIComponent(spec.type)}`);
        if (spec.sort !== def.sort) parts.push(`sort=${encodeURIComponent(spec.sort)}`);
        for (const [k, v] of Object.entries(spec.filters || {})) {
            parts.push(`f_${k}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : v)}`);
        }
        return parts.join('&');
    }

    async function getOptions() {
        if (optionsCache && Date.now() - optionsCache.at < OPTIONS_TTL_MS) return optionsCache.data;
        const data = await dao.options();
        optionsCache = { at: Date.now(), data };
        return data;
    }

    return {
        parseSpec,
        toQuery,
        getOptions,

        /* 현재 소스에서 고를 수 있는 것들 — 화면 select 구성용 */
        choicesFor: (source) => ({
            dims: dimsFor(source),
            measures: measuresFor(source),
            filters: filtersFor(source),
        }),

        /* 스펙 실행 + 화면에 필요한 부가 정보(각주·표본 경고) 조립 */
        run: async (spec) => {
            const rows = await dao.run(spec);

            const src = SOURCE_MAP[spec.source];
            const dim = DIM_MAP[spec.x];
            const measure = MEASURE_MAP[spec.y];

            // 값이 NULL 인 그룹(예: 처리된 법안이 없어 평균 소요일을 못 냄)은 차트에서 빼되 개수는 알린다
            const usable = rows.filter((r) => r.value !== null);
            const dropped = rows.length - usable.length;

            const max = usable.reduce((m, r) => Math.max(m, r.value), 0);
            const total = usable.reduce((s, r) => s + r.n, 0);
            const smallSamples = usable.filter((r) => r.n < SMALL_SAMPLE).length;

            // 해석 각주 — 소스·축·지표에 걸린 것을 자동으로 모은다.
            // 사용자가 만든 차트가 그대로 공유되므로 이게 없으면 오독의 근거가 된다.
            const notes = [src.note, dim.note, measure.note].filter(Boolean);
            if (dropped > 0) notes.push(`값을 낼 수 없는 그룹 ${dropped}개는 제외했습니다 (해당 조건의 데이터가 없거나 처리 전).`);
            if (smallSamples > 0) notes.push(`표본이 ${SMALL_SAMPLE}건 미만인 그룹 ${smallSamples}개가 있습니다. 값이 크게 흔들립니다.`);
            if (rows.length >= 60) notes.push('상위 60개 그룹만 표시됩니다. 필터로 범위를 좁히면 전체를 볼 수 있습니다.');

            return { rows: usable, max, total, notes, src, dim, measure };
        },
    };
};
