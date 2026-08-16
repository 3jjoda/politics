// services/PoliticianService.js

import logger from '../utils/logger.js';
import PoliticianDao from '../daos/PoliticianDao.js';

/* 클립 URL → **회의 전체 영상** URL.
   `no=` 가 클립을 특정하고 `mc·ct1·ct2·ct3` 가 회의를 특정한다. `no=` 만 떼면 그 회의 페이지가
   열린다 (2026-08-15 실측 확인 — 제438회 제01차 기후에너지환경노동위원회로 정상 이동).
   ⚠️ 원천이 `http://` 로 주는데 사이트는 https 다. 그대로 링크하면 브라우저가 경고를 띄우는
      경우가 있어 https 로 올린다 (원천도 https 를 서빙한다). */
const meetingVodUrl = (clipUrl) => {
    if (!clipUrl) return null;
    try {
        const u = new URL(clipUrl);
        u.searchParams.delete('no');
        u.protocol = 'https:';
        return u.toString();
    } catch {
        return clipUrl;   // 파싱 실패 시 원본 그대로 — 링크가 사라지는 것보다 낫다
    }
};

/* 발언 요약을 화면 모양으로 — 값이 없으면 통째로 null 을 돌려 뷰가 섹션을 안 그리게 한다.
   ⚠️ **평균 대비·백분위·순위를 만들지 않는다** (UI 방침, ROADMAP 12번).
      위원회마다 회의 수가 다르고 위원장·장관은 구조가 달라 숫자를 나란히 세우면 곧 오해가 된다.
      비율은 **그 의원 안에서의 구성비**(회의 종류 분포)까지만 낸다. */
/* 🔴 비율을 화면에 낼 최소 분모. MV 의 `in_cohort` 와 **같은 값이어야 한다** —
      어긋나면 "평균 계산에는 안 들어갔는데 화면엔 비율이 뜨는" 행이 생긴다.
      실측 근거: 근사 소속기간 2개월 미만 구간은 평균 분모가 2.4개뿐이라 중앙값이 **100%** 다
      (첫 회의는 정의상 발언한 회의라 1/1 이 보장된다). 11개 위쪽은 소속기간과 무관하게
      45~55% 로 수렴한다. 자세한 근거는 마이그레이션 파일 주석 참조. */
const MIN_RATE_DENOM = 11;

/* 참여율을 화면 모양으로.
   🔴 순위(N명 중 M위)를 만들지 않는다 — 쌍마다 분모가 3~103개로 달라서 한 줄로 세우면
      순위가 활동이 아니라 표본 크기를 재게 된다. 평균 대비 위치까지만 낸다. */
