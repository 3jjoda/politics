// syncCommittees.js — 위원회 위원 명단 동기화
//
// 소스: 열린국회정보 `nktulghcadyhmiqxi` (위원회 위원 명단)
//   상임위 + 특별위원회의 위원 명단을 **MONA_CD 와 함께** 준다.
//   이름 매칭이 필요 없다는 게 이 API 의 핵심 장점이다 (발언영상 API 는 이름 문자열만 준다).
//
// ⚠️ **스냅샷이다, 이력이 아니다.** API 에 대수·기간 인자가 없어 "현재 명단" 만 준다.
//    그래서 매 실행마다 **전체 교체**한다. 과거 소속을 답할 수 없다는 뜻이니,
//    이력이 필요해지면 별도 테이블을 만들 것 (이 배치를 UPSERT 로 바꿔서 해결되지 않는다 —
//    빠진 행을 지우지 않으면 사임한 위원이 영원히 남는다).
//
// 실행 순서: syncPoliticians 다음 (mona_cd 가 politicians 에 있어야 화면에서 조인된다.
//   단 FK 는 없으므로 순서가 어긋나도 이 배치 자체는 실패하지 않는다)
//
// 인자: --dry-run (DB 안 씀)

import pg from 'pg';
import axios from 'axios';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { startBatchRun, finishBatchRun } from '../utils/batchRun.js';
import { startWatchdog } from '../utils/watchdog.js';

const OP = 'nktulghcadyhmiqxi';
const PAGE = 1000;
const DRY = process.argv.includes('--dry-run');

/* 🔴 전체 교체 안전장치.
   API 가 부분 실패하거나 빈 응답을 주면 DELETE 만 되고 INSERT 가 안 돼서 명단이 통째로 사라진다.
   실측 477행이므로 300 미만이면 "정상적인 감소" 가 아니라 사고로 본다. */
const MIN_EXPECTED = 300;

async function fetchAll(key) {
    const rows = [];
    for (let pIndex = 1; ; pIndex++) {
        const url = `https://open.assembly.go.kr/portal/openapi/${OP}`;
        const { data } = await axios.get(url, {
            params: { KEY: key, Type: 'json', pIndex, pSize: PAGE },
            timeout: 15000,
        });

        const body = data?.[OP];
        if (!body) {
            // 결과가 없으면 API 가 RESULT 만 담은 다른 모양으로 준다 (에러가 아님)
            const code = data?.RESULT?.CODE;
            if (code && code !== 'INFO-000') throw new Error(`API 오류: ${code} ${data.RESULT.MESSAGE}`);
            break;
        }

        const total = body[0]?.head?.[0]?.list_total_count ?? 0;
        const page = body[1]?.row || [];
        rows.push(...page);
        if (rows.length >= total || page.length === 0) break;
    }
    return rows;
}

/* politician_titles 는 수동 입력이라 자동으로 낡는다. 오래된 행·출처 없는 행을 로그로 알린다.
   ⚠️ 값을 고치지 않는다 — 무엇을 확인해야 하는지만 알려준다. 판단은 사람이 한다. */
