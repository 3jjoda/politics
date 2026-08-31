// controllers/PromoController.js — SNS 운영용 카드 생성 페이지 (운영자 도구)
//
// /promo/numbers — 「숫자 캐러셀」 (SNS.md 백로그 1). 인스타 4:5 카드를 브라우저에서 그려
// cardShot.js 로 PNG 를 받는다 (브리핑 인스타 카드와 같은 방식 · ?slide=N = 1080×1350 1:1).
//
// 🔴 숫자는 화면에 하드코딩하지 않는다 — getHomeFacts(10분 캐시)가 그날 값을 준다.
//    카드에 "22대 국회 · 날짜 기준" 이 항상 붙는 이유다 (SNS.md 생산 규칙 3).
// 🔴 시리즈 문안은 홈 B 섹션·용어 설명과 같은 말이어야 한다 — 카드가 혼자 다른 주장을 하면 안 된다.
//    특히 불참 시리즈의 "게으름이 아니다" 각주는 KPI 코호트 제외 사유와 같은 내용이다.
// ⚠️ 라우트는 공개다 (브리핑 카드와 같은 판단 — 같은 공개 데이터를 다르게 그린 것뿐이고,
//    막으면 로그인 상태에 따라 미리보기가 안 된다). noindex + robots /promo 차단.

import BillService from '../services/BillService.js';
import PoliticianService from '../services/PoliticianService.js';
import IssueService from '../services/IssueService.js';
import { ISSUES } from '../utils/issues.js';
import { AXIS_META, MATCH_AXES, TYPE_NAMES } from '../utils/axisConfig.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';
import logger from '../utils/logger.js';

const nf = (n) => Number(n).toLocaleString('ko-KR');

/* 문안에 박히는 표시용 호스트. BASE_URL 이 로컬이면 대표 도메인으로 떨어뜨린다
   (utils/threadsPost.js 와 같은 판단 — 복사 텍스트에 localhost:3000 이 박히면 안 된다). */
const hostOf = (base) => {
    const local = !base || base.includes('localhost') || base.includes('127.0.0.1');
    let h = local ? 'https://dangmalsa.kr' : base;
    h = h.replace('https://', '').replace('http://', '');
    while (h.endsWith('/')) h = h.slice(0, -1);
    return h;
};

/* 쟁점 문안 — SNS.md 5장 주간 슬롯 「쟁점」 (2026-08-26).
   🔴 **뉴스에 대응하는 글이 아니다.** 뉴스를 몰라도 읽히는 글이어야 기록이고, 알아야 이해되면 반응이다
      — `논란`·`요즘`·`지금 시끄러운` 같은 말을 쓰지 말 것 (SNS.md 10장 「뉴스 반응 계정처럼 굴기」).
   🔴 **정당별 건수를 쓰지 않는다.** 의석수가 달라 그대로 비교하면 오해가 되는데, 500자 안에 그 각주가 안 들어간다.
      `N개 정당이 각자 안을 냈다` 까지만 — 쟁점 페이지의 `why` 가 쓰는 것과 같은 형태다.
   🔴 **숫자는 IssueService 가 렌더 시 준다** (10분 캐시). 문안에 박지 말 것 — 매일 움직인다.
   ⚠️ 훅은 쟁점마다 다르게 손으로 쓴다. 공통 템플릿으로 찍으면 여섯 개가 다 같은 글이 된다.
      대신 **방향이 여럿이라는 사실**은 여섯 개 모두 담는다 — 그게 이 사이트가 뉴스와 다른 지점이다. */
const ISSUE_HOOKS = {
    'court-administration': {
        q: '법원행정처를 어떻게 할지, 국회에는 이미 여러 안이 올라와 있습니다.',
        body: '대법원장에게 몰린 인사·예산 권한을 나누자는 안, 폐지하고 외부인이 참여하는 위원회를 두자는 안, 대법원을 지방으로 옮기자는 안까지 방향이 제각각입니다.',
    },
    'jeonse-fraud': {
        q: '전세사기 피해 지원, 특별법이 생긴 뒤로 국회는 어디까지 왔을까요?',
        body: '보증금을 어디까지 돌려줄지, 누구를 피해자로 볼지, 기간을 얼마나 늘릴지가 안마다 다릅니다.',
    },
    'juvenile-offender': {
        q: '촉법소년 나이를 낮추자는 말은 자주 들리는데, 법안은 어떻게 됐을까요?',
        body: '형사처벌을 받지 않는 나이를 낮추자는 안이 여러 건 올라와 있고, 처벌 대신 교정·보호를 늘리자는 안도 같이 계류 중입니다.',
    },
    'prosecution-investigation': {
        q: '검찰 수사권을 어디까지 둘지, 국회에 올라온 안은 한두 개가 아닙니다.',
        body: '수사를 다른 기관으로 넘기자는 안, 다시 넓히자는 안, 보완수사 범위만 손보자는 안이 같이 계류 중입니다.',
    },
    'inter-korean-exchange': {
        q: '남북 교류·협력에 관한 법안이 지금 국회에 몇 건이나 있을까요?',
        body: '교류와 지원을 넓히자는 안과 절차를 조이자는 안이 같은 법률에 함께 올라와 있습니다.',
    },
    'national-pension': {
        q: '국민연금을 어떻게 고칠지, 정당마다 각자 안을 내놨습니다.',
        body: '보험료율을 얼마로 할지, 언제부터 받을지, 국가가 지급을 보장할지가 안마다 다릅니다.',
    },
};

