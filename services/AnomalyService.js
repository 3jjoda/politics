// services/AnomalyService.js — 「설명이 필요한 숫자」
//
// 카드는 배치가 만들어 굳혀 둔 것이라 여기서는 읽기만 한다 (계산 없음).
// 홈이 매 요청 조회하므로 최신 1장은 캐시한다.

import AnomalyDao from '../daos/AnomalyDao.js';
import { metricByKey, JUDGMENT_QUESTIONS, SELECTION_RULES, METRICS } from '../utils/anomalies.js';
import logger from '../utils/logger.js';

const PAGE_SIZE = 20;
const CACHE_TTL = 10 * 60 * 1000;

export default (db) => {
    const dao = AnomalyDao(db);

    let latestCache = { at: 0, value: undefined };
    let inflight = null;

    /** DB 행 → 화면이 쓰는 모양. payload 는 이미 굳어 있어 가공이 거의 없다 */
    const shape = (row) => {
        if (!row) return null;
        const metric = metricByKey(row.metric);
        return {
            id: Number(row.id),
            date: row.card_date,
            metric: row.metric,
            metricLabel: metric?.label || row.metric,
            metricShort: metric?.short || metric?.label || row.metric,
            metricWhy: metric?.why || '',
            monaCd: row.mona_cd,
            explained: row.explained,
            questions: JUDGMENT_QUESTIONS[row.metric] || [],
            ...row.payload,
        };
    };

    return {
        PAGE_SIZE,
        SELECTION_RULES,
        METRICS,

        /* 홈용 — 최신 1장. 10분 캐시 + inflight 공유 (홈은 가장 많이 열리는 페이지다) */
        getLatest: async () => {
            const now = Date.now();
            if (latestCache.value !== undefined && now - latestCache.at < CACHE_TTL) return latestCache.value;
            if (inflight) return inflight;

            inflight = (async () => {
                try {
                    const rows = await dao.getLatest(1);
                    const v = shape(rows[0] || null);
                    latestCache = { at: Date.now(), value: v };
                    return v;
                } catch (e) {
                    // 🔴 홈은 살아야 한다 — 카드는 부가 정보다 (AI 분석·지역구와 같은 처리)
                    logger.error(`[AnomalyService] 최신 카드 조회 실패: ${e.message}`);
                    return null;
                } finally {
                    inflight = null;
                }
            })();
            return inflight;
        },

        /* 목록 — 페이지 계산을 서비스가 소유한다 (컨트롤러가 offset 을 만들면 어긋난다).
           `metric` 은 컨트롤러가 이미 화이트리스트로 걸러 넘긴다 (모르는 값은 전체) */
        getPage: async (page = 1, metric = null) => {
            const counts = Object.fromEntries((await dao.countByMetric()).map((r) => [r.metric, r.n]));
            /* ⚠️ `allTotal` 과 `total` 을 나눈다 — 「전체」 탭 숫자는 필터와 무관하게 전체 건수여야 한다.
                  하나로 쓰면 불참률 탭을 눌렀을 때 「전체 2」 로 바뀐다 (실측으로 잡았다) */
            const allTotal = Object.values(counts).reduce((a, b) => a + b, 0);
            const total = metric ? (counts[metric] || 0) : allTotal;
            const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            const p = Math.min(Math.max(1, Number(page) || 1), totalPages);
            const offset = (p - 1) * PAGE_SIZE;
            const rows = metric
                ? await dao.getPageByMetric(metric, PAGE_SIZE, offset)
                : await dao.getPage(PAGE_SIZE, offset);
            /* 탭 — 지표는 고정 5종이라 **0건이어도 전부 보여준다.**
               건수만큼만 그리면 지표가 늘고 줄어 보여서 "무엇을 재는 사이트인지" 가 흐려진다 */
            const tabs = METRICS.map((m) => ({ key: m.key, label: m.label, short: m.short || m.label, n: counts[m.key] || 0 }));
            return { cards: rows.map(shape), page: p, totalPages, total, allTotal, tabs, counts };
        },

        getByDate: async (date) => shape(await dao.getByDate(date)),
        getNeighbors: (date) => dao.getNeighbors(date),
    };
};
