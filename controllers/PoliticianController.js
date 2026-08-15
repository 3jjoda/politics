import PoliticianService from '../services/PoliticianService.js';
import BillService from '../services/BillService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    const politicianService = PoliticianService(db);
    const billService = BillService(db);
    const controller = {};

    controller.getList = wrapWithContext(async function getList(req, res, next) {
        try {
            const results = await politicianService.getList();
            res.status(200).json(results);
        } catch (error) {
            logger.error('API 컨트롤러에서 정치인 목록 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 정치인 목록 페이지 */
    controller.getListPage = wrapWithContext(async function getListPage(req, res, next) {
        try {
            const [politicians, partyCounts, committeeCounts, electCounts, genderStats, ageGroupStats] = await Promise.all([
                politicianService.getListWithStats(),
                politicianService.getPartyCounts(),
                politicianService.getCommitteeCounts(),
                politicianService.getElectTypeCounts(),
                politicianService.getGenderStats(),
                politicianService.getAgeGroupStats()
            ]);

            res.render('politician/politician', {
                pageTitle: '정치인',
                pageStyles: 'politician/politician',
                currentUrl: '/politician',
                politicians,
                partyCounts,
                committeeCounts,
                electCounts,
                genderStats,
                ageGroupStats
            });
        } catch (error) {
            logger.error('웹 컨트롤러에서 정치인 목록 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    controller.getDetail = wrapWithContext(async function getDetail(req, res, next) {
        try {
            const politicianData = await politicianService.getDetail(req.params.id);
            if (!politicianData || politicianData.length === 0) {
                return res.status(404).json({ message: '정치인을 찾을 수 없습니다.' });
            }
            res.status(200).json(politicianData);
        } catch (error) {
            logger.error('API 컨트롤러에서 정치인 상세 정보 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 정치인 상세 페이지 */
    controller.getDetailPage = wrapWithContext(async function getDetailPage(req, res, next) {
        try {
            const monaCd = req.params.id;

            const politicianData = await politicianService.getDetail(monaCd);
            if (!politicianData || politicianData.length === 0) {
                return res.status(404).render('error_pages/404', {
                    pageTitle: '정치인 찾을 수 없음',
                    pageStyles: 'error',
                    message: '요청하신 정치인 정보를 찾을 수 없습니다.'
                });
            }
            const politician = politicianData[0];

            const [billCounts, votes, topics, monthly, timeline, voteSummary, crossPartyVote, partyCoop, partyCoopOut, committees, titles, speeches, kpiRank] = await Promise.all([
                politicianService.getBillCounts(monaCd),
                politicianService.getVotesByMonaCd(monaCd),
                politicianService.getTopicsByMonaCd(monaCd),
                politicianService.getMonthlyBillsByMonaCd(monaCd),
                politicianService.getTimelineByMonaCd(monaCd),
                politicianService.getVoteSummaryByMonaCd(monaCd),
                politicianService.getCrossPartyVoteByMonaCd(monaCd),
                politicianService.getPartyCoopByMonaCd(monaCd),
                politicianService.getPartyCoopOutByMonaCd(monaCd),
                politicianService.getCommittees(monaCd),
                politicianService.getTitles(monaCd),
                politicianService.getSpeechesByMonaCd(monaCd),
                politicianService.getKpiPercentiles(monaCd)
            ]);

            res.render('politician/politician_detail', {
                pageTitle: politician.name,
                pageStyles: 'politician/politician_detail',
                currentUrl: `/politician/${monaCd}`,
                politician,
                billCounts,
                votes,
                topics,
                monthly,
                timeline,
                voteSummary: voteSummary || { for_cnt: 0, against_cnt: 0, abstain_cnt: 0, absent_cnt: 0, total_cnt: 0 },
                crossPartyVote,
                partyCoop,
                partyCoopOut,
                committees,
                titles,
                speeches,
                kpiRank
            });

        } catch (error) {
            logger.error('웹 컨트롤러에서 정치인 상세 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* ===== 법안 활동 탭 지연 로딩 =====
       🔴 전건 SSR 을 대체한다 — 887행을 다 뿌리면 페이지가 **1.1MB** 가 된다 (실측).
       ⚠️ `kind` 는 서비스가 화이트리스트로 접는다. 여기서 SQL 을 만들지 않는다. */
    controller.getBillsPageApi = wrapWithContext(async function getBillsPageApi(req, res, next) {
        try {
            const monaCd = req.params.monaCd;
            const [{ rows, kind, page, per }, counts] = await Promise.all([
                politicianService.getBillsPage(monaCd, req.query),
                politicianService.getBillCounts(monaCd),
            ]);
            const total = kind === 'rep' ? counts.rep : kind === 'co' ? counts.co : counts.total;
            res.status(200).json({ rows, kind, page, per, total, pages: Math.max(1, Math.ceil(total / per)) });
        } catch (error) {
            logger.error('API 컨트롤러에서 법안 활동 페이지 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 월별 표결 참여 차트의 클릭 패널 — 그 달치만.
       🔴 예전엔 598건 전건을 JSON 으로 심어 75KB 였다. 실제로 보는 건 클릭한 달 하나뿐이다. */
    controller.getVotesByMonthApi = wrapWithContext(async function getVotesByMonthApi(req, res, next) {
        try {
            const rows = await politicianService.getVotesByMonth(req.params.monaCd, req.query.ym);
            // ⚠️ 형식이 틀리면 빈 배열이 아니라 400 — 조용히 빈 화면이 되면 원인을 못 찾는다
            if (rows === null) return res.status(400).json({ error: 'ym 형식은 YYYY-MM 이어야 합니다' });
            res.status(200).json({ rows });
        } catch (error) {
            logger.error('API 컨트롤러에서 월별 표결 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};
