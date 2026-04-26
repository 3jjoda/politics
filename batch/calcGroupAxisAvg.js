// calcGroupAxisAvg.js — 인구 그룹별 4축 평균 일배치
//
// 매일 새벽 1회 실행:
//   - 'all' 키 (전체 평균)
//   - 'gender:F,age:20s' 같은 인구 그룹 키
// user_axis_score × users 조인. user_count >= GROUP_THRESHOLD_LOW(50) 만 평균 채움.
//
// 사용:
//   node batch/calcGroupAxisAvg.js
//   node batch/calcGroupAxisAvg.js --version v1   # 특정 매핑 버전만

import 'dotenv/config';
import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';

const DEFAULT_VERSION = 'v1';
const GROUP_THRESHOLD_LOW = 50;

function parseArgs(argv) {
    const args = { version: DEFAULT_VERSION };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--version') args.version = argv[++i];
    }
    return args;
}

async function run() {
    const args = parseArgs(process.argv);
    logger.info(`[Group Axis Avg START] mapping_version=${args.version}`);

    const pool = new pg.Pool(dbConfig);
    const start = Date.now();
    let upserts = 0;

    try {
        // 'all' 키 — 전체 평균 (모든 응답자, 임계값 무시)
        const overallSql = `
            INSERT INTO group_axis_avg (group_key, mapping_version,
                economy_avg, social_avg, security_avg, institution_avg,
                user_count, computed_at)
            SELECT 'all', $1::varchar,
                   AVG(economy)::numeric(4,2),
                   AVG(social)::numeric(4,2),
                   AVG(security)::numeric(4,2),
                   AVG(institution)::numeric(4,2),
                   COUNT(*)::int,
                   NOW()
              FROM user_axis_score
             WHERE mapping_version = $1::varchar AND total_responses > 0
            ON CONFLICT (group_key, mapping_version) DO UPDATE SET
              economy_avg     = EXCLUDED.economy_avg,
              social_avg      = EXCLUDED.social_avg,
              security_avg    = EXCLUDED.security_avg,
              institution_avg = EXCLUDED.institution_avg,
              user_count      = EXCLUDED.user_count,
              computed_at     = NOW()
        `;
        await pool.query(overallSql, [args.version]);
        upserts++;
        logger.info('  ✓ all (전체 평균)');

        // 인구 그룹 — 모든 (gender, age_group) 조합 자동 감지
        const groupSql = `
            INSERT INTO group_axis_avg (group_key, mapping_version,
                economy_avg, social_avg, security_avg, institution_avg,
                user_count, computed_at)
            SELECT
                'gender:' || u.gender || ',age:' || u.age_group,
                $1::varchar,
                CASE WHEN COUNT(*) >= ${GROUP_THRESHOLD_LOW} THEN AVG(s.economy)::numeric(4,2)     ELSE NULL END,
                CASE WHEN COUNT(*) >= ${GROUP_THRESHOLD_LOW} THEN AVG(s.social)::numeric(4,2)      ELSE NULL END,
                CASE WHEN COUNT(*) >= ${GROUP_THRESHOLD_LOW} THEN AVG(s.security)::numeric(4,2)    ELSE NULL END,
                CASE WHEN COUNT(*) >= ${GROUP_THRESHOLD_LOW} THEN AVG(s.institution)::numeric(4,2) ELSE NULL END,
                COUNT(*)::int,
                NOW()
              FROM user_axis_score s
              JOIN users u ON u.user_id = s.user_id
             WHERE s.mapping_version = $1::varchar
               AND s.total_responses > 0
               AND u.gender IS NOT NULL
               AND u.age_group IS NOT NULL
               AND u.provider <> 'deleted'
             GROUP BY u.gender, u.age_group
            ON CONFLICT (group_key, mapping_version) DO UPDATE SET
              economy_avg     = EXCLUDED.economy_avg,
              social_avg      = EXCLUDED.social_avg,
              security_avg    = EXCLUDED.security_avg,
              institution_avg = EXCLUDED.institution_avg,
              user_count      = EXCLUDED.user_count,
              computed_at     = NOW()
        `;
        const r = await pool.query(groupSql, [args.version]);
        upserts += r.rowCount;
        logger.info(`  ✓ 인구 그룹 (${r.rowCount}개)`);

        // 결과 요약
        const summary = await pool.query(
            `SELECT group_key, user_count,
                    economy_avg IS NOT NULL AS has_avg
               FROM group_axis_avg
              WHERE mapping_version = $1::varchar
              ORDER BY user_count DESC, group_key`,
            [args.version]
        );
        logger.info(`--- 그룹별 응답자 수 (임계값 ${GROUP_THRESHOLD_LOW}) ---`);
        summary.rows.forEach(row => {
            const tag = row.has_avg ? '✓' : (row.user_count >= GROUP_THRESHOLD_LOW ? '?' : '○');
            logger.info(`  ${tag} ${row.group_key}: ${row.user_count}명`);
        });
    } catch (err) {
        logger.error(`[FATAL] ${err.message}\n${err.stack}`);
    } finally {
        await pool.end();
        logger.info(`[Group Axis Avg END] ${upserts}건 upsert · ${((Date.now() - start) / 1000).toFixed(2)}초`);
    }
}

run();
