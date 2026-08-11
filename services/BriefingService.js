// services/BriefingService.js — 브리핑 데이터 조립
//
// 1단계: **AI 없음, 순수 SQL.** 배치가 하루 한 번 바꾸는 값이라 메모리 캐시가 잘 듣는다.
//
// 성격 정의 (2026-08-11 개편):
//   /xray     = 누적 통계 (구조적 사실)
//   /bill     = 검색·필터 도구 (찾으러 가는 곳)
//   /briefing = **이번 주 무슨 법안이 올라왔나 (읽으러 오는 곳)**
//
// 첫 버전은 집계 위주였는데 그러면 /xray 의 7일판이 된다 (발의왕 TOP5 ≈ xray 발의왕,
// 발의 리듬 ≈ xray 월별추이). 그래서 **개별 법안 중심**으로 재편하고 집계는 맥락용만 남겼다.

import BriefingDao from '../daos/BriefingDao.js';
import logger from '../utils/logger.js';

// 발의는 평일마다 있어서 7일이면 항상 내용이 찬다 (실측 최근 7일 98건).
// ⚠️ 처리(본회의/위원회)에는 이 창을 쓰지 않는다 — 드물어서 늘 0이 된다 (getLatestProcessed 참조).
const WINDOW_DAYS = 7;
const TREND_DAYS = 14;         // 스파크라인은 조금 더 길게 봐야 주말 리듬이 보인다
const BILLS_PER_GROUP = 5;     // 그룹당 **기본 노출** 법안 (나머지는 접힘 — 데이터는 전부 내려간다)
const FEATURED_GROUPS = 6;     // 기본 상태에서 법안까지 펼칠 그룹 수
const HOT_LAWS = 5;
const SAMPLE_PER_STAGE = 4;
const FEED_PAGE = 20;          // 피드 한 페이지 카드 수

const CACHE_TTL_MS = 10 * 60 * 1000;   // 배치가 하루 1회만 바꾸므로 10분이면 충분

const PENDING_KEY = '__PENDING__';     // getBillsByCommittee.sql 의 "아직 회부 전" 마커

