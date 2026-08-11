// daos/ChartDao.js — 커스텀 차트 스펙 → 안전한 SQL 조립
//
// ⚠️ 사용자가 보낸 문자열이 SQL 에 들어가는 경로는 **없다.**
//    · 소스/축/지표/필터/정렬은 chartRegistry 의 **키로만** 지정되고, SQL 조각은 레지스트리의 상수다
//    · 필터 "값" 만 파라미터 바인딩으로 들어간다
//    · 행 수는 ROW_LIMIT 으로 잘리고, statement_timeout 으로 폭주를 막는다
//
// 소스(bills / votes)마다 base 테이블과 조인이 다르다 — 레지스트리의 `per[source]` 가 그걸 담는다.

import {
    SOURCE_MAP, DIM_MAP, MEASURE_MAP, FILTER_MAP, ROW_LIMIT,
} from '../services/chartRegistry.js';

const STATEMENT_TIMEOUT_MS = 5000;

export default (db) => ({
    /**
     * @param {{source:string, x:string, y:string, sort:string, filters:Object}} spec
     *        **검증된** 스펙만 받는다 (ChartService.parseSpec). 여기 확인은 방어용.
     */
    run: async (spec) => {
        const src = SOURCE_MAP[spec.source];
        const dim = DIM_MAP[spec.x]?.per?.[spec.source];
        const measure = MEASURE_MAP[spec.y]?.per?.[spec.source];
        if (!src || !dim || !measure) throw new Error('알 수 없는 소스·축·지표 조합');

        const needJoins = new Set([...(dim.joins || []), ...(measure.joins || [])]);
        const where = [];
        const params = [];

        for (const [key, raw] of Object.entries(spec.filters || {})) {
            const f = FILTER_MAP[key]?.per?.[spec.source];
            if (!f) continue;                        // 이 소스에 없는 필터는 무시 (에러로 만들지 않는다)
            const def = FILTER_MAP[key];
            const value = def.cast ? def.cast(raw) : raw;
            if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) continue;

            params.push(value);
            where.push(f.sql.replace('$', `$${params.length}`));
            (f.joins || []).forEach((j) => needJoins.add(j));
        }

        const joinSql = [...needJoins].map((j) => src.joins[j]).filter(Boolean).join('\n  ');

        const orderSql = {
            value_desc: 'value DESC NULLS LAST, label',
            value_asc: 'value ASC NULLS LAST, label',
            label_asc: 'label',
        }[spec.sort] || 'value DESC NULLS LAST, label';

        // 축 값이 NULL 인 그룹은 의미가 없다 (회부 전 위원회, 분석 없는 AI 주제 등) → HAVING 으로 제거
        const sql = `
            SELECT ${dim.sql}      AS label
                 , ${measure.sql}  AS value
                 , COUNT(*)::int   AS n
              ${src.from}
              ${joinSql}
             ${where.length ? 'WHERE ' + where.join('\n               AND ') : ''}
             GROUP BY 1
            HAVING ${dim.sql} IS NOT NULL
             ORDER BY ${orderSql}
             LIMIT ${ROW_LIMIT}`;

        // 폭주 방지 — 전용 커넥션에서 타임아웃을 걸고 쓴다
        const client = await db.connect();
        try {
            await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
            const { rows } = await client.query(sql, params);
            return rows.map((r) => ({
                label: String(r.label),
                value: r.value === null ? null : Number(r.value),
                n: Number(r.n),
            }));
        } finally {
            client.release();
        }
    },

    /* 필터 드롭다운 옵션 — 실제 존재하는 값만 (없는 값을 고를 수 있으면 빈 차트가 나온다) */
    options: async () => {
        const [parties, committees] = await Promise.all([
            db.query(`SELECT COALESCE(NULLIF(party_name,''),'기타/무소속') AS v, COUNT(*)::int AS c
                        FROM politicians WHERE active_yn = TRUE GROUP BY 1 ORDER BY c DESC`),
            db.query(`SELECT committee AS v, COUNT(*)::int AS c
                        FROM bills WHERE committee IS NOT NULL AND committee <> ''
                       GROUP BY 1 ORDER BY c DESC`),
        ]);
        return {
            parties: parties.rows.map((r) => r.v),
            committees: committees.rows.map((r) => r.v),
        };
    },
});