const shapeRates = (rateRows) => {
    if (!rateRows || rateRows.length === 0) return null;
    const cohortAvg = rateRows[0].cohort_avg;

    const items = rateRows.map((r) => {
        const show = r.denom >= MIN_RATE_DENOM;
        const rate = r.rate === null ? null : Number(r.rate);
        /* 🔴 장관·의장단·퇴임은 비율을 **보여주되 평균과 겨루지 않는다.**
           상임위 활동이 줄어드는 게 당연한 자리라(실측 평균 37.2% vs 전체 49.7%) 평균선 옆에
           두면 곧바로 "게으르다" 로 읽힌다. 값을 숨기지도 않는다 — 사실이고, 숨기면 왜 없는지
           설명할 수 없다. 대신 이유를 옆에 적는다. */
        const offDuty = r.excluded_reason === 'office' || r.excluded_reason === 'retired';
        const comparable = show && !offDuty && cohortAvg != null;
        /* 평균 대비 차이. 🔴 화면에서 **글자로** 쓰라고 만든 값이다 — 막대 위 마커만으로는
           "그래서 평균보다 위인가" 를 눈으로 재야 하고, 폭 1,186px 짜리 막대에서 2px 선은
           사실상 안 보인다. 소수 1자리까지만 (분모가 얇아 그 이상은 정밀도가 없다). */
        const delta = comparable ? Math.round((rate - cohortAvg) * 10) / 10 : null;
        return {
            deptNm: r.dept_nm,
            jobResNm: r.job_res_nm,
            spoke: r.spoke,
            denom: r.denom,
            chairMeetings: r.chair_meetings,
            isSpecial: r.is_special,
            proxyStart: r.proxy_start,
            // 시작일이 관측 이력에서 왔나(true) 첫 발언일 근사인가(false)
            startExact: r.start_exact,
            // 분모가 얇으면 비율을 감춘다. 건수는 그대로 보여준다 (섹션이 사라지면 더 이상하다)
            showRate: show,
            rate: show ? rate : null,
            // 평균과 겨루지 않는 행 — 평균선·강조색을 끄고 이유를 적는다
            offDuty,
            offDutyNote: r.excluded_reason === 'retired'
                ? '임기 종료'
                : (r.office_title || '겸직'),
            // 평균 대비 — 5%p 안쪽은 '비슷' 으로 묶는다 (그 아래는 표본 오차 범위다)
            vsAvg: comparable
                ? (rate >= cohortAvg + 5 ? 'above' : rate <= cohortAvg - 5 ? 'below' : 'near')
                : null,
            delta,
            /* ⚠️ '비슷' 구간에까지 ±0.4%p 같은 숫자를 붙이지 않는다 — 분모가 얇아 그 정도 차이는
               의미가 없는데, 숫자를 쓰는 순간 의미가 있는 것처럼 읽힌다.
               ⚠️ 하이픈(-)이 아니라 진짜 빼기 기호(−, U+2212). 하이픈은 폭이 좁아 글머리로 보인다. */
            deltaLabel: delta == null
                ? null
                : (Math.abs(delta) < 5
                    ? '평균과 비슷'
                    : `평균 ${delta > 0 ? '+' : '−'}${Math.abs(delta)}%p`),
        };
    });

    /* 근사 시작일을 쓴 행이 하나라도 있으면 "값이 후하다" 는 주의 문구를 낸다.
       소속 이력이 쌓여 전부 exact 가 되면 그 문구는 **저절로 사라진다** — 그게 이력을 넣은 이유다.
       섞여 있는 동안에는 어느 행이 근사인지 표시해야 하므로 mixed 를 따로 준다. */
    const shown = items.filter((i) => i.showRate);
    const hasApprox = shown.some((i) => !i.startExact);
    const hasExact = shown.some((i) => i.startExact);

    return {
        items,
        cohortAvg,
        cohortSize: rateRows[0].cohort_size,
        minDenom: MIN_RATE_DENOM,
        /* 평균 마커가 실제로 그려지는 행이 하나라도 있는가 — 소제목의 범례를 이걸로 켠다.
           분모가 얇거나(비율 없음) 겸직·퇴임(비교 안 함)뿐이면 마커가 한 줄도 안 그려지는데,
           그때 범례만 남으면 "이 표시가 어디 있다는 거지" 가 된다 */
        hasComparable: shown.some((i) => !i.offDuty),
        hasApprox,
        // 근사와 정확이 섞여 있으면 행마다 어느 쪽인지 밝혀야 한다
        mixedStart: hasApprox && hasExact,
    };
};

/* ===== KPI 백분위 =====
   🔴 쿼리가 **코호트 전체(309행, 실측 695ms)** 를 한 번에 낸다. 의원마다 돌리면 안 되는 무게라
      여기서 10분 캐시하고 mona_cd 로 찾아 쓴다. 입력이 하루 1회(syncBills·syncVotes)만 바뀌어 안전하다.
   ⚠️ inflight 공유가 없으면 캐시가 비었을 때 동시 요청이 전부 같은 쿼리를 돌린다
      (XrayService 섹션 캐시·utils/sitemap.js 와 같은 수법). */
const KPI_TTL_MS = 10 * 60 * 1000;
let kpiCache = null;        // { at, byMona: Map }
let kpiInflight = null;

