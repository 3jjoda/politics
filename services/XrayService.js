// services/XrayService.js — 국회 X레이 데이터 조립

import XrayDao from '../daos/XrayDao.js';

export default (db) => {
    const dao = XrayDao(db);

    /* ① 히스토그램 20구간 채우기 + 요약 통계 */
    function buildConsensus(rows) {
        const bins = Array.from({ length: 20 }, (_, i) => ({
            from: i * 5, to: (i + 1) * 5, cnt: 0
        }));
        rows.forEach(r => {
            const idx = Math.min(19, Math.max(0, Number(r.bucket) - 1));
            bins[idx].cnt = Number(r.cnt);
        });
        const total = bins.reduce((s, b) => s + b.cnt, 0);
        const nearUnanimous = bins.slice(18).reduce((s, b) => s + b.cnt, 0); // 찬성률 90% 이상
        const contested = bins.slice(0, 14).reduce((s, b) => s + b.cnt, 0);  // 찬성률 70% 미만
        return {
            bins, total,
            nearUnanimous,
            nearUnanimousPct: total > 0 ? Math.round(nearUnanimous / total * 1000) / 10 : 0,
            contested,
            contestedPct: total > 0 ? Math.round(contested / total * 1000) / 10 : 0
        };
    }

    /* ⑪ 당 성향 격차 히스토그램 — 2%p 폭 17구간 (-2 ~ 32) 채우기
       빈 버킷도 자리를 잡아야 분포 모양이 안 왜곡된다 */
    function buildGapDist(rows, stats) {
        const BINS = 17, FROM = -2, STEP = 2;
        const bins = Array.from({ length: BINS }, (_, i) => ({
            from: FROM + i * STEP, to: FROM + (i + 1) * STEP, cnt: 0
        }));
        rows.forEach(r => {
            const idx = Math.min(BINS - 1, Math.max(0, Number(r.bucket) - 1));
            bins[idx].cnt = Number(r.cnt);
        });
        const total = stats ? Number(stats.total) : 0;
        const pct = (n) => (total > 0 ? Math.round(Number(n) / total * 1000) / 10 : 0);
        return {
            bins,
            total,
            median: stats ? Number(stats.median) : 0,
            q1: stats ? Number(stats.q1) : 0,
            q3: stats ? Number(stats.q3) : 0,
            gapMin: stats ? Number(stats.gap_min) : 0,
            gapMax: stats ? Number(stats.gap_max) : 0,
            neutralCnt: stats ? Number(stats.neutral_cnt) : 0,
            neutralPct: stats ? pct(stats.neutral_cnt) : 0,
            partisanCnt: stats ? Number(stats.partisan_cnt) : 0,
            partisanPct: stats ? pct(stats.partisan_cnt) : 0,
            byParty: (stats && stats.by_party) ? stats.by_party.map(p => ({
                party: p.party_name, cnt: Number(p.cnt), avgGap: Number(p.avg_gap)
            })) : []
        };
    }

    /* ⑬ 자당/타당 찬성률 — 점 그래프용. 의원 한 명이 점 하나다.
       🔴 높이(빈도)를 쓰지 않는다. 자당이 한 칸에 92% 몰려 있어 히스토그램으로는
          타당 분포가 바닥에 눌려 사라졌다 (쿼리 주석 참조). 가로 퍼짐만 비교한다.
       지터는 **결정적**이어야 한다 — 매 요청 난수를 쓰면 새로고침마다 점이 튄다.
       인덱스 해시로 -1~1 을 만들어 화면에서 밴드 높이에 곱한다 */
    function buildRateDist(rows, stats) {
        const jitter = (i) => {
            // 황금비 기반 저불일치 수열 — 이웃한 인덱스끼리 값이 멀어 뭉침이 잘 흩어진다
            const f = (i * 0.6180339887498949) % 1;
            return Math.round((f * 2 - 1) * 1000) / 1000;   // -1 ~ 1
        };
        const dots = rows.map((r, i) => ({
            own: Number(r.own_rate),
            other: Number(r.other_rate),
            j: jitter(i)
        }));
        const n = (v) => (v == null ? 0 : Number(v));
        const total = stats ? n(stats.total) : 0;
        const pct = (v) => (total > 0 ? Math.round(n(v) / total * 1000) / 10 : 0);
        return {
            dots, total,
            own: {
                min: n(stats && stats.own_min), max: n(stats && stats.own_max),
                avg: n(stats && stats.own_avg), sd: n(stats && stats.own_sd),
                median: n(stats && stats.own_median),
                over99: n(stats && stats.own_over99), over99Pct: pct(stats && stats.own_over99)
            },
            other: {
                min: n(stats && stats.other_min), max: n(stats && stats.other_max),
                avg: n(stats && stats.other_avg), sd: n(stats && stats.other_sd),
                median: n(stats && stats.other_median),
                over99: n(stats && stats.other_over99), over99Pct: pct(stats && stats.other_over99)
            },
            // 히스토그램 범위(60~100%) 밖 인원. 0 이 아니면 뷰가 각주로 알린다
            underMin: n(stats && stats.under_min),
            // 폭 대비 — 이 섹션의 결론
            ownSpread: Math.round((n(stats && stats.own_max) - n(stats && stats.own_min)) * 10) / 10,
            otherSpread: Math.round((n(stats && stats.other_max) - n(stats && stats.other_min)) * 10) / 10,
            // 해석 각주용 (하드코딩 금지 — 표결이 쌓이면 움직인다)
            floorBills: n(stats && stats.floor_bills),
            floorAvgFor: n(stats && stats.floor_avg_for),
            opposePct: n(stats && stats.oppose_pct)
        };
    }

    /* ⑨ 정당별 4축 분포 그룹핑 (10인 미만 정당은 '그 외') */
    function buildSpectrum(rows) {
        const byParty = new Map();
        rows.forEach(r => {
            const key = r.party_name || '무소속';
            if (!byParty.has(key)) byParty.set(key, []);
            // v2 부터 못 잰 축은 NULL (안보 전원 · 서명 5건 미만 축). Number(null)=0 은 "중도" 로 그려지므로 null 을 지킨다
            const nn = (v) => (v === null || v === undefined) ? null : Number(v);
            byParty.get(key).push({
                name: r.name,
                economy: nn(r.economy),
                social: nn(r.social),
                security: nn(r.security),
                institution: nn(r.institution)
            });
        });
        const parties = [...byParty.entries()]
            .map(([party, members]) => ({ party, members }))
            .sort((a, b) => b.members.length - a.members.length);
        const main = parties.filter(p => p.members.length >= 10);
        const rest = parties.filter(p => p.members.length < 10);
        if (rest.length > 0) {
            main.push({ party: '그 외', members: rest.flatMap(p => p.members) });
        }
        return main.map(p => ({ party: p.party, count: p.members.length, members: p.members }));
    }

    /* 월별 발의 + 처리 진행도.
       최근 달일수록 처리 완료가 0 에 수렴하는데, 이건 국회가 일을 안 한 게 아니라 아직 심사 중인 것이다.
       그래서 "가결률" 대신 **처리 완료 비율**을 내보내고, 심사 초기 구간은 화면에서 구분해 그린다. */
    function buildMonthlyPropose(rows) {
        // 현재 월(KST) — 마지막 달은 아직 안 끝나서 막대가 낮게 보인다. 프로세스 타임존을 타지 않게 Intl 사용.
        // ⚠️ ko-KR 로케일은 month: '2-digit' 을 무시하고 "8" 을 준다 (→ "2026-8" 이 되어 매칭 실패).
        //    로케일에 기대지 말고 여기서 직접 0 을 채울 것.
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit'
        }).formatToParts(new Date());
        const y = parts.find(p => p.type === 'year')?.value;
        const m = parts.find(p => p.type === 'month')?.value;
        const currentYm = y && m ? `${y}-${String(m).padStart(2, '0')}` : null;

        const months = rows.map(r => {
            const proposed = Number(r.proposed) || 0;
            const proposers = Number(r.proposers) || 0;
            const processed = Number(r.processed) || 0;
            return {
                ym: r.ym,
                proposed,
                proposers,
                processed,
                passed: Number(r.passed) || 0,
                perPerson: proposers > 0 ? Math.round(proposed / proposers * 10) / 10 : 0,
                processedPct: proposed > 0 ? Math.round(processed / proposed * 1000) / 10 : 0,
                isPartial: r.ym === currentYm          // 진행 중인 달 — 막대가 낮은 게 당연
            };
        });

        if (months.length === 0) return { months: [], total: 0 };

        // 통계는 진행 중인 달을 빼고 낸다 (평균이 낮게 왜곡됨)
        const done = months.filter(mo => !mo.isPartial);
        const base = done.length > 0 ? done : months;
        const total = months.reduce((s, mo) => s + mo.proposed, 0);
        const totalProcessed = months.reduce((s, mo) => s + mo.processed, 0);
        const avg = Math.round(base.reduce((s, mo) => s + mo.proposed, 0) / base.length);
        const avgPerPerson = Math.round(
            base.reduce((s, mo) => s + mo.perPerson, 0) / base.length * 10
        ) / 10;
        const peak = base.reduce((a, b) => (b.proposed > a.proposed ? b : a), base[0]);

        // 최근 6개월(진행 중 제외)의 처리 완료 비율 — "밀려 있음"을 수치로 보여주는 핵심
        const recent = done.slice(-6);
        const recentProposed = recent.reduce((s, mo) => s + mo.proposed, 0);
        const recentProcessed = recent.reduce((s, mo) => s + mo.processed, 0);

        return {
            months,
            total,
            totalProcessedPct: total > 0 ? Math.round(totalProcessed / total * 1000) / 10 : 0,
            avg,
            avgPerPerson,
            peak,
            recentMonths: recent.length,
            recentProcessedPct: recentProposed > 0
                ? Math.round(recentProcessed / recentProposed * 1000) / 10 : 0
        };
    }

    /* 섹션별 로더 — 그 섹션에 필요한 쿼리만 돈다.
       키는 services/xraySections.js 의 `loader` 값과 1:1.
       페이지 진입 시엔 아무것도 호출하지 않고, 사용자가 펼친 섹션만 여기를 탄다.

       이전엔 14개 쿼리를 Promise.all 로 전부 돌린 뒤에야 HTML 을 그리기 시작해서
       TTFB 가 2.3초였다 (가장 느린 1건이 전체를 지배). */
    const SECTION_LOADERS = {
        consensus: async () => ({ consensus: buildConsensus(await dao.getConsensusHistogram()) }),

        dissent: async () => {
            const [dissentRank, dissentStats] = await Promise.all([
                dao.getDissentRank(), dao.getDissentStats()
            ]);
            return { dissentRank, dissentStats };
        },

        gapdist: async () => {
            const [rows, stats] = await Promise.all([
                dao.getCrossPartyGapDist(), dao.getCrossPartyGapStats()
            ]);
            return { gapDist: buildGapDist(rows, stats) };
        },

        ratedist: async () => {
            const [rows, stats] = await Promise.all([
                dao.getCrossPartyRateDist(), dao.getCrossPartyRateStats()
            ]);
            return { rateDist: buildRateDist(rows, stats) };
        },

        /* 산점도만 두면 "뭘 봐야 하나" 로 끝난다. 결론을 숫자로 뽑아 목록 위에 얹는다.
           ⚠️ 추가 쿼리 없음 — 이미 받은 배열에서 센다 */
        propose: async () => {
            const rows = await dao.getProposePass();
            const rate = (r) => (r.proposed > 0 ? r.passed / r.proposed : 0);
            const N = 10;
            const topProposed = new Set([...rows].sort((a, b) => b.proposed - a.proposed).slice(0, N).map(r => r.mona_cd));
            const topRate = [...rows].sort((a, b) => rate(b) - rate(a)).slice(0, N).map(r => r.mona_cd);
            return {
                proposePass: rows,
                proposeStats: {
                    total: rows.length,
                    topN: N,
                    // 🔴 이 섹션의 결론 — 많이 내는 것과 통과시키는 것은 다른 일이다
                    overlap: topRate.filter(id => topProposed.has(id)).length
                }
            };
        },

        funnel: async () => {
            const [funnel, committeeRate] = await Promise.all([
                dao.getFunnel(), dao.getCommitteeProcessRate()
            ]);
            return { funnel, committeeRate };
        },

        crossparty: async () => {
            const [stats, rank] = await Promise.all([
                dao.getCrossPartyStats(), dao.getCrossPartyRank()
            ]);
            return {
                crossParty: {
                    stats,
                    multiPct: stats && Number(stats.total_bills) > 0
                        ? Math.round(Number(stats.multi_party_bills) / Number(stats.total_bills) * 1000) / 10
                        : 0,
                    rank
                }
            };
        },

        leader: async () => {
            const rows = await dao.getLeaderSigner();
            /* 대표 비중 = 대표발의 ÷ (대표+공동). 낮을수록 "이름만 올린" 쪽 */
            const share = rows
                .map(r => { const t = Number(r.rep_cnt) + Number(r.co_cnt); return t > 0 ? Number(r.rep_cnt) / t * 100 : null; })
                .filter(v => v != null)
                .sort((a, b) => a - b);
            const mid = share.length
                ? (share.length % 2 ? share[(share.length - 1) / 2]
                                    : (share[share.length / 2 - 1] + share[share.length / 2]) / 2)
                : 0;
            return {
                leaderSigner: rows,
                leaderStats: {
                    total: rows.length,
                    medianSharePct: Math.round(mid * 10) / 10,
                    // 대표 비중이 5% 미만 = 사실상 서명 위주
                    signerCnt: share.filter(v => v < 5).length
                }
            };
        },

        absent: async () => {
            const [absentRank, absentStats] = await Promise.all([
                dao.getAbsentRank(), dao.getAbsentStats()
            ]);
            return { absentRank, absentStats };
        },

        gap: async () => ({ citizenGap: await dao.getCitizenGap() }),

        spectrum: async () => ({ spectrum: buildSpectrum(await dao.getPartySpectrum()) }),

        category: async () => ({ categoryCounts: await dao.getCategoryCounts() }),

        monthly: async () => ({ monthly: buildMonthlyPropose(await dao.getMonthlyPropose()) })
    };

    /* 메모리 캐시 — 이 지표들은 배치가 도는 하루 1회만 바뀐다.
       두 번째 사용자부터는 DB 를 타지 않는다. utils/dataFreshness.js 와 같은 방식.
       인스턴스별 캐시라 재시작하면 비는데, 그래도 무방한 성격의 데이터다. */
    const CACHE_TTL_MS = 10 * 60 * 1000;
    const cache = new Map();   // loaderKey → { data, at }

    /* 같은 섹션에 요청이 몰릴 때 쿼리가 중복 실행되지 않게 진행 중 Promise 를 공유 */
    const inflight = new Map();

    async function loadSection(loaderKey) {
        const loader = SECTION_LOADERS[loaderKey];
        if (!loader) throw new Error(`알 수 없는 X레이 섹션 로더: ${loaderKey}`);

        const hit = cache.get(loaderKey);
        if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

        if (inflight.has(loaderKey)) return inflight.get(loaderKey);

        const p = (async () => {
            try {
                const data = await loader();
                cache.set(loaderKey, { data, at: Date.now() });
                return data;
            } finally {
                inflight.delete(loaderKey);
            }
        })();
        inflight.set(loaderKey, p);
        return p;
    }

    return {
        loadSection,
        /* 캐시 상태 점검용 (운영 디버깅) */
        cacheStats: () => [...cache.entries()].map(([k, v]) => ({
            section: k, ageSec: Math.round((Date.now() - v.at) / 1000)
        }))
    };
};