const STALE_MONTHS = 6;
// 재확인 시점: review_after 가 있으면 그 날짜, 없으면 updated_at + 6개월.
// 폴백을 두는 이유는 review_after 를 빠뜨린 행이 감시에서 통째로 빠지지 않게 하기 위함이다.
// ⚠️ 컬럼을 반드시 별칭으로 한정할 것 — politicians 에도 updated_at 이 있어서
//    조인이 붙은 쿼리에서 한정하지 않으면 "column reference updated_at is ambiguous" 로 죽는다.
const dueExpr = (a) => `COALESCE(${a}.review_after, (${a}.updated_at + ($1 || ' months')::interval)::date) <= CURRENT_DATE`;
async function checkStaleTitles(pool) {
    try {
        const { rows: [r] } = await pool.query(`
            SELECT COUNT(*)::int                                                      AS total
                 , COUNT(*) FILTER (WHERE ${dueExpr('t')})::int                       AS stale
                 , COUNT(*) FILTER (WHERE source_url IS NULL OR source_url = '')::int AS no_source
              FROM politician_titles t`, [STALE_MONTHS]);

        if (r.total === 0) {
            logger.warn('  ⚠ politician_titles 가 비어 있습니다 — 의장·장관·당직이 화면에 안 나옵니다 '
                + '(ddl/seeds/politician_titles.sql 참조)');
            return { titlesTotal: 0 };
        }

        logger.info(`  [직위] ${r.total}건 등록됨`);
        if (r.stale > 0) {
            const { rows } = await pool.query(`
                SELECT p.name, t.title
                     , TO_CHAR(t.review_after, 'YYYY-MM-DD') AS due
                     , TO_CHAR(t.updated_at, 'YYYY-MM-DD')   AS d
                  FROM politician_titles t
                  LEFT JOIN politicians p ON p.mona_cd = t.mona_cd
                 WHERE ${dueExpr('t')}
                 ORDER BY COALESCE(t.review_after, (t.updated_at + ($1 || ' months')::interval)::date)
                 LIMIT 10`, [STALE_MONTHS]);
            logger.warn(`  ⚠ 재확인할 직위 ${r.stale}건`);
            rows.forEach((x) => logger.warn(x.due
                ? `      ${x.name || '(미상)'} · ${x.title} — 확인 예정일 ${x.due} 지남`
                : `      ${x.name || '(미상)'} · ${x.title} — ${STALE_MONTHS}개월 경과 (마지막 확인 ${x.d}, review_after 미설정)`));
        }
        // 다음에 확인해야 할 것을 미리 알려준다 — 캘린더를 따로 안 봐도 되게
        const { rows: next } = await pool.query(`
            SELECT p.name, t.title, TO_CHAR(t.review_after, 'YYYY-MM-DD') AS due
              FROM politician_titles t LEFT JOIN politicians p ON p.mona_cd = t.mona_cd
             WHERE t.review_after > CURRENT_DATE AND t.review_after <= CURRENT_DATE + 30
             ORDER BY t.review_after LIMIT 5`);
        next.forEach((x) => logger.info(`  [직위] 곧 확인: ${x.name} · ${x.title} (${x.due})`));
        if (r.no_source > 0) {
            logger.warn(`  ⚠ 출처(source_url) 없는 직위 ${r.no_source}건 — 나중에 검증할 수단이 없습니다`);
        }
        return { titlesTotal: r.total, titlesStale: r.stale, titlesNoSource: r.no_source };
    } catch (e) {
        // 점검 실패가 본 배치를 실패시키면 안 된다
        logger.warn(`  ⚠ 직위 점검 건너뜀: ${e.message}`);
        return {};
    }
}