/* 백분위 → 사람이 읽는 말.
   ⚠️ 항상 "상위 N%" 로 쓰면 최하위가 **"상위 100%"** 가 되어 정반대로 읽힌다.
      절반을 기준으로 상위/하위를 뒤집는다 (pr=0 → 하위 1%, pr=1 → 상위 1%). */
const rankLabel = (pr) => {
    if (pr == null) return null;
    const top = Math.max(1, Math.round((1 - pr) * 100));
    return top <= 50 ? `상위 ${top}%` : `하위 ${101 - top}%`;
};

/* 백분위를 못 내는 이유. 🔴 화면이 **이유를 써야** 하므로 불리언 하나로 뭉치지 말 것 —
   "왜 나만 순위가 없지" 가 되면 고장으로 읽힌다 (발언기록 excluded_reason 과 같은 판단). */
const kpiExclusion = (row, kind) => {
    if (!row.active_yn)  return '임기 종료';
    if (row.is_minister) return '국무위원 겸직';
    if (kind === 'vote') {
        if (row.is_speaker)    return '의장단';
        if (row.vote_tot < 100) return '표결 기록 부족';
    } else if (!row.full_tenure) {
        return '임기 중 합류';
    }
    return null;
};

const shapeKpiRow = (row) => {
    if (!row) return null;
    const one = (pr, kind) => {
        const reason = kpiExclusion(row, kind);
        if (reason) return { excluded: reason };
        if (pr == null) return { excluded: '비교 대상 없음' };
        return { pr, pct: Math.round(pr * 100), label: rankLabel(pr) };
    };
    return {
        cohortCnt:  row.n_cnt,
        cohortVote: row.n_vote,
        median: {
            propose:   row.med_propose,
            copropose: row.med_copropose,
            vote:      row.med_vote,
            passRate:  row.med_pass_rate,
            leadShare: row.med_lead_share,
        },
        propose:   one(row.pr_propose,   'cnt'),
        copropose: one(row.pr_copropose, 'cnt'),
        vote:      one(row.pr_vote,      'vote'),
    };
};

const shapeSpeeches = (summary, meetingRows) => {
    const memberCnt = summary?.member_cnt || 0;
    const chairCnt = summary?.chair_cnt || 0;
    const total = memberCnt + chairCnt;
    if (total === 0) return null;

    const kinds = (summary.meetings || []).map((m) => ({
        ...m,
        pct: Math.round((m.cnt / total) * 100),
    }));

    /* 회의 목록. 전부 내려보내고 **접는 건 화면이 한다** — 토글이 서버 왕복 없이 동작하도록
       (/briefing 의 위원회별 그룹과 같은 판단). 실측 최대 155행이라 페이로드 부담이 없다. */
    const meetings = (meetingRows || []).map((m) => ({
        takingDate: m.taking_date,
        confTitle: m.conf_title,
        meetingKind: m.meeting_kind,
        clipCnt: m.clip_cnt,
        // 한 회의에서 질의석·위원장석이 섞이는 경우가 있다 (위원장이 질의도 한다) → 우세한 쪽으로 라벨
        role: m.chair_cnt > m.member_cnt ? 'chair' : 'member',
        mixed: m.chair_cnt > 0 && m.member_cnt > 0,
        url: meetingVodUrl(m.sample_link),
    }));

    return {
        memberCnt,
        chairCnt,
        total,
        speechDays: summary.speech_days || 0,
        firstDate: summary.first_date,
        lastDate: summary.last_date,
        kinds,
        meetings,
        meetingCnt: meetings.length,
    };
};

