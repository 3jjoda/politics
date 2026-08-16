// calcPoliticianAxis.js — 의원 4축 좌표 산출 (bill_axis_mapping × 표결 또는 공동발의)
//
// 소스 2종 (2026-08-16 부터 v2 는 공동발의):
//   votes       (v1) — bill_votes: 찬성→agree_score / 반대→disagree_score, 기권·불참 제외
//   coproposers (v2) — bill_co_proposers: 이름을 올린 법안의 agree_score 가중평균 (부호는 항상 '찬성')
//     🔴 왜 바꿨나: 본회의는 반대가 0.66%뿐이라 표결로는 좌표가 뭉치고 출석률을 재게 된다.
//        공동발의는 본인의 **선택**이라 갈린다 — 단 방향 라벨(매핑)이 균형이어야 한다 (CLAUDE.md 「매핑 확장 파일럿」).
//     🔴 축당 서명 MIN_SIGNATURES(5) 미만이면 그 축은 NULL. 매핑이 없는 축(안보)도 NULL — 0 으로 채우면 "중도" 로 읽힌다.
//
//   score = Σ score×weight / Σ weight  →  -1.00 ~ +1.00,  politician_axis_score (mona_cd, mapping_version) UPSERT
//
// 사용:
//   node batch/calcPoliticianAxis.js                        # mapping_version=v2 · source=coproposers
//   node batch/calcPoliticianAxis.js --version v1           # v1 은 자동으로 source=votes
//   node batch/calcPoliticianAxis.js --source votes|coproposers
//   node batch/calcPoliticianAxis.js --min-votes 5          # (votes) 표결 5건 미만 제외 (기본 1)

import 'dotenv/config';
import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { POL_MAPPING_VERSION, MIN_SIGNATURES } from '../utils/axisConfig.js';

const DEFAULT_VERSION = POL_MAPPING_VERSION;
const DEFAULT_MIN_VOTES = 1;
const AXES = ['economy', 'social', 'security', 'institution'];

function parseArgs(argv) {
    const args = { version: DEFAULT_VERSION, minVotes: DEFAULT_MIN_VOTES, source: null };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--version') args.version = argv[++i];
        else if (argv[i] === '--min-votes') args.minVotes = parseInt(argv[++i], 10);
        else if (argv[i] === '--source') args.source = argv[++i];
    }
    if (!args.source) args.source = args.version === 'v1' ? 'votes' : 'coproposers';
    if (!['votes', 'coproposers'].includes(args.source)) throw new Error(`--source 는 votes|coproposers: ${args.source}`);
    return args;
}

// 1차원 분포 히스토그램 (10 buckets: -1.0 .. +1.0)
function histogram(values) {
    const buckets = new Array(10).fill(0);
    let nonZero = 0;
    for (const v of values) {
        if (v === null || v === undefined) continue;
        if (Math.abs(v) > 0.001) nonZero++;
        // -1.0 → 0, -0.8 → 1, ..., +1.0 → 9 (clamp)
        const idx = Math.min(9, Math.max(0, Math.floor((v + 1.0) * 5)));
        buckets[idx]++;
    }
    return { buckets, nonZero };
}

function renderHist(buckets, total) {
    const max = Math.max(...buckets, 1);
    const labels = [
        '-1.0~-0.8', '-0.8~-0.6', '-0.6~-0.4', '-0.4~-0.2', '-0.2~ 0.0',
        ' 0.0~+0.2', '+0.2~+0.4', '+0.4~+0.6', '+0.6~+0.8', '+0.8~+1.0',
    ];
    const lines = [];
    for (let i = 0; i < 10; i++) {
        const bar = '█'.repeat(Math.round((buckets[i] / max) * 30));
        const pct = total > 0 ? ((buckets[i] / total) * 100).toFixed(1) : '0.0';
        lines.push(`    ${labels[i]} │ ${bar.padEnd(30)} ${String(buckets[i]).padStart(4)}명 (${pct}%)`);
    }
    return lines.join('\n');
}

function stats(values) {
    const filtered = values.filter(v => v !== null && v !== undefined);
    if (filtered.length === 0) return null;
    const sorted = [...filtered].sort((a, b) => a - b);
    const sum = filtered.reduce((a, b) => a + b, 0);
    const mean = sum / filtered.length;
    const variance = filtered.reduce((acc, v) => acc + (v - mean) ** 2, 0) / filtered.length;
    return {
        count: filtered.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean,
        std: Math.sqrt(variance),
        median: sorted[Math.floor(sorted.length / 2)],
    };
}

