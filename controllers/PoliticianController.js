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
                pageDesc: '22대 국회의원 전원의 발의·표결·발언 기록. 정당·위원회·지역구로 찾고, 당론 이탈 정도와 나와의 성향 일치로 정렬해 봅니다',
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

            const [billCounts, votes, topics, monthly, voteSummary, crossPartyVote, partyCoop, partyCoopOut, committees, titles, speeches, kpiRank, matchCtx] = await Promise.all([
                politicianService.getBillCounts(monaCd),
                politicianService.getVotesByMonaCd(monaCd),
                politicianService.getTopicsByMonaCd(monaCd),
                politicianService.getMonthlyBillsByMonaCd(monaCd),
                politicianService.getVoteSummaryByMonaCd(monaCd),
                politicianService.getCrossPartyVoteByMonaCd(monaCd),
                politicianService.getPartyCoopByMonaCd(monaCd),
                politicianService.getPartyCoopOutByMonaCd(monaCd),
                politicianService.getCommittees(monaCd),
                politicianService.getTitles(monaCd),
                politicianService.getSpeechesByMonaCd(monaCd),
                politicianService.getKpiPercentiles(monaCd),
                /* 🔴 일치도는 **순위**로 낸다 — 절대 %는 임의 보정값(1.5)에 의존해 못 믿는다.
                   근거 실측은 getMatchContext.sql 머리 주석에 (매핑 48건 · 안보축 84% 동일값 등) */
                politicianService.getMatchContext(res.locals.userAxis, monaCd)
            ]);

            /* 페이지 고유 description (2026-08-19 AdSense 대응 — 전 페이지 동일 문구 금지).
               ⚠️ 정당명은 넣는다 — 의원 목록·필터에서 이미 쓰는 사실 정보 (정당색 금지와 다른 문제) */
            const vs = voteSummary || {};
            const vsTot = Number(vs.total_cnt) || 0, vsAbs = Number(vs.absent_cnt) || 0;   // COUNT 는 bigint 라 문자열로 온다
            const attend = vsTot > 0 ? Math.round((vsTot - vsAbs) / vsTot * 100) : null;
            const pageDesc = [
                `${politician.name} 의원`,
                politician.party_name,
                politician.electoral_district,
                politician.reele_gbn_nm,
                billCounts ? `대표발의 ${billCounts.rep}건 · 공동발의 ${billCounts.co}건` : null,
                attend !== null ? `본회의 표결 참여 ${attend}%` : null,
            ].filter(Boolean).join(' · ') + '. 발의·표결·발언 기록으로 보는 22대 국회의원 활동';

            /* 제목에 정당·지역구를 붙인다 (2026-08-21) — 이름만으로는 검색결과에서 동명이인·타 사이트와
               구분이 안 되고, 이 309장은 (법안 상세와 달리) 전부 색인 대상이다.
               ⚠️ pageDesc 와 재료가 겹치지만 제목은 SERP 한 줄, 설명은 그 아래 두 줄이라 역할이 다르다 */
            res.render('politician/politician_detail', {
                // 괄호로 묶는다 — 브랜드 꼬리(`· 당말사 · 당 말고 사람`)도 `·` 라 그냥 이으면 점 사슬이 된다
                pageTitle: (() => {
                    const meta = [politician.party_name, politician.electoral_district].filter(Boolean).join(' · ');
                    return meta ? `${politician.name} 의원 (${meta})` : `${politician.name} 의원`;
                })(),
                pageStyles: 'politician/politician_detail',
                currentUrl: `/politician/${monaCd}`,
                pageDesc,
                politician,
                billCounts,
                votes,
                topics,
                monthly,
                voteSummary: voteSummary || { for_cnt: 0, against_cnt: 0, abstain_cnt: 0, absent_cnt: 0, total_cnt: 0 },
                crossPartyVote,
                partyCoop,
                partyCoopOut,
                committees,
                titles,
                speeches,
                matchCtx,
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
            /* 같은 경로가 두 가지를 낸다 — `?ym=` 이면 그 달치(월별 차트 클릭 패널),
               없으면 표결 내역 탭의 한 페이지. 둘 다 "이 의원의 표결" 이라 경로를 나누지 않았다.
               ⚠️ `ym` 분기를 **먼저** 둘 것. 뒤로 가면 월별 패널이 페이지 응답을 받는다 */
            if (req.query.ym === undefined) {
                const out = await politicianService.getVotesPage(req.params.monaCd, req.query);
                return res.status(200).json({
                    ...out,
                    pages: Math.max(1, Math.ceil(out.total / out.per))
                });
            }
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
