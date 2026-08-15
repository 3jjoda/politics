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
            vsAvg: show && !offDuty && cohortAvg != null
                ? (rate >= cohortAvg + 5 ? 'above' : rate <= cohortAvg - 5 ? 'below' : 'near')
                : null,
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
        // 하나라도 비율을 낼 수 있는가 (전부 얇으면 화면에서 평균 설명을 감춘다)
        hasAny: shown.length > 0,
        hasApprox,
        // 근사와 정확이 섞여 있으면 행마다 어느 쪽인지 밝혀야 한다
        mixedStart: hasApprox && hasExact,
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
        getVotesByMonaCd: async (monaCd) => politicianDao.getVotesByMonaCd(monaCd),
        getTopicsByMonaCd: async (monaCd) => politicianDao.getTopicsByMonaCd(monaCd),
        getMonthlyBillsByMonaCd: async (monaCd) => politicianDao.getMonthlyBillsByMonaCd(monaCd),
        getTimelineByMonaCd: async (monaCd) => politicianDao.getTimelineByMonaCd(monaCd),
        getVoteSummaryByMonaCd: async (monaCd) => politicianDao.getVoteSummaryByMonaCd(monaCd),
        getCrossPartyVoteByMonaCd: async (monaCd) => politicianDao.getCrossPartyVoteByMonaCd(monaCd),
        getPartyCoopByMonaCd: async (monaCd) => politicianDao.getPartyCoopByMonaCd(monaCd),
        getRadarScale: async () => politicianDao.getRadarScale(),

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