/* 쟁점 데이터 → 쓰레드 문안 하나. 실패하거나 재료가 모자라면 null 을 돌려 그 쟁점만 빠진다. */
function buildIssuePost(d, host) {
    if (!d || !d.stats || !d.stats.total) return null;
    const h = ISSUE_HOOKS[d.issue.slug];
    if (!h) return null;
    const s = d.stats;
    const cmt = (d.benchmark || []).find((r) => r.key === 'cmt');
    const parties = (s.byParty || []).filter((p) => p.label && p.label !== '(명부 없음)').length;
    const longest = d.outcome ? d.outcome.longestWait : null;

    const lines = [h.q, '', h.body, ''];
    // 🔴 어느 쪽이 낫다고 쓰지 않는다 — 두 숫자를 나란히 놓고 비교는 읽는 사람에게 맡긴다
    const cmtDone = cmt && cmt.detail ? parseInt(cmt.detail, 10) : null;   // detail = '3건 / 27건'
    if (cmt && cmt.mine != null && cmt.all != null && Number.isFinite(cmtDone)) {
        lines.push(`${parties >= 2 ? `${parties}개 정당이 각자 안을 냈는데, ` : ''}위원회 문턱을 넘은 건 ${s.total}건 중 ${cmtDone}건입니다. 국회 전체 평균은 ${cmt.all}%예요.`);
    } else {
        lines.push(`${parties >= 2 ? `${parties}개 정당이 각자 안을 냈고, ` : ''}지금까지 ${s.total}건이 올라왔습니다.`);
    }
    lines.push('');
    lines.push(longest != null
        ? `${s.pending}건은 아직 심사 중이고, 가장 오래 기다린 건 ${nf(longest)}일째입니다.`
        : `${s.pending}건은 아직 심사 중입니다.`);

    return {
        slug: d.issue.slug,
        title: d.issue.title,
        sub: d.issue.sub || '',
        main: lines.join('\n'),
        reply: `법률별로 어떤 안이 올라와 있는지, 통과되면 뭐가 달라지는지 정리해뒀습니다. ${host}/issue/${d.issue.slug}`,
        basis: `법안 ${s.total}건 · 계류 ${s.pending}건 · 법률 ${s.lawCount}종 · 서명 의원 ${d.signers.length}명 — /issue/${d.issue.slug} 와 같은 값 (렌더 시 DB)`,
    };
}


/* 시리즈 정의 — facts(getHomeFacts 행) → 슬라이드 배열.
   kind: num(큰 숫자) · bridge(중간 숫자+전환) · ask(질문) · process(발의→가결 단계) · outro(브랜드) */
