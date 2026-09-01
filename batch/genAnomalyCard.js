// genAnomalyCard.js — 「설명이 필요한 숫자」 카드 생성 (하루 1장)
//
// 사이트에 지표는 많은데 **누가 이상한지를 사이트가 먼저 꺼내주지 않았다.** 매일 한 장씩 꺼낸다.
//
// 🔴 순위표가 아니다. 목록으로 내면 그 자체가 정당 판정이 된다
//    (실측 자당·타당 격차 15%p 이상 14명 중 11명이 국민의힘).
//    지표를 날짜로 돌아가며 쓰고, 사람은 규칙이 고른다.
//
// 🔴 AI 를 부르지 않는다. 문장은 전부 `utils/anomalies.js` 의 템플릿이고 숫자는 SQL 산출값이다.
//    브리핑이 "숫자를 생성물에서 받지 않는다" 고 정한 것과 같은 규칙 — 여기선 문장까지 템플릿이다.
//    실명이 걸리는 화면이라 생성물이 끼어들 자리가 없어야 한다.
//
// 사용법
//   node batch/genAnomalyCard.js                 오늘 카드 (이미 있으면 건너뜀)
//   node batch/genAnomalyCard.js --date 2026-09-01
//   node batch/genAnomalyCard.js --force         이미 있어도 다시 만든다
//   node batch/genAnomalyCard.js --backfill 14   최근 14일치를 과거부터 채운다
//   node batch/genAnomalyCard.js --dry-run

import 'dotenv/config';
import pg from 'pg';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { startBatchRun, finishBatchRun } from '../utils/batchRun.js';
import AnomalyDao from '../daos/AnomalyDao.js';
import { metricForDate, resolveExplain, pickFromPool, rotationRound, axisSide, axisSideShort, axisPct, METRICS } from '../utils/anomalies.js';
import { AXIS_META } from '../utils/axisConfig.js';

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const argOf = (name) => {
    const i = process.argv.indexOf(name);
    return i > -1 ? process.argv[i + 1] : null;
};

const kstToday = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

/** 날짜 문자열에 일수를 더한다 (로컬 getter 금지 — 프로젝트 공통 규칙) */
const addDays = (dateStr, n) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const t = Date.UTC(y, m - 1, d) + n * 86400000;
    const dt = new Date(t);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
};

/** 후보 한 명 → 화면이 쓰는 값 전부. 생성 시점에 굳힌다 */
function buildPayload(metric, row, explain, ctx) {
    const detail = {};
    if (metric.key === 'absent') { detail.total = Number(row.total); detail.absent = Number(row.absent); }
    if (metric.key === 'gap') {
        detail.own = Number(row.own_rate); detail.other = Number(row.other_rate);
        detail.ownTotal = Number(row.own_total); detail.otherTotal = Number(row.other_total);
    }
    if (metric.key === 'propose') { detail.votes = Number(row.vtot); }
    if (metric.key === 'committee') {
        detail.dept = row.dept_nm; detail.spoke = Number(row.spoke); detail.denom = Number(row.denom);
        detail.ncmt = Number(row.ncmt);
    }
    if (metric.key === 'axis') {
        detail.me = Number(row.me); detail.pavg = Number(row.pavg); detail.pn = Number(row.pn);
        /* 🔴 숫자를 그대로 내보내면 아무도 못 읽는다 — 방향을 말로 굳혀 둔다.
           화면이 다시 계산하지 않게 위치(%)까지 여기서 뽑는다 (payload 는 화면이 쓰는 값 전부를 담는다) */
        const meta = AXIS_META[metric.axisKey];
        detail.meSide = axisSide(row.me, meta);
        detail.pavgSide = axisSide(row.pavg, meta);
    }

    /* ⚠️ axis 만 표시값과 선정값이 다르다 — 후보는 거리로 고르고 화면엔 본인 좌표를 쓴다.
       거리(0.35)만 두면 뜻이 안 통하고 헤드라인("혼자 0.76")과도 어긋난다. */
    const shownValue = metric.showMe ? Number(row.me) : Number(row.value);
    const shownMedian = metric.showMe
        ? Number(row.pavg)
        : (row.median === null ? null : Number(row.median));

    /* 축 지표는 숫자 대신 **양극 막대**를 그린다. 여기서 재료를 전부 굳힌다 */
    const axis = metric.axisKey ? (() => {
        const meta = AXIS_META[metric.axisKey];
        return {
            name: meta.name, short: meta.short, Lx: meta.Lx, Rx: meta.Rx,
            me: Number(row.me), pavg: Number(row.pavg),
            mePct: axisPct(row.me), pavgPct: axisPct(row.pavg),
            meSide: detail.meSide, pavgSide: detail.pavgSide,
        };
    })() : null;

    return {
        name: row.name,
        party: row.party_name || null,
        district: row.district || null,
        photoUrl: ctx?.photo_url || null,
        value: shownValue,
        unit: metric.unit,
        median: shownMedian,
        medianLabel: metric.medianLabel,
        axis,
        /* 행처럼 좁은 자리에 쓰는 값. 🔴 축 지표는 `0.07` 이 아니라 **방향 라벨**이어야 한다 */
        rowValue: axis ? axisSideShort(row.me, AXIS_META[metric.axisKey]) : `${shownValue}${metric.unit}`,
        cohort: Number(row.cohort),
        headline: metric.headline(Number(row.value), detail),
        explainKind: explain.kind,
        explainText: explain.text,
        caveats: metric.caveats,
        note: metric.note,
        link: metric.link,
        detail,
    };
}