export default (db) => {
    const politicianDao = PoliticianDao(db);

    return {
        getList: async () => politicianDao.getList(),
        getListWithStats: async () => politicianDao.getListWithStats(),
        getDetail: async (monaCd) => politicianDao.getDetail(monaCd),
        getCommittees: async (monaCd) => politicianDao.getCommittees(monaCd),
        getTitles: async (monaCd) => politicianDao.getTitles(monaCd),
        getTopProposers: async () => politicianDao.getTopProposers(),
        getRecentPartyMoves: async (limit) => politicianDao.getRecentPartyMoves(limit),
        getPartyCounts: async () => politicianDao.getPartyCounts(),
        getCommitteeCounts: async () => politicianDao.getCommitteeCounts(),
        getElectTypeCounts: async () => politicianDao.getElectTypeCounts(),
        getGenderStats:     async () => politicianDao.getGenderStats(),
        getAgeGroupStats:   async () => politicianDao.getAgeGroupStats(),
        getBillsByMonaCd: async (monaCd) => politicianDao.getBillsByMonaCd(monaCd),

        /* 법안 활동 탭 지연 로딩. 🔴 `kind` 는 **화이트리스트**로만 통과시킨다 —
           모르는 값은 에러가 아니라 'all' 로 조용히 접는다 (/xray/chart 와 같은 판단:
           URL 을 손으로 고쳐도 안전하고, 링크가 깨져도 빈 화면보다 낫다). */
        getBillsPage: async (monaCd, { kind, page, per } = {}) => {
            const k = ['all', 'rep', 'co'].includes(kind) ? kind : 'all';
            const p = Math.max(1, parseInt(page, 10) || 1);
            const n = Math.min(50, Math.max(1, parseInt(per, 10) || 20));
            const rows = await politicianDao.getBillsPageByMonaCd(monaCd, k, n, (p - 1) * n);
            return { rows, kind: k, page: p, per: n };
        },
        getBillCounts: async (monaCd) => politicianDao.getBillCountsByMonaCd(monaCd),

        /* 월별 표결 참여 차트의 클릭 패널 — 그 달치만.
           ⚠️ `ym` 은 반드시 형식 검증할 것 (YYYY-MM). 안 하면 임의 문자열이 SQL 인자로 간다 */
        getVotesByMonth: async (monaCd, ym) => {
            if (!/^\d{4}-\d{2}$/.test(String(ym || ''))) return null;
            return politicianDao.getVotesByMonthByMonaCd(monaCd, ym);
        },
        getVotesByMonaCd: async (monaCd) => politicianDao.getVotesByMonaCd(monaCd),

        /* 표결 내역 탭 한 페이지 (+ 결과별 필터).
           🔴 `result` 는 화이트리스트로만. 모르는 값은 에러가 아니라 'all' 로 조용히 접는다 —
              URL 을 손으로 고쳐도 안전하고, 링크가 깨져도 빈 화면보다 낫다 (/xray/chart 와 같은 판단) */
        getVotesPage: async (monaCd, { result, page, per } = {}) => {
            const RESULTS = ['찬성', '반대', '기권', '불참'];
            const r = RESULTS.includes(result) ? result : 'all';
            const p = Math.max(1, parseInt(page, 10) || 1);
            const n = Math.min(50, Math.max(1, parseInt(per, 10) || 20));
            const rows = await politicianDao.getVotesPageByMonaCd(monaCd, r, n, (p - 1) * n);
            const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
            return { rows, result: r, page: p, per: n, total };
        },
        /* 「나와의 성향 일치」 순위·변별력.
           ⚠️ 실패해도 **null 을 돌려 상세는 살린다** — 부가 정보다 */
        getMatchContext: async (axis, monaCd) => {
            try {
                if (!axis || !monaCd) return null;
                return await politicianDao.getMatchContext(axis, monaCd);
            } catch (err) {
                logger.error(`일치 순위 조회 실패: ${err.message}`);
                return null;
            }
        },

        /* 홈 D 레이어 — 성향 진단 완료 유저에게 가장 가까운 의원.
           ⚠️ 실패해도 **null 을 돌려 홈은 살린다** (부가 정보라 첫 화면을 죽이면 안 된다) */
        getTopMatches: async (axis, limit = 3) => {
            try {
                if (!axis) return null;
                return await politicianDao.getTopMatches(axis, limit);
            } catch (err) {
                logger.error(`홈 일치 의원 조회 실패: ${err.message}`);
                return null;
            }
        },
        /* 성향 진단 「의원과 비교」 — 가장 가까운/먼 N명 + 의원 전체 평균 + 축별 위치.
           모양: { total, avg:{economy,social,institution}, right:{…}, near:[…], far:[…] } · 좌표 없으면 null */
        getMatchSpread: async (axis, limit = 3) => {
            try {
                if (!axis) return null;
                const rows = await politicianDao.getMatchSpread(axis, limit);
                if (!rows.length) return null;
                const h = rows[0];
                return {
                    total: h.total,
                    avg:   { economy: h.avg_economy, social: h.avg_social, institution: h.avg_institution },
                    right: { economy: h.right_economy, social: h.right_social, institution: h.right_institution },
                    near:  rows.filter(r => r.rank_near <= limit).sort((a, b) => a.rank_near - b.rank_near),
                    far:   rows.filter(r => r.rank_far  <= limit).sort((a, b) => a.rank_far  - b.rank_far)
                };
            } catch (err) {
                logger.error(`의원 비교 조회 실패: ${err.message}`);
                return null;
            }
        },
        /* 홈 히어로 — 무작위 의원 3명의 축 좌표. 실패해도 [] 를 돌려 홈은 살린다 */
        getAxisSpotlight: async (limit = 3) => {
            try { return await politicianDao.getAxisSpotlight(limit); }
            catch (err) { logger.error(`홈 축 스포트라이트 조회 실패: ${err.message}`); return []; }
        },
        getTopicsByMonaCd: async (monaCd) => politicianDao.getTopicsByMonaCd(monaCd),
        getMonthlyBillsByMonaCd: async (monaCd) => politicianDao.getMonthlyBillsByMonaCd(monaCd),
        getVoteSummaryByMonaCd: async (monaCd) => politicianDao.getVoteSummaryByMonaCd(monaCd),
        getCrossPartyVoteByMonaCd: async (monaCd) => politicianDao.getCrossPartyVoteByMonaCd(monaCd),
        getPartyCoopByMonaCd: async (monaCd) => politicianDao.getPartyCoopByMonaCd(monaCd),
        getPartyCoopOutByMonaCd: async (monaCd) => politicianDao.getPartyCoopOutByMonaCd(monaCd),

        /* KPI 백분위 — 코호트 표를 10분 캐시하고 mona_cd 로 찾는다.
           ⚠️ 실패해도 **null 을 돌려 페이지는 살린다.** 백분위는 부가 정보라 이것 때문에
              의원 상세가 500 이 나면 안 된다 (발언기록·성향과 같은 판단). */
        getKpiPercentiles: async (monaCd) => {
            try {
                const fresh = kpiCache && (Date.now() - kpiCache.at) < KPI_TTL_MS;
                if (!fresh) {
                    if (!kpiInflight) {
                        kpiInflight = politicianDao.getKpiPercentiles()
                            .then((rows) => {
                                kpiCache = { at: Date.now(), byMona: new Map(rows.map((r) => [r.mona_cd, r])) };
                                return kpiCache;
                            })
                            .finally(() => { kpiInflight = null; });
                    }
                    await kpiInflight;
                }
                return shapeKpiRow(kpiCache?.byMona.get(monaCd));
            } catch (err) {
                logger.error(`KPI 백분위 조회 실패: ${err.message}`);
                return null;
            }
        },

        /* 의원 발언 기록 — 요약 + 회의 목록을 한 덩어리로.
           발언이 0건이면 null (뷰가 섹션 자체를 안 그린다). */
        getSpeechesByMonaCd: async (monaCd) => {
            const [summary, meetings, rates] = await Promise.all([
                politicianDao.getSpeechSummaryByMonaCd(monaCd),
                politicianDao.getSpeechMeetingsByMonaCd(monaCd),
                politicianDao.getSpeechRatesByMonaCd(monaCd),
            ]);
            const shaped = shapeSpeeches(summary, meetings);
            if (shaped) shaped.rates = shapeRates(rates);
            return shaped;
        }
    };
};