const SERIES = {
    pending: {
        label: '계류',
        title: '법안 4건 중 3건',
        tags: ['입법', '법안처리'],
        slides: (f) => [
            { kind: 'num', kicker: `22대 국회의 법안 ${nf(f.bill_total)}건 중`, big: `${f.pending_rate}%`,
              line: '발의된 법안 4건 중 3건은 아직 위원회에 있습니다' },
            { kind: 'bridge', kicker: '그런데 이 숫자에는 뒷이야기가 있습니다', big: `${nf(f.bill_pending_over_1y)}건`,
              line: '발의된 지 1년이 넘도록 결론이 나지 않았습니다',
              sub: '법안을 냈다고 심사되는 것은 아닙니다. 임기가 끝나면 심사받지 못한 법안은 폐기됩니다.' },
            { kind: 'ask', head: '법안을 많이 발의한 의원이\n일을 많이 한 의원일까요?',
              sub: '발의 건수만으로는 알 수 없습니다. 몇 건이 심사를 통과했는지, 어디서 멈췄는지가 같이 보여야 합니다.' },
            { kind: 'process', head: '당말사는 전 과정을 봅니다', active: 1,
              note: '계류가 곧 방치는 아닙니다. 위원회 심사는 원래 오래 걸립니다. 그래서 건수 하나가 아니라 과정을 봅니다.' },
            { kind: 'outro', head: '숫자로 국회를 보면\n생각보다 다르게 보입니다' },
        ],
        caption: (f) => [
            `발의된 법안 100건 중 ${Math.round(f.pending_rate)}건은 아직 위원회에 있습니다.`,
            `그중 ${nf(f.bill_pending_over_1y)}건은 발의된 지 1년이 넘었습니다.`,
            '',
            '법안을 많이 발의한 의원이 일을 많이 한 의원일까요?',
            '당말사는 발의 → 위원회 → 본회의 → 가결, 전 과정을 봅니다.',
            '',
            '전체 기록은 프로필 링크에서.',
            '',
            '#국회 #법안 #당말사 #입법 #법안처리',
        ].join('\n'),
    },
    oppose: {
        label: '반대표',
        title: '반대는 0.7%',
        tags: ['본회의', '표결'],
        slides: (f) => {
            const per = Math.round(f.vote_total / Math.max(1, f.vote_oppose));
            return [
                { kind: 'num', kicker: `본회의 표결 ${nf(f.vote_total)}건 중`, big: `${f.oppose_rate}%`,
                  line: `반대표는 ${nf(f.vote_oppose)}건뿐입니다` },
                { kind: 'bridge', kicker: '얼마나 드문 걸까요', big: `${nf(per)}번 중 1번`,
                  line: '본회의에서 반대표가 나오는 빈도입니다',
                  sub: '본회의까지 온 법안은 거의 그대로 통과합니다.' },
                { kind: 'ask', head: '그럼 법안은\n어디서 걸러질까요?',
                  sub: `본회의가 아니라 위원회입니다. 발의된 법안 4건 중 3건이 위원회에서 결론을 기다리고 있습니다.` },
                { kind: 'process', head: '찬반보다 먼저 볼 곳', active: 1,
                  note: '위원회 심사는 의원 개인별 표결이 공개되지 않습니다. 그래서 당말사는 법안마다 날짜와 결과로 그 길을 따라갑니다.' },
                { kind: 'outro', head: '숫자로 국회를 보면\n생각보다 다르게 보입니다' },
            ];
        },
        caption: (f) => [
            `본회의 표결 ${nf(f.vote_total)}건 중 반대표는 ${f.oppose_rate}%.`,
            '본회의까지 온 법안은 거의 그대로 통과합니다.',
            '',
            '그럼 법안은 어디서 걸러질까요? 본회의가 아니라 위원회입니다.',
            '당말사는 법안마다 발의 → 위원회 → 본회의 → 가결의 길을 따라갑니다.',
            '',
            '전체 기록은 프로필 링크에서.',
            '',
            '#국회 #법안 #당말사 #본회의 #표결',
        ].join('\n'),
    },
    absent: {
        label: '불참',
        title: '다섯 번 중 한 번',
        tags: ['국회의원', '본회의'],
        slides: (f) => [
            { kind: 'num', kicker: '국회의원 절반은', big: `${f.absent_median}%`,
              line: '본회의 표결 다섯 번 중 한 번 이상 자리에 없습니다',
              meta: `의원별 불참률의 중앙값 · 표결 100건 이상 ${nf(f.absent_cohort)}명 기준` },
            { kind: 'ask', head: '기권과 불참은 다릅니다',
              sub: '기권은 표결에 참여해 찬반을 고르지 않은 것. 불참은 그 표결에 아예 없었던 것입니다. 이 숫자는 불참만 센 것입니다.' },
            { kind: 'ask', head: '불참이 많은 의원은\n게으른 의원일까요?',
              sub: '꼭 그렇지는 않습니다. 장관을 겸직하면 자리를 비우고, 국회의장은 관례상 표결에 참여하지 않습니다. 표결에 불참하는 방식으로 입장을 드러내는 경우도 있습니다.' },
            { kind: 'outro', head: '그래서 숫자 하나로\n단정하지 않습니다',
              note: '당말사는 불참을 지우지도, 단정하지도 않습니다. 이유가 있는 자리에는 이유를 함께 적습니다.' },
        ],
        caption: (f) => [
            `국회의원 절반은 본회의 표결 다섯 번 중 한 번 이상 자리에 없습니다 (의원별 불참률 중앙값 ${f.absent_median}%).`,
            '',
            '불참이 많으면 게으른 의원일까요? 꼭 그렇지는 않습니다.',
            '장관 겸직, 의장의 관례상 중립, 표결 불참으로 드러내는 입장이 섞여 있습니다.',
            '그래서 당말사는 숫자 하나로 단정하지 않고, 이유가 있는 자리에는 이유를 적습니다.',
            '',
            '전체 기록은 프로필 링크에서.',
            '',
            '#국회 #법안 #당말사 #국회의원 #본회의',
        ].join('\n'),
    },
};