async function makeOne(dao, date, { force }) {
    if (!force) {
        const exists = await dao.getByDate(date);
        if (exists) return { date, skipped: true };
    }

    const metric = metricForDate(date);
    const threshold = metric.lower ? metric.max : metric.min;
    const candidates = await dao.getCandidates(metric.key, threshold);
    if (candidates.length === 0) {
        return { date, metric: metric.key, error: '후보 0명 (문턱을 넘는 의원이 없다)' };
    }

    /* 🔴 선택은 결정적이다 — 날짜에서 나온 회차로 후보 목록을 순환한다.
       random() 이면 같은 날짜를 다시 만들 때 다른 사람이 나오고, 1등만 뽑으면
       5일마다 같은 사람이 반복된다 (utils/anomalies.js `rotationRound` 주석 참조). */
    const picked = pickFromPool(candidates, date);
    const thin = candidates.length < METRICS.length;   // 후보가 너무 적으면 반복 주기가 짧아진다

    const ctx = await dao.getExplainContext(picked.mona_cd);
    const explain = resolveExplain(metric.key, {
        speaker: ctx?.speaker || null,
        viceSpeaker: ctx?.vice_speaker || null,
        minister: ctx?.minister || null,
        multi: { n: Number(ctx?.ncmt || 0) },
        joined: Number(ctx?.vtot || 0) < 0.9 * Number(ctx?.vmax || 1)
            ? { total: Number(ctx.vtot), max: Number(ctx.vmax) } : null,
    });

    const payload = buildPayload(metric, picked, explain, ctx);
    return {
        date, metric: metric.key, monaCd: picked.mona_cd, name: picked.name,
        party: picked.party_name, value: payload.value, explained: explain.explained,
        explainKind: explain.kind, candidates: candidates.length,
        round: rotationRound(date) % candidates.length, thin, payload,
    };
}

async function run() {
    logger.info(`[AnomalyCard START]${DRY ? ' (dry-run)' : ''}${FORCE ? ' (--force)' : ''}`);
    const pool = new pg.Pool(dbConfig);
    const runId = DRY ? null : await startBatchRun(pool, 'genAnomalyCard');
    const startTime = Date.now();

    try {
        const dao = AnomalyDao(pool);
        const backfill = Number(argOf('--backfill') || 0);
        const target = argOf('--date') || kstToday();

        // 과거부터 채워야 `getRecentMonaCds` 의 중복 제외가 제대로 작동한다
        const dates = backfill > 0
            ? Array.from({ length: backfill }, (_, i) => addDays(target, -(backfill - 1 - i)))
            : [target];

        const results = [];
        for (const d of dates) {
            const r = await makeOne(dao, d, { force: FORCE });
            if (r.skipped) { logger.info(`  ${d} 이미 있음 — 건너뜀`); results.push(r); continue; }
            if (r.error) { logger.warn(`  ⚠ ${d} [${r.metric}] ${r.error}`); results.push(r); continue; }

            logger.info(`  ${d} [${r.metric}] ${r.name}(${r.party}) ${r.value}${METRICS.find((m) => m.key === r.metric).unit}`
                + ` · 설명 ${r.explainKind}${r.explained ? '' : ' (모름)'}`
                + ` · 후보 ${r.candidates}명 중 ${r.round + 1}번째${r.thin ? ' ⚠후보부족' : ''}`);

            if (!DRY) await dao.upsertCard(d, r.metric, r.monaCd, r.explained, r.payload);
            results.push(r);
        }

        const made = results.filter((r) => !r.skipped && !r.error);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[AnomalyCard SUCCESS] ${made.length}장 ${DRY ? '(dry-run)' : '생성'}`
            + ` · 설명있음 ${made.filter((r) => r.explained).length} · 모름 ${made.filter((r) => !r.explained).length} (${duration}초)`);

        if (!DRY) {
            await finishBatchRun(pool, runId, {
                status: 'success',
                stats: {
                    made: made.length, skipped: results.filter((r) => r.skipped).length,
                    errors: results.filter((r) => r.error).length,
                    explained: made.filter((r) => r.explained).length,
                },
            });
        }
    } catch (e) {
        logger.error(`[AnomalyCard FAIL] ${e.message}`);
        if (!DRY) await finishBatchRun(pool, runId, { status: 'fail', error: e.message });
        process.exitCode = 1;
    } finally {
        await pool.end();
        logger.info('[AnomalyCard END]');
    }
}

run();