async function run() {
    logger.info(`[Committees START]${DRY ? ' (dry-run)' : ''}`);
    const stopWatchdog = startWatchdog('syncCommittees', 10);
    const pool = new pg.Pool(dbConfig);
    const runId = DRY ? null : await startBatchRun(pool, 'syncCommittees');
    const startTime = Date.now();

    try {
        const key = process.env.OPEN_ASSEMBLY_API_KEY;
        if (!key) throw new Error('OPEN_ASSEMBLY_API_KEY 환경변수가 없습니다.');

        const rows = await fetchAll(key);
        logger.info(`[조회] ${rows.length}행`);

        if (rows.length < MIN_EXPECTED) {
            throw new Error(`조회 결과 ${rows.length}행 — 최소 기대치(${MIN_EXPECTED}) 미만이라 교체를 중단합니다. `
                + 'API 부분 실패로 명단이 비워지는 것을 막기 위한 안전장치입니다.');
        }

        // MONA_CD 없는 행은 조인 불가라 버린다 (실측 0건이지만 방어)
        const valid = rows.filter((r) => r.MONA_CD && r.DEPT_CD);
        const dropped = rows.length - valid.length;
        if (dropped > 0) logger.warn(`  MONA_CD/DEPT_CD 없는 ${dropped}행 제외`);

        // 같은 (mona_cd, dept_cd) 가 중복으로 오면 ON CONFLICT 가 같은 문에서 두 번 걸려 실패한다
        const seen = new Set();
        const uniq = valid.filter((r) => {
            const k = `${r.MONA_CD}|${r.DEPT_CD}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
        if (uniq.length !== valid.length) logger.warn(`  중복 ${valid.length - uniq.length}행 제거`);

        const depts = new Set(uniq.map((r) => r.DEPT_NM));
        const members = new Set(uniq.map((r) => r.MONA_CD));
        const byRole = uniq.reduce((a, r) => { a[r.JOB_RES_NM || '(없음)'] = (a[r.JOB_RES_NM || '(없음)'] || 0) + 1; return a; }, {});
        logger.info(`  위원회 ${depts.size}개 · 의원 ${members.size}명 · ${Object.entries(byRole).map(([k, v]) => `${k} ${v}`).join(' / ')}`);

        if (DRY) {
            logger.info('[dry-run] DB 를 쓰지 않고 종료합니다.');
            logger.info(`  샘플: ${uniq.slice(0, 3).map((r) => `${r.HG_NM}/${r.DEPT_NM}/${r.JOB_RES_NM}`).join(', ')}`);
            await finishBatchRun(pool, runId, { status: 'success', stats: { dryRun: true, rows: uniq.length } });
            return;
        }

        // 전체 교체 — 트랜잭션 안에서 하므로 실패 시 옛 명단이 그대로 남는다
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM politician_committees');

            const vals = [];
            const params = [];
            uniq.forEach((r, i) => {
                const b = i * 5;
                vals.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`);
                params.push(r.MONA_CD, r.DEPT_CD, r.DEPT_NM, r.JOB_RES_NM || null, r.ROOM_NO || null);
            });
            await client.query(
                `INSERT INTO politician_committees (mona_cd, dept_cd, dept_nm, job_res_nm, room_no)
                 VALUES ${vals.join(',')}`, params);

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        // politicians 에 없는 mona_cd 는 화면에서 조인이 안 되므로 경고만 남긴다 (FK 는 일부러 안 걸었다)
        const { rows: [orphan] } = await pool.query(`
            SELECT COUNT(*)::int AS n FROM politician_committees pc
             WHERE NOT EXISTS (SELECT 1 FROM politicians p WHERE p.mona_cd = pc.mona_cd)`);
        if (orphan.n > 0) logger.warn(`  ⚠ politicians 에 없는 의원 ${orphan.n}행 — syncPoliticians 를 먼저 돌렸는지 확인`);

        // ── 수동 데이터 낡음 점검 (politician_titles) ──
        // 수동 컬럼의 실패 모드는 "틀리는 것" 이 아니라 **조용히 낡는 것**이다.
        // 값을 자동으로 채우는 건 기각했지만(소관 기관이 흩어져 있고 뉴스 파싱은 과거 직위가 섞인다),
        // 낡음 감지는 외부 호출도 파싱도 없이 SQL 한 줄이라 공짜다.
        // ⚠️ 여기서 실패해도 배치를 실패시키지 않는다 — 명단 동기화가 본업이고 이건 부가 점검이다.
        const titleCheck = await checkStaleTitles(pool);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[Committees SUCCESS] ${uniq.length}행 교체 (${duration}초)`);
        await finishBatchRun(pool, runId, {
            status: 'success',
            stats: { rows: uniq.length, committees: depts.size, members: members.size, orphan: orphan.n, ...titleCheck },
        });
    } catch (error) {
        logger.error('[Committees FAILED]:', error.message);
        await finishBatchRun(pool, runId, { status: 'failed', error: error.message });
        process.exitCode = 1;
    } finally {
        await pool.end();
        stopWatchdog();
        logger.info('[Committees END]');
    }
}

run();
