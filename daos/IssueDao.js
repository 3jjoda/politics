// daos/IssueDao.js — 쟁점(/issue) 조회
//
// BriefingDao·XrayDao 와 같은 방식으로 queries/issue/*.sql 을 파일명 키로 읽는다.
// 다만 **WHERE 절만 조립한다** — 키워드 개수가 쟁점마다 달라 정적 SQL 로는 못 쓴다
// (ChartDao 가 스펙을 SQL 로 조립하는 것과 같은 판단).
//
// ─────────────────────────────────────────────────────────────
// 🔴 왜 ILIKE ANY(배열) 이 아니라 명시적 OR 인가 — 17배 차이 (2026-08-23 실측)
// ─────────────────────────────────────────────────────────────
//   둘 다 trigram 인덱스를 타긴 한다. 그런데
//     bill_name ILIKE ANY($1) OR summary ILIKE ANY($1)   → 32.3ms
//     bill_name ILIKE $1 OR summary ILIKE $1 OR … $2 …   →  1.9ms
//   ANY(배열) 은 배열 원소마다 인덱스 스캔을 따로 못 접어서 느리다.
//
// 🔴 조립되는 건 **자리표시자($1,$2…)뿐이고 값은 전부 바인딩**한다.
//    키워드가 utils/issues.js 의 코드 상수라 사용자 입력이 닿지 않지만,
//    문자열을 SQL 에 끼워넣는 습관 자체를 두지 않는다 (ChartDao 의 원칙과 동일).

import { EXCLUDE_PATTERN } from '../utils/issues.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/issue');

const queries = {};
fs.readdirSync(queriesPath).forEach((file) => {
    queries[path.basename(file, '.sql')] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

/* 키워드 N개 → { clause, params }
   ⚠️ 3글자 미만은 여기서 버린다 — trigram 이 안 만들어져 Seq Scan 이 되고(실측 902ms)
      오탐도 폭증한다. utils/issues.js 의 keywords 규칙과 한 쌍이다. */
const TOKEN = '__' + 'MATCH' + '__';   // 이 파일 안에서도 리터럴을 피한다 (검색·치환 사고 방지)
const MIN_KEYWORD_LEN = 3;
// offset: 이 절 앞에 이미 쓰인 파라미터 개수 ($1 을 날짜로 쓰는 쿼리가 있다)
function buildMatch(keywords, cols, offset = 0) {
    const kws = (keywords || []).filter((k) => typeof k === 'string' && k.trim().length >= MIN_KEYWORD_LEN);
    if (!kws.length) return null;

    const params = [];
    const parts = [];
    kws.forEach((kw) => {
        params.push(`%${kw}%`);
        const n = params.length + offset;
        cols.forEach((c) => parts.push(`${c} ILIKE $${n}`));
    });
    // 🔴 인물·사건명 특검법은 어느 쟁점에서든 뺀다 (utils/issues.js EXCLUDE_PATTERN 주석 참조).
    //    `!~` 는 POSIX 정규식 불일치. bill_name 만 본다 — summary 까지 보면
    //    "특검법을 언급한 제도 법안" 까지 사라진다.
    params.push(EXCLUDE_PATTERN);
    return { clause: `(${parts.join(' OR ')}) AND b.bill_name !~ $${params.length + offset}`, params };
}

export default (db) => {
    const run = (key, match) => {
        const sql = queries[key].replace(TOKEN, match.clause);
        // 🔴 조용히 실패하지 않게 한다. 예전에 주석 안에도 토큰을 써서
        //    replace 가 **주석 쪽만** 바꾸고 WHERE 는 그대로 남아 42703 으로 죽었다.
        //    (String.replace 는 첫 번째 하나만 바꾼다)
        if (sql.includes(TOKEN)) throw new Error(`IssueDao: ${key}.sql 의 자리표시자 치환 실패`);
        return db.query(sql, match.params).then((r) => r.rows);
    };

    return {
        /* 쟁점에 걸린 법안 전체. 페이징하지 않는다 —
           실측 최대 102건(전세사기)이고, 근거 법률별로 묶어 보여주려면 전체가 필요하다.
           접는 건 뷰의 몫 (브리핑 위원회 묶음과 같은 판단). */
        getBills: (keywords) => {
            const m = buildMatch(keywords, ['b.bill_name', 'b.summary']);
            return m ? run('getIssueBills', m) : Promise.resolve([]);
        },

        /* 이 쟁점이 굴러가고 있나 — 전체와 비교할 지표 3종 (이 페이지의 킥) */
        getBenchmark: (keywords) => {
            const m = buildMatch(keywords, ['b.bill_name', 'b.summary']);
            return m ? run('getIssueBenchmark', m).then((r) => r[0] || null) : Promise.resolve(null);
        },

        /* 전체 기준선. 쟁점과 무관하므로 서비스가 따로 캐시한다 (전건 스캔이라 무겁다) */
        getGlobalBenchmark: () =>
            db.query(queries.getGlobalBenchmark, [EXCLUDE_PATTERN]).then((r) => r.rows[0] || null),

        /* 이름을 가장 많이 올린 의원 (쟁점 → 의원). 순위표가 아니다 — SQL 주석 참조 */
        getTopSigners: (keywords) => {
            const m = buildMatch(keywords, ['b.bill_name', 'b.summary']);
            return m ? run('getIssueTopSigners', m) : Promise.resolve([]);
        },

        /* 쟁점 후보 신호 ① 반대표. buildMatch 를 안 쓴다 (키워드가 아니라 표결 기준) */
        getOpposedBills: (minNo = 20) =>
            db.query(queries.getOpposedBills, [EXCLUDE_PATTERN, minNo]).then((r) => r.rows),

        /* 쟁점 후보 신호 ② 브리핑이 여러 날 뽑은 주제 */
        getRepeatedThemes: (minDays = 2) =>
            db.query(queries.getRepeatedThemes, [minDays]).then((r) => r.rows),

        /* 이 쟁점이 등장한 브리핑 날 (쟁점 → 브리핑) */
        getBriefings: (keywords) => {
            const m = buildMatch(keywords, ['b.bill_name', 'b.summary']);
            return m ? run('getIssueBriefings', m) : Promise.resolve([]);
        },

        /* 특정 날짜 × 한 쟁점의 법안 수 (브리핑 → 쟁점).
           ⚠️ 날짜가 $1 이므로 키워드 자리표시자는 $2 부터 시작해야 한다. */
        countForDate: (keywords, date) => {
            const m = buildMatch(keywords, ['b.bill_name', 'b.summary'], 1);
            if (!m) return Promise.resolve(0);
            const sql = queries.getIssuesForDate.replace(TOKEN, m.clause);
            if (sql.includes(TOKEN)) throw new Error('IssueDao: getIssuesForDate 자리표시자 치환 실패');
            return db.query(sql, [date, ...m.params]).then((r) => Number(r.rows[0]?.n || 0));
        },

        /* 이름 올린 의원 — 정당별 고유 인원.
           ⚠️ 컬럼 별칭이 다르다 (여기선 b.bill_name / b.summary 를 조인 뒤에 참조). */
        getSigners: (keywords) => {
            const m = buildMatch(keywords, ['b.bill_name', 'b.summary']);
            return m ? run('getIssueSigners', m) : Promise.resolve([]);
        },
    };
};