export default (db) => {
    const billService = BillService(db);
    const politicianService = PoliticianService(db);
    const issueService = IssueService(db);
    const controller = {};

    controller.getNumbersCard = wrapWithContext(async function getNumbersCard(req, res, next) {
        try {
            const key = Object.prototype.hasOwnProperty.call(SERIES, req.query.series) ? req.query.series : 'pending';
            const def = SERIES[key];
            const facts = await billService.getHomeFacts();
            if (!facts) {
                return res.status(503).type('text/plain; charset=utf-8')
                    .send('숫자를 불러오지 못했습니다. 잠시 후 다시 열어주세요.');
            }
            const slides = def.slides(facts);
            const raw = req.query.slide;
            const single = raw === undefined || raw === ''
                ? null
                : Math.min(slides.length, Math.max(1, Math.floor(Number(raw) || 1)));
            // 카드에 박는 날짜 — 올리는 날 기준 (KST 고정, 로컬 getter 금지)
            const dateKo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()).replace(/-/g, '.');
            res.render('promo/numbers_card', {
                layout: false,
                seriesKey: key,
                seriesList: Object.entries(SERIES).map(([k, v]) => ({ key: k, label: v.label, title: v.title })),
                def, slides, single, dateKo,
                caption: def.caption(facts),
            });
        } catch (error) {
            logger.error('숫자 캐러셀 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 진단 캐러셀 — 성향 진단 홍보 6장 (SNS.md 백로그 2).
       🔴 TOP3 장은 실명이 아니라 **마스킹 목업**이다 — 계정이 의원을 골라 보이는 순간 편집이 된다 (SNS.md 하지 말 것 2).
       🔴 "N명" 은 세 축 좌표가 다 있는 의원 수를 렌더 시 센다 (axis cloud 길이) — 269 를 하드코딩하지 않는다.
       문항 수도 DB(packs.question_count)에서 읽는다 — 문항 교체 이력이 있는 값이라 박아두면 조용히 거짓이 된다. */
    controller.getBalanceCard = wrapWithContext(async function getBalanceCard(req, res, next) {
        try {
            const [cloud, packRow] = await Promise.all([
                politicianService.getAxisCloud(),
                db.query(`SELECT question_count FROM balance_game_packs WHERE pack_id = 'general'`)
                  .then((r) => r.rows[0]).catch(() => null),
            ]);
            if (!cloud || !cloud.length) {
                return res.status(503).type('text/plain; charset=utf-8')
                    .send('의원 좌표를 불러오지 못했습니다. 잠시 후 다시 열어주세요.');
            }
            const polTotal = cloud.length;
            const qCount = Number(packRow?.question_count) || 20;
            const axes = MATCH_AXES.map((k) => AXIS_META[k]);
            // 사분면 이름 4종 — 지도 모서리 라벨 (utils/axisConfig.js TYPE_NAMES 단일 소스)
            const quads = {
                LR: TYPE_NAMES['L,R'].name, RR: TYPE_NAMES['R,R'].name,
                LL: TYPE_NAMES['L,L'].name, RL: TYPE_NAMES['R,L'].name,
            };
            const slides = [
                { kind: 'hook' }, { kind: 'reframe' }, { kind: 'axes' },
                { kind: 'map' }, { kind: 'mock' }, { kind: 'outro' },
            ];
            const raw = req.query.slide;
            const single = raw === undefined || raw === ''
                ? null
                : Math.min(slides.length, Math.max(1, Math.floor(Number(raw) || 1)));
            const dateKo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()).replace(/-/g, '.');
            const caption = [
                `국회의원 ${nf(polTotal)}명 중 당신과 가장 가까운 사람은 누구일까요?`,
                '',
                '정치 성향은 보수 / 진보 하나로 설명되지 않습니다.',
                `당말사는 경제 · 사회문화 · 정치제도, 세 개의 축으로 봅니다.`,
                `${qCount}개의 질문에 답하면 국회의원 ${nf(polTotal)}명과 비교해드립니다. 로그인 없이 약 5분.`,
                '',
                '프로필 링크에서 바로 해볼 수 있습니다.',
                '',
                '#국회 #법안 #당말사 #국회의원 #성향테스트',
            ].join('\n');
            res.render('promo/balance_card', {
                layout: false,
                slides, single, dateKo, polTotal, qCount, axes, quads, cloud, caption,
            });
        } catch (error) {
            logger.error('진단 캐러셀 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 쓰레드 문안 뱅크 — 대화형 포스트 10개 + 셀프 답글 (SNS.md 백로그 3).
       공식: 질문 → 반전 → 데이터 → (셀프 답글에서) 당말사. 🔴 첫 포스트에는 링크를 넣지 않는다.
       🔴 **링크는 홈이 아니라 그 주장을 보여주는 페이지로 보낸다** (2026-08-27). 홈으로 보내면 방문자가
          방금 읽은 숫자를 스스로 찾아야 하는데, 홈 B 섹션은 히어로를 지나 스크롤해야 나온다 —
          "실제 숫자는 당말사에 있습니다" 라고 해놓고 못 찾으면 그 글은 광고가 된다.
          `/xray#xr-<id>` 는 그 섹션만 펼쳐서 열리고, `/politician?sort=` 는 정렬된 채로 열린다. 이 착지점을 홈으로 되돌리지 말 것.
       🔴 답글은 **본문 직후 내가 이어 다는 것**이지 남의 댓글을 기다리는 게 아니다 — 기다리면 계정 초기엔
          링크가 영영 안 나간다 (유일한 전환 경로를 남의 행동에 걸어두는 셈). 아래 reply 가 전부
          가상의 반문에 스스로 답하는 셀프 답글 문체인 것도 그래서다. 실제 댓글 대응은 일일 루틴의 답글 시간이 맡는다.
       🔴 숫자는 렌더 시 DB — 게시 직전에 이 페이지를 새로 열면 그날 값으로 채워진다.
       ⚠️ 문안 4(거수기)는 그 말을 **안 쓰기로 했다는 것** 자체가 내용이다 — 평가어를 쓰는 문안으로 고치지 말 것 */
    controller.getThreadsBank = wrapWithContext(async function getThreadsBank(req, res, next) {
        try {
            const [facts, cpvR, dupR, monaR] = await Promise.all([
                billService.getHomeFacts(),
                db.query(`SELECT COUNT(*)::int AS n
                               , ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY own_rate)::numeric, 1)   AS own_med
                               , ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY other_rate)::numeric, 1) AS other_med
                               , ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap)::numeric, 1)        AS gap_med
                               , ROUND(MAX(gap)::numeric, 1)                                                AS gap_max
                            FROM politician_cross_party_vote WHERE in_cohort`).then((r) => r.rows[0]),
                db.query(`WITH g AS (SELECT bill_name, COUNT(*)::int AS cnt FROM bills GROUP BY bill_name)
                          SELECT ROUND(100.0 * SUM(cnt) FILTER (WHERE cnt > 1) / SUM(cnt))::int AS dup_share
                               , (SELECT bill_name FROM g ORDER BY cnt DESC LIMIT 1)            AS top_law
                               , (SELECT cnt FROM g ORDER BY cnt DESC LIMIT 1)                  AS top_cnt
                            FROM g`).then((r) => r.rows[0]),
                db.query(`SELECT mona_cd FROM politicians WHERE active_yn LIMIT 1`).then((r) => r.rows[0]),
            ]);
            if (!facts || !cpvR) {
                return res.status(503).type('text/plain; charset=utf-8').send('숫자를 불러오지 못했습니다. 잠시 후 다시 열어주세요.');
            }
            // 발의 중앙값 — KPI 코호트와 같은 값을 쓴다 (캐시된 표에서 아무 의원이나 꺼내면 median 이 같이 온다)
            const kpi = monaR ? await politicianService.getKpiPercentiles(monaR.mona_cd) : null;
            const medPropose = kpi?.median?.propose != null ? Math.round(kpi.median.propose) : null;
            const f = facts;
            const per = Math.round(f.vote_total / Math.max(1, f.vote_oppose));
            const passRate = (100 * f.bill_passed / Math.max(1, f.bill_total)).toFixed(1);
            const link = 'dangmalsa.kr';

            const POSTS = [
                { cat: '상식 뒤집기', title: '발의 건수는 성적표가 아니다',
                  main: `국회의원이 법안을 많이 발의했다고 일을 많이 한 의원이라고 볼 수 있을까요?\n\n저는 아니라고 봅니다. 발의 → 위원회 → 본회의 → 가결까지 봐야 하니까요.\n\n지금 국회에 발의된 법안 4건 중 3건(${f.pending_rate}%)은 아직 위원회에 있습니다.`,
                  reply: `"그럼 가결률이 높은 의원이 일 잘한 의원인가?" 이것도 함정입니다. 가결이 똑같이 1건이어도 많이 낸 의원일수록 가결률은 낮아지거든요. 그래서 비율 하나로 줄 세우지 않고 과정을 통째로 보여주려고 합니다. 발의부터 가결까지 단계마다 몇 %가 남는지 그려뒀어요. ${link}/xray#xr-funnel`,
                  basis: `계류 비율 = getHomeFacts (홈 B 섹션과 같은 값)` },
                { cat: '상식 뒤집기', title: '국회는 매일 싸우는 곳?',
                  main: `본회의 중계만 보면 국회는 매일 싸우는 곳 같습니다.\n\n그런데 표결 기록은 다릅니다. 본회의 표결 ${nf(f.vote_total)}건 중 반대표는 ${f.oppose_rate}%. ${nf(per)}번에 한 번꼴입니다.\n\n갈리는 곳은 본회의가 아니라 위원회입니다. 법안 4건 중 3건이 거기 멈춰 있거든요.`,
                  reply: `위원회 심사는 의원 개인별 표결이 공개되지 않습니다. 그래서 저희는 법안마다 날짜와 결과로 그 길을 따라갑니다. 왜 반대표가 이렇게 적은지 따로 정리해뒀어요. ${link}/guide/why-so-few-no-votes`,
                  basis: `반대 비율·표결 수 = getHomeFacts` },
                { cat: '숫자 질문', title: '상대 당 법안 찬성률',
                  main: `국회의원은 상대 당이 낸 법안에 몇 %나 찬성할까요?\n\n${cpvR.other_med}%입니다. 자기 당(${cpvR.own_med}%)과 차이가 ${cpvR.gap_med}%p뿐입니다.\n\n본회의까지 온 법안은 이미 여야가 걸러낸 뒤라서요. 그런데 이 격차가 ${Math.floor(cpvR.gap_max)}%p를 넘는 의원도 있습니다.`,
                  reply: `누구인지는 사이트에 있습니다. 의원 ${cpvR.n}명을 격차가 큰 순서로 세워뒀어요. ${link}/politician?sort=gap-desc`,
                  basis: `중앙값·최대 격차 = politician_cross_party_vote (표결 코호트 ${cpvR.n}명)` },
                { cat: '상식 뒤집기', title: '거수기라는 말',
                  main: `당론을 잘 따르는 의원을 '거수기'라고 부르곤 합니다.\n\n저희는 그 말을 쓰지 않기로 했습니다. 다수당과 소수당은 의사일정 구조가 달라서, 같은 숫자도 사정이 다르거든요.\n\n대신 자기 당 법안과 상대 당 법안 찬성률의 격차만 보여줍니다. 이름을 붙이는 건 보는 분의 몫입니다.`,
                  reply: `격차 분포(중앙값 ${cpvR.gap_med}%p · 최대 ${cpvR.gap_max}%p)는 여기 정리돼 있습니다. ${link}/xray#xr-gapdist`,
                  basis: `평가어를 쓰지 않는다는 사이트 원칙 그 자체가 내용 (용어 설명·해설 4편과 같은 말)` },
                { cat: '상식 뒤집기', title: '불참 = 게으름?',
                  main: `국회의원 절반은 본회의 표결 다섯 번 중 한 번 이상 자리에 없습니다. 의원별 불참률 중앙값이 ${f.absent_median}%거든요.\n\n게으른 걸까요? 꼭 그렇지는 않습니다. 장관을 겸직하면 자리를 비우고, 국회의장은 관례상 표결에 참여하지 않습니다. 불참으로 입장을 드러내는 경우도 있고요.\n\n숫자 하나로 사람을 판정할 수 없어서, 이유가 있는 자리에는 이유를 같이 적고 있습니다.`,
                  reply: `의원마다 월별 표결 참여와 그 이유(겸직 등)를 이름으로 볼 수 있습니다. ${link}/politician`,
                  basis: `불참 중앙값 = getHomeFacts · 겸직/의장 사유 = KPI 코호트 제외 사유와 같은 내용` },
                { cat: '상식 뒤집기', title: '법안 이름의 비밀',
                  main: `국회 법안의 ${dupR.dup_share}%는 이름이 똑같습니다.\n\n'${dupR.top_law}'만 ${nf(dupR.top_cnt)}건입니다. 베낀 게 아니라, 같은 법을 서로 다른 의원이 각자 다르게 고치자고 내는 겁니다.\n\n그래서 법안은 이름이 아니라 내용과 사람으로 구분해야 합니다.`,
                  reply: `같은 이름의 법안들을 나란히 놓고 내용·발의자를 비교해볼 수 있습니다. ${link}/bill`,
                  basis: `동명 비율·최다 법률 = bills 집계 (렌더 시)` },
                { cat: '숫자 질문', title: '1년 넘게 멈춘 법안',
                  main: `발의된 지 1년이 넘도록 결론이 나지 않은 법안이 ${nf(f.bill_pending_over_1y)}건입니다.\n\n계류가 곧 방치는 아닙니다. 위원회 심사는 원래 오래 걸립니다.\n\n다만 국회 임기가 끝나면 심사받지 못한 법안은 전부 폐기됩니다. 시간은 법안의 편이 아닙니다.`,
                  reply: `법안마다 발의 → 위원회 → 본회의의 어느 지점에 며칠째 멈춰 있는지 볼 수 있습니다. ${link}/bill`,
                  basis: `1년 초과 계류 = getHomeFacts (홈 B 섹션과 같은 값)` },
                { cat: '당신이라면?', title: '보수 아니면 진보?',
                  main: `정치 성향을 '보수 아니면 진보' 하나로 나눌 수 있을까요?\n\n경제에서는 정부 개입을 지지하면서 사회 문화에서는 개인의 자율을 지지할 수도 있습니다. 반대도 가능하고요.\n\n당신의 성향을 굳이 한 축으로 줄인다면, 어느 축이 제일 중요하세요? 경제 / 사회문화 / 정치제도.`,
                  reply: `세 축으로 재는 진단을 만들어뒀습니다. 로그인 없이 5분이면 국회의원 중 나와 가장 가까운 사람이 나옵니다. ${link}/balance-game`,
                  basis: `세 축 = axisConfig AXIS_META (진단 캐러셀과 같은 축)` },
                { cat: '당신이라면?', title: '우리 지역구 의원',
                  main: `당신 지역구 국회의원이 이번 국회에서 법안을 몇 건 발의했는지 아시나요?\n\n의원 중앙값은 ${medPropose != null ? medPropose + '건' : '56건 안팎'}입니다.\n\n뉴스는 당 대표와 원내대표만 비추니까, 나머지 의원 300명은 4년 내내 잘 안 보입니다. 내가 뽑은 사람인데도요.`,
                  reply: `지역구를 고르면 그 의원의 발의·표결·발언 기록이 전부 나옵니다. 로그인도 필요 없어요. ${link}/#mine`,
                  basis: `발의 중앙값 = KPI 코호트 (의원 상세와 같은 값)` },
                { cat: '숫자 질문', title: '가결률',
                  main: `국회에 발의된 법안 중 본회의에서 가결되는 비율은 얼마나 될까요?\n\n${passRate}%입니다.\n\n나머지는 위원회 대안으로 합쳐지거나, 발의자가 거두거나, 아직 심사 중입니다. '가결만 성공'으로 읽으면 국회를 잘못 읽게 됩니다.`,
                  reply: `대안으로 합쳐진 것(대안반영폐기)이 무슨 뜻인지 여기 풀어뒀습니다. ${link}/guide/how-a-bill-moves`,
                  basis: `가결/전체 = getHomeFacts (bill_passed/bill_total)` },
            ];
            /* 대화 답글 화법 — 실제로 달린 남의 댓글에 답할 때. 위 셀프 답글과 **다른 것**이다.
               🔴 그대로 붙여넣는 문안이 아니라 뼈대다. 상대가 쓴 말에 맞춰 고쳐 쓴다 — 복붙 답글은 티가 난다.
               🔴 seen:false 는 아직 실제로 받아본 적 없는 유형이다 (겪은 게 아니라 상상해서 쓴 것).
                  실물이 오면 그걸로 교체할 것 — 브리핑 v1 프롬프트가 그랬듯 상상한 문안은 헛돌기 쉽다. */
            const REPLIES = [
                { kind: '동의·공감', seen: true,
                  they: '"셋 다 중요해서 하나를 못 고르겠다" (2026-08-26 실제)',
                  how: '인정하고 시작 → 쉬운 예시 → 그래서 이렇게 만들었다 → 결과가 궁금하다',
                  ex: `고르기 어려운 게 맞습니다. 사실 그게 이 질문의 답이에요.

'보수 아니면 진보'는 칸이 두 개뿐이잖아요. 세금은 정부가 더 나서야 한다고 보는데 이민은 신중한 편인 사람, 어느 칸에 넣어야 할까요.

그래서 진단은 하나를 고르게 하지 않고 세 축을 각각 잽니다. 축마다 따로 나오니까 셋 다 중요하다는 게 결과에 그대로 남아요.

실제로 어디 찍히는지 저도 궁금하네요.`,
                  no: '곧바로 영업으로 넘어가기 ("맞아요! 진단 해보세요"). 먼저 그 사람이 한 말에 답한다' },

                { kind: '숫자 의심', seen: false,
                  they: '"그 숫자 과장 아닌가요"',
                  how: '계산식을 그대로 밝힌다 → 어디서 확인하는지 → 틀렸으면 바로 인정',
                  ex: `발의된 전체 법안 중 아직 처리 결과가 없는 건을 센 값입니다. 오늘 기준 ${f.pending_rate}%예요.

국회가 공개한 자료 그대로라 저희가 보정한 건 없습니다. 계산이 이상해 보이는 지점을 짚어주시면 다시 보겠습니다.`,
                  no: '"공식 자료입니다" 로 끝내기 — 근거를 안 밝히면 그것도 그냥 주장이다' },

                { kind: '특정 정당·의원 비난', seen: false,
                  they: '"○○당이 다 망쳐놨죠"',
                  how: '🔴 동조도 반박도 하지 않는다 → 스스로 확인할 수 있는 기준으로 되돌린다',
                  ex: `저희는 어느 쪽이 낫다고 말하지 않습니다.

대신 의원마다 자기 당 법안과 상대 당 법안 찬성률을 따로 내놓고 있어요. 격차 중앙값이 ${cpvR.gap_med}%p인데 여기서 크게 벗어나는 분들도 있습니다. 이름으로 보시면 됩니다.`,
                  no: '🔴 맞장구("저도 그렇게 봅니다")도, 반박("사실과 다릅니다")도 안 된다. 둘 중 하나라도 하면 계정이 편을 든 것이 된다' },

                { kind: '중립성 의심', seen: false,
                  they: '"결국 어느 편 아니냐"',
                  how: '무엇을 안 하는지 먼저 → 우리가 못 재는 것을 우리 입으로 → 확인 경로',
                  ex: `정당색을 안 쓰고, 좋은 의원·나쁜 의원 평가도 하지 않습니다.

못 재는 것도 적어뒀어요. 안보 성향은 입법 기록으로는 잴 수가 없어서 축 자체를 비워뒀습니다.

이상한 지점 보이시면 알려주세요. 그게 제일 도움이 됩니다.`,
                  no: '"저희는 중립입니다" 라고 선언하기 — 선언은 증거가 아니다. 안 하는 것과 못 하는 것을 대는 편이 세다' },

                { kind: '기능 질문', seen: false,
                  they: '"우리 지역구 의원은 어디서 봐요?"',
                  how: '경로만 짧게. 다른 기능을 붙여 팔지 않는다',
                  ex: `홈에서 지역구를 고르면 바로 나옵니다. 로그인 없이도 돼요. ${link}/#mine`,
                  no: '기능 소개를 줄줄이 붙이기 — 물어본 것만 답한다' },

                { kind: '사실 오류 지적 (우리가 틀림)', seen: false,
                  they: '"이 의원 지역구 틀렸는데요"',
                  how: '바로 인정 → 원인 → 언제 고쳐지는지 → 실제로 고친다',
                  ex: `확인해보니 맞습니다. 알려주셔서 고맙습니다.

원천 자료가 갱신되기 전 값이라 다음 갱신에 반영됩니다. 다른 것도 보이면 알려주세요.`,
                  no: '⚠️ 원천 탓만 하고 넘어가기 · 조용히 고치고 답은 안 하기. 답만 하고 안 고치면 다음부터 아무도 안 알려준다' },

                { kind: '싸움 걸기·인신공격', seen: false,
                  they: '욕설 · 인신공격 · 특정인 비방',
                  how: '🔴 답하지 않는다. 좋아요도 누르지 않는다',
                  ex: `(답글 없음)`,
                  no: '반박·해명·훈계. 한 번 받아주면 그 글타래는 그 사람 것이 된다.\n⚠️ 단 사실관계 오류가 섞여 있으면 그 부분만 한 번 짧게 정정하고 끝낸다 (반복 금지)' },
            ];

            /* 쟁점 문안 — 쟁점 6개를 IssueService(10분 캐시)에서 받아 조립한다. 추가 쿼리는 캐시 미스일 때만.
               ⚠️ 한 쟁점이 실패해도 나머지는 낸다 (도구 페이지가 통째로 죽으면 그날 운영이 막힌다). */
            const host = hostOf(process.env.BASE_URL);
            const issuePosts = (await Promise.all(
                ISSUES.map((i) => issueService.get(i.slug).catch((e) => {
                    logger.error(`쟁점 문안 조립 실패 (${i.slug}) — ${e.message}`);
                    return null;
                })),
            )).map((d) => buildIssuePost(d, host)).filter(Boolean);

            const dateKo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()).replace(/-/g, '.');
            res.render('promo/threads_bank', {
                layout: false,
                // 글자수는 코드포인트 기준 (쓰레드 500자 제한 — utils/threadsPost 와 같은 셈법)
                posts: POSTS.map((p2) => ({ ...p2, mainLen: [...p2.main].length, replyLen: [...p2.reply].length })),
                replies: REPLIES.map((r) => ({ ...r, exLen: [...r.ex].length })),
                issuePosts: issuePosts.map((q) => ({ ...q, mainLen: [...q.main].length, replyLen: [...q.reply].length })),
                dateKo,
            });
        } catch (error) {
            logger.error('쓰레드 문안 뱅크 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 브랜드 소개 캐러셀 — 30일 플랜 1주차 재료. 문안은 /about 과 같은 말이어야 한다 (거기 없는 주장을 만들지 말 것).
       구성: 훅(내가 뽑은 사람, 지금 뭘 할까) → 정체 → 무엇이 있나 → 하지 않는 것 → 한계도 밝힘 → 마무리.
       🔴 "한계도 밝힘" 장을 빼지 말 것 — 이 사이트의 차별점은 데이터가 많다가 아니라 **무엇을 모르는지 밝힌다**다 (/about 재작성 때의 결론). */
    controller.getIntroCard = wrapWithContext(async function getIntroCard(req, res, next) {
        try {
            const [facts, polR] = await Promise.all([
                billService.getHomeFacts(),
                db.query(`SELECT COUNT(*)::int AS n FROM politicians`).then((r) => r.rows[0]).catch(() => null),
            ]);
            const billTotal = facts ? facts.bill_total : null;
            const polTotal = polR ? polR.n : null;
            const slides = [
                { kind: 'hook' }, { kind: 'who' }, { kind: 'what' },
                { kind: 'not' }, { kind: 'limits' }, { kind: 'outro' },
            ];
            const raw = req.query.slide;
            const single = raw === undefined || raw === ''
                ? null
                : Math.min(slides.length, Math.max(1, Math.floor(Number(raw) || 1)));
            const dateKo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()).replace(/-/g, '.');
            const caption = [
                '내가 뽑은 국회의원, 지금 뭘 하고 있을까요?',
                '',
                '당말사는 국회가 공개한 자료를 그대로 모아, 내가 뽑은 사람을 끝까지 지켜볼 수 있게 만듭니다.',
                `의원 ${polTotal ? nf(polTotal) + '명' : '전원'}의 발의·표결·발언 기록, 법안 ${billTotal ? nf(billTotal) + '건' : '전건'}의 처리 경과, 그리고 나와 가장 가까운 의원을 찾는 성향 진단까지.`,
                '',
                '정당색도, 좋은 의원·나쁜 의원 평가도 없습니다. 기록과 숫자만 보여줍니다.',
                '',
                '프로필 링크에서 시작할 수 있습니다.',
                '',
                '#국회 #법안 #당말사 #국회의원 #정치데이터',
            ].join('\n');
            res.render('promo/intro_card', {
                layout: false,
                slides, single, dateKo, polTotal, billTotal, caption,
            });
        } catch (error) {
            logger.error('브랜드 소개 캐러셀 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};