async function run() {
    const args = parseArgs(process.argv);
    logger.info(`[Politician Axis START] mapping_version=${args.version} source=${args.source} min_votes=${args.minVotes}`);

    const pool = new pg.Pool(dbConfig);
    const start = Date.now();

    try {
        // 매핑된 법안 수 확인
        const mapStat = await pool.query(
            `SELECT axis, COUNT(*)::int AS bills,
                    SUM(weight)::numeric(6,2) AS weight_sum
               FROM bill_axis_mapping
              WHERE mapping_version = $1
              GROUP BY axis ORDER BY axis`,
            [args.version]
        );
        if (mapStat.rowCount === 0) {
            logger.error(`매핑이 없습니다 (mapping_version=${args.version}). bill_axis_mapping 시드 먼저 적용하세요.`);
            return;
        }
        logger.info(`--- bill_axis_mapping (${args.version}) ---`);
        mapStat.rows.forEach(r => logger.info(`  ${r.axis.padEnd(11)}: ${r.bills}건 · weight합 ${r.weight_sum}`));

        // 메인 계산 + UPSERT — CTE 한 방. per_axis 만 소스에 따라 다르고 나머지는 공통
        const perAxisVotes = `
                SELECT
                    bv.mona_cd,
                    bam.axis,
                    SUM(
                        CASE bv.vote_result
                            WHEN '찬성' THEN bam.agree_score::numeric * bam.weight
                            WHEN '반대' THEN bam.disagree_score::numeric * bam.weight
                            ELSE 0
                        END
                    ) AS numerator,
                    SUM(
                        CASE WHEN bv.vote_result IN ('찬성','반대')
                             THEN bam.weight ELSE 0 END
                    ) AS denominator,
                    COUNT(*) FILTER (WHERE bv.vote_result IN ('찬성','반대'))::int AS used_count
                  FROM bill_votes bv
                  JOIN bill_axis_mapping bam ON bam.bill_id = bv.bill_id
                 WHERE bam.mapping_version = $1::varchar
                 GROUP BY bv.mona_cd, bam.axis`;
        // 공동발의: 이름을 올린 것이 곧 '찬성'. 축당 서명이 MIN_SIGNATURES 미만이면 분모를 0 으로 만들어 NULL 이 되게 한다
        const perAxisCo = `
                SELECT
                    c.mona_cd,
                    bam.axis,
                    SUM(bam.agree_score::numeric * bam.weight) AS numerator,
                    CASE WHEN COUNT(*) >= ${MIN_SIGNATURES} THEN SUM(bam.weight) ELSE 0 END AS denominator,
                    COUNT(*)::int AS used_count
                  FROM bill_co_proposers c
                  JOIN bill_axis_mapping bam ON bam.bill_id = c.bill_id
                 WHERE bam.mapping_version = $1::varchar
                 GROUP BY c.mona_cd, bam.axis`;
        // 🔴 축 값은 분모>0 일 때만, 아니면 NULL (구 버전은 COALESCE(...,0) 이라 못 잰 축이 "중도 0" 으로 들어갔다)
        const axisExpr = (ax) => `MAX(CASE WHEN axis='${ax}' AND denominator > 0 THEN numerator / denominator END)::numeric(4,2)`;
        const cntExpr  = (ax) => `MAX(CASE WHEN axis='${ax}' THEN used_count END)::smallint`;
        const upsertSql = `
            WITH per_axis AS (${args.source === 'votes' ? perAxisVotes : perAxisCo}),
            per_pol AS (
                SELECT mona_cd,
                       ${axisExpr('economy')}     AS economy,
                       ${axisExpr('social')}      AS social,
                       ${axisExpr('security')}    AS security,
                       ${axisExpr('institution')} AS institution,
                       ${cntExpr('economy')}      AS economy_n,
                       ${cntExpr('social')}       AS social_n,
                       ${cntExpr('security')}     AS security_n,
                       ${cntExpr('institution')}  AS institution_n,
                       COALESCE(SUM(used_count), 0)::int AS vote_count_used
                  FROM per_axis
                 GROUP BY mona_cd
            )
            INSERT INTO politician_axis_score
                (mona_cd, mapping_version, economy, social, security, institution,
                 economy_n, social_n, security_n, institution_n, vote_count_used, computed_at)
            SELECT pp.mona_cd, $1::varchar,
                   pp.economy, pp.social, pp.security, pp.institution,
                   pp.economy_n, pp.social_n, pp.security_n, pp.institution_n,
                   pp.vote_count_used, NOW()
              FROM per_pol pp
              JOIN politicians p ON p.mona_cd = pp.mona_cd
             WHERE pp.vote_count_used >= $2::int
            ON CONFLICT (mona_cd, mapping_version) DO UPDATE SET
              economy         = EXCLUDED.economy,
              social          = EXCLUDED.social,
              security        = EXCLUDED.security,
              institution     = EXCLUDED.institution,
              economy_n       = EXCLUDED.economy_n,
              social_n        = EXCLUDED.social_n,
              security_n      = EXCLUDED.security_n,
              institution_n   = EXCLUDED.institution_n,
              vote_count_used = EXCLUDED.vote_count_used,
              computed_at     = NOW()
        `;
        const upsertRes = await pool.query(upsertSql, [args.version, args.minVotes]);
        logger.info(`✓ politician_axis_score UPSERT ${upsertRes.rowCount}건 (source=${args.source})`);
        // 🔴 매핑에서 사라진 의원(공동발의 0건 등)의 옛 행이 남으면 낡은 좌표가 화면에 뜬다 → 이번 산출에 없는 행은 지운다
        const stale = await pool.query(
            `DELETE FROM politician_axis_score WHERE mapping_version = $1 AND computed_at < NOW() - INTERVAL '1 minute'`, [args.version]);
        if (stale.rowCount) logger.info(`  낡은 행 삭제 ${stale.rowCount}건`);

        // 사용된 표결 수 분포
        const voteCountSql = await pool.query(
            `SELECT MIN(vote_count_used) AS min, MAX(vote_count_used) AS max,
                    AVG(vote_count_used)::numeric(6,2) AS avg,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY vote_count_used) AS median,
                    COUNT(*) FILTER (WHERE vote_count_used >= 30)::int AS over30,
                    COUNT(*) FILTER (WHERE vote_count_used >= 20)::int AS over20,
                    COUNT(*) FILTER (WHERE vote_count_used >= 10)::int AS over10,
                    COUNT(*) FILTER (WHERE vote_count_used <  10)::int AS under10,
                    COUNT(*)::int AS total
               FROM politician_axis_score
              WHERE mapping_version = $1`,
            [args.version]
        );
        const vc = voteCountSql.rows[0];
        logger.info(`--- vote_count_used (계산에 쓰인 표결 수) ---`);
        logger.info(`  total: ${vc.total}명 · min/median/avg/max = ${vc.min} / ${vc.median} / ${vc.avg} / ${vc.max}`);
        logger.info(`  ≥30: ${vc.over30}명 · ≥20: ${vc.over20}명 · ≥10: ${vc.over10}명 · <10: ${vc.under10}명`);

        // 4축 분포 히스토그램
        const dataRes = await pool.query(
            `SELECT economy::float8 AS economy,
                    social::float8 AS social,
                    security::float8 AS security,
                    institution::float8 AS institution
               FROM politician_axis_score
              WHERE mapping_version = $1`,
            [args.version]
        );
        const total = dataRes.rowCount;

        for (const axis of AXES) {
            const values = dataRes.rows.map(r => r[axis]);
            const s = stats(values);
            if (!s) continue;
            const { buckets, nonZero } = histogram(values);
            logger.info(`\n=== ${axis.toUpperCase()} ===`);
            logger.info(`  n=${s.count} · min=${s.min.toFixed(2)} · median=${s.median.toFixed(2)} · mean=${s.mean.toFixed(3)} · max=${s.max.toFixed(2)} · std=${s.std.toFixed(3)} · 비중도=${nonZero}/${total}`);
            logger.info(renderHist(buckets, total));
        }

        // 정당별 institution 평균 (특검 부호 약속 검증용)
        const partySql = await pool.query(
            `SELECT COALESCE(p.party_name, '무소속/기타') AS party,
                    COUNT(*)::int AS n,
                    AVG(s.economy)::numeric(4,2)     AS economy,
                    AVG(s.social)::numeric(4,2)      AS social,
                    AVG(s.security)::numeric(4,2)    AS security,
                    AVG(s.institution)::numeric(4,2) AS institution
               FROM politician_axis_score s
               JOIN politicians p ON p.mona_cd = s.mona_cd
              WHERE s.mapping_version = $1
              GROUP BY p.party_name
              HAVING COUNT(*) >= 3
              ORDER BY institution DESC`,
            [args.version]
        );
        logger.info(`\n--- 정당별 평균 (n≥3, institution 내림차순) ---`);
        logger.info(`  ${'party'.padEnd(14)} ${'n'.padStart(4)}  ${'eco'.padStart(7)} ${'soc'.padStart(7)} ${'sec'.padStart(7)} ${'ins'.padStart(7)}`);
        partySql.rows.forEach(r => {
            logger.info(`  ${String(r.party).padEnd(14)} ${String(r.n).padStart(4)}  ${String(r.economy).padStart(7)} ${String(r.social).padStart(7)} ${String(r.security).padStart(7)} ${String(r.institution).padStart(7)}`);
        });

        // 누락 검증 (politicians 테이블 vs politician_axis_score)
        const missing = await pool.query(
            `SELECT COUNT(*)::int AS n
               FROM politicians p
              WHERE NOT EXISTS (
                    SELECT 1 FROM politician_axis_score s
                     WHERE s.mona_cd = p.mona_cd AND s.mapping_version = $1)`,
            [args.version]
        );
        logger.info(`\n좌표 미산출 의원: ${missing.rows[0].n}명 (표결 ${args.minVotes}건 미만)`);

    } catch (err) {
        logger.error(`[FATAL] ${err.message}\n${err.stack}`);
    } finally {
        await pool.end();
        logger.info(`\n[Politician Axis END] ${((Date.now() - start) / 1000).toFixed(2)}초`);
    }
}

run();