export default (db) => {
    const dao = BriefingDao(db);

    let cache = null;          // { at, data }
    let inflight = null;       // 동시 요청이 쿼리를 중복 실행하지 않도록 공유

    /* 카드 한 장 정리 — 화면이 쓰기 쉬운 형태로.
       ⚠️ `model === 'fallback'` 이면 AI 가 아니라 **SQL 집계로 조립한 카드**다 (API 장애·키 만료 시).
          화면에서 "AI 브리핑" 이 아니라 "데이터 요약" 으로 표시해야 한다 — AI 가 쓴 것처럼 보이면 안 된다. */
    function shapePost(p) {
        const isAi = p.model && p.model !== 'fallback';
        return {
            ...p,
            isAi,
            keywords: Array.isArray(p.keywords) ? p.keywords : [],
            stats: p.stats || {},
            // 키워드 → 뉴스 "검색 링크" 만 만든다. 기사를 수집·표시하지 않는다
            // (저작권 + 매체 선택이 곧 편집 입장이 되는 중립성 문제)
            newsLinks: (Array.isArray(p.keywords) ? p.keywords : []).map((k) => ({
                keyword: k,
                naver: `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(k)}`,
                google: `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(k)}`,
            })),
        };
    }

    /* 결과 분포 배열 → { day, daysAgo, results[], total } */
    function shapeProcessed(rows, stage) {
        const mine = rows.filter((r) => r.stage === stage);
        if (mine.length === 0) return null;
        const total = mine.reduce((s, r) => s + Number(r.cnt), 0);
        return {
            day: mine[0].day,
            daysAgo: Number(mine[0].days_ago),
            total,
            results: mine.map((r) => ({
                // 처리일만 있고 결과가 비는 행이 있을 수 있다 — 라벨을 비워두지 않는다
                label: r.result || '결과 미기재',
                cnt: Number(r.cnt),
            })),
        };
    }

    /* 평평한 행 목록 → 위원회 그룹 배열. 쿼리가 grp_total DESC 로 정렬해 오므로 순서를 그대로 쓴다 */
    function groupByCommittee(rows) {
        const map = new Map();
        rows.forEach((r) => {
            if (!map.has(r.grp)) {
                map.set(r.grp, {
                    key: r.grp,
                    isPending: r.grp === PENDING_KEY,
                    committee: r.grp === PENDING_KEY ? null : r.grp,
                    total: Number(r.grp_total),
                    bills: [],
                });
            }
            map.get(r.grp).bills.push(r);
        });
        return [...map.values()];
    }

    async function load() {
        const [summary, daily, grouped, hotLaws, parties, processed, processedBills] =
            await Promise.all([
                dao.getSummary(WINDOW_DAYS),
                dao.getDailyProposals(TREND_DAYS),
                dao.getBillsByCommittee(WINDOW_DAYS),
                dao.getHotLaws(WINDOW_DAYS, HOT_LAWS),
                dao.getPartyDist(WINDOW_DAYS),
                dao.getLatestProcessed(),
                dao.getLatestProcessedBills(SAMPLE_PER_STAGE),
            ]);

        const groups = groupByCommittee(grouped);

        // ⚠️ "아직 회부 전" 은 건수가 커서(실측 21건, 최다) 그냥 두면 **첫 그룹**으로 올라온다.
        //    그런데 그건 주제가 아니라 상태다 — 브리핑의 머리로 나오면 "이번 주 국회가 뭘 다뤘나" 가 안 읽힌다.
        //    실제 위원회들을 건수 순으로 먼저 세우고 회부 전은 항상 맨 뒤에 붙인다.
        const pending = groups.find((g) => g.isPending) || null;
        const real = groups.filter((g) => !g.isPending);     // 쿼리가 이미 grp_total DESC 로 정렬

        const featuredReal = real.slice(0, FEATURED_GROUPS - (pending ? 1 : 0));
        const featured = pending ? [...featuredReal, pending] : featuredReal;
        // 기본 상태에서 접히는 그룹들. **법안 데이터는 그대로 들고 간다** —
        // "전체 보기" 토글이 서버 왕복 없이 펼칠 수 있어야 하기 때문.
        const rest = real.slice(featuredReal.length);

        const totalBills = groups.reduce((sum, g) => sum + g.total, 0);
        // 기본 상태에서 실제로 보이는 법안 수 (버튼 문구에 쓴다: "나머지 N건 더 보기")
        const visibleBills = featured.reduce((sum, g) => sum + Math.min(BILLS_PER_GROUP, g.total), 0);

        const partyTotal = parties.reduce((s, p) => s + Number(p.cnt), 0);
        const partyMax = parties.reduce((m, p) => Math.max(m, Number(p.cnt)), 0);
        const dailyMax = daily.reduce((m, d) => Math.max(m, Number(d.cnt)), 0);

        return {
            windowDays: WINDOW_DAYS,
            trendDays: TREND_DAYS,
            summary: summary || { proposed: 0, active_days: 0, proposers: 0, co_signatures: 0, awaiting_referral: 0 },
            daily: daily.map((d) => ({ ...d, cnt: Number(d.cnt), isWeekend: d.dow >= 6 })),
            dailyMax,
            featured,
            restGroups: rest,
            billsPerGroup: BILLS_PER_GROUP,
            totalBills,
            visibleBills,
            hotLaws: hotLaws.map((h) => ({ ...h, week_cnt: Number(h.week_cnt), series_total: Number(h.series_total) })),
            parties: parties.map((p) => ({ ...p, cnt: Number(p.cnt) })),
            partyTotal,
            partyMax,
            floor: shapeProcessed(processed, 'floor'),
            committeeStage: shapeProcessed(processed, 'committee'),
            floorBills: processedBills.filter((b) => b.stage === 'floor'),
            committeeBills: processedBills.filter((b) => b.stage === 'committee'),
        };
    }

    return {
        /* ── AI 카드 피드 ── (캐시하지 않는다 — 댓글·좋아요 수가 실시간으로 바뀐다) */
        getFeed: async (limit = FEED_PAGE, offset = 0) => {
            const [rows, total] = await Promise.all([dao.getFeed(limit, offset), dao.countPosts()]);
            return { posts: rows.map(shapePost), total };
        },
        getPost: async (id) => {
            const p = await dao.getPost(id);
            return p ? shapePost(p) : null;
        },

        /* 브리핑 전체 데이터 (10분 캐시 + inflight 공유) */
        get: async () => {
            if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
            if (inflight) return inflight;

            inflight = load()
                .then((data) => {
                    cache = { at: Date.now(), data };
                    return data;
                })
                .catch((err) => {
                    logger.error(`[briefing] 데이터 조회 실패: ${err.message}`);
                    throw err;
                })
                .finally(() => { inflight = null; });

            return inflight;
        },
    };
};
