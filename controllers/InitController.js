import CodeService from '../services/CodeService.js';
import BillService from '../services/BillService.js';
import BriefingService from '../services/BriefingService.js';
import PoliticianService from '../services/PoliticianService.js';
import DistrictService from '../services/DistrictService.js';
import BalanceGameService from '../services/BalanceGameService.js';
import AnomalyService from '../services/AnomalyService.js';
import { ENABLED as ANOMALY_ENABLED } from '../utils/anomalies.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    const codeService = CodeService(db);
    const billService = BillService(db);
    const politicianService = PoliticianService(db);
    const districtService = DistrictService(db);   // 내 지역구 의원 (2026-08-23)
    const briefingService = BriefingService(db);
    const balanceService = BalanceGameService(db); // 홈 히어로 첫 문항 (2026-08-25)
    const anomalyService = AnomalyService(db);     // 설명이 필요한 숫자 (2026-09-01)
    const controller = {};

    /* 초기화 */
    controller.getInitialData = wrapWithContext(async function getInitialData(req, res, next) {
        try {
            const codes = await codeService.getList();
            return { CODES: codes };
        } catch(error) {
            logger.error('컨트롤러에서 예상치 못한 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 홈 페이지 렌더링 */
    controller.getHomePage = wrapWithContext(async function getHomePage(req, res, next) {
        try {
            /* 🔴 2026-08-16 홈 재구성 — 뺀 것과 이유:
                 · getRecentVotes  : 최근 20건이 **전부** 찬성 ≥ 반대×10 (평균 186 vs 1.1). 같은 그림 20번
                 · getTopProposers : 발의 **건수** 랭킹 = 양 지표. 사이트 곳곳에 "건수는 기여도가 아니다"
                                     라고 써놓고 홈에선 순위표였다
                 · getMonthlyTrend : 처리 완료 비율이 창 안에서 25.5%→0% 로 떨어지는데 그건 **처리 지연**이다.
                                     각주 없이 그리면 "국회가 갈수록 일을 안 한다" 로 읽힌다
                 · getRecentPartyMoves : 전체 기록이 **2건**. 섹션 하나를 캐러셀로 쓰는데 카드 2장
               넷 다 DAO/서비스에는 남아 있다 (다른 페이지가 쓰거나 나중에 되살릴 수 있게). */
            const userAxis = res.locals.userAxis || null;
            /* 2026-08-16 (2차): 히어로 결론 3숫자 → **무작위 의원 3명의 축 좌표**(정당 평균 눈금 포함)로 교체.
                 숫자 3개는 「숫자로 본 국회」 위 스트립으로 내렸고, `주목할 법안`(getTrending) 섹션은 뺐다 (서비스 메서드는 남김) */
            /* 🔴 2026-08-25 홈 재구성 (A → B → C) — 히어로가 **좌표 지도 + 첫 문항**이 됐다.
                 · axisCloud    : 좌표 있는 의원 전원의 익명 점(이름·정당 없음). 히어로 지도의 재료.
                                  10분 캐시라 홈이 아무리 열려도 쿼리는 10분에 한 번이다 (PoliticianService)
                 · firstQuestion: 완료자에겐 필요 없다 — 그 자리에 내 좌표가 들어가므로 아예 조회하지 않는다
               ⚠️ 둘 다 실패하면 null/[] 이라 히어로가 문항·지도 없이 글만으로 무너진다 (홈은 산다) */
            const completed = !!res.locals.balanceGameCompleted;
            /* 「설명이 필요한 숫자」 (2026-09-01) — 매일 바뀌는 콘텐츠가 브리핑뿐이라 재방문 이유가 얇았다.
               ⚠️ 서비스가 실패를 삼켜 null 을 준다 (홈은 산다). 10분 캐시라 홈이 열려도 쿼리는 거의 안 돈다 */
            const [codes, facts, spotlight, briefing, spread, myMember, axisCloud, firstQuestion, anomaly] = await Promise.all([
                codeService.getList(),
                billService.getHomeFacts(),
                /* 🔴 3 → 2 (2026-08-23). 이 블록이 모바일 히어로의 **절반**(750/1,402px)을 먹는데
                   무작위라 재방문 가치가 낮다. 2명이면 "사람마다 다르다" 는 그대로 보이고 250px 를 돌려준다.
                   ⚠️ 1명으로 줄이지 말 것 — 비교 대상이 없으면 "정당 평균과 얼마나 다른가" 가 안 읽힌다 */
                politicianService.getAxisSpotlight(2),
                briefingService.getFeed(1),
                /* 🔴 `getTopMatches` → `getMatchSpread` (2026-08-24). 한 쿼리로 **가까운 3명과 먼 3명**을 같이 받는다
                   — 홈에 「나와 다른 의원」 섹션이 생겼기 때문이다 (쿼리 하나 더 돌리지 않는다).
                   ⚠️ 이 쿼리는 **정당명을 주지 않는다.** 의도된 것이다 — 가까운 쪽과 먼 쪽을 나란히 놓는 화면에서
                      정당명이 붙으면 "가까운 = ○○당 / 먼 = △△당" 대비 구도로 읽혀 「당 말고 사람」이 무너진다
                      (공유 카드가 정당을 빼는 것과 같은 규칙). 카드에는 지역구까지만 쓴다. */
                politicianService.getMatchSpread(userAxis, 3),
                /* 내 지역구 의원 (2026-08-23). 로그인 + 등록한 사용자만.
                   ⚠️ 실패해도 null 이라 홈은 산다 (DistrictService 가 삼킨다) */
                districtService.getMember(req.user && req.user.district),
                politicianService.getAxisCloud(),
                completed ? Promise.resolve(null) : balanceService.getFirstQuestion('general'),
                /* 🔴 꺼져 있으면 조회조차 하지 않는다 — 홈 카드는 `anomaly` 가 null 이면 통째로 안 그려진다 */
                ANOMALY_ENABLED ? anomalyService.getLatest() : Promise.resolve(null),
            ]);

            res.render('index', {
                pageTitle: null,   // 홈 — layout 이 '당말사 — 당 말고 사람' 단독으로 렌더
                pageStyles: null,
                currentUrl: '/',
                initialData: { CODES: codes },
                facts,
                spotlight,
                myMember,
                /* 히어로 지도 — [economy, social] 만 쓴다. institution 은 평면에 안 그린다 (공유 카드와 같은 규칙) */
                axisCloud,
                firstQuestion,
                anomaly,
                /* 브리핑은 최신 4장만 쓴다 — 피드 전체는 /briefing 이 맡는다 */
                briefings: (briefing && briefing.posts ? briefing.posts : []).slice(0, 4),
                /* near·far 를 갈라 넘긴다. 좌표가 없거나 실패하면 spread 가 null 이라 빈 배열이 된다 */
                matches:    spread ? spread.near : [],
                farMatches: spread ? spread.far  : [],
                matchTotal: spread ? spread.total : null
            });
        } catch (error) {
            logger.error('홈 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};
