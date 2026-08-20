import BillService from '../services/BillService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    const billService = BillService(db);
    const controller = {};

    controller.getList = wrapWithContext(async function getList(req, res, next) {
        try {
            const results = await billService.getList({});
            res.status(200).json(results);
        } catch (error) {
            logger.error('API 컨트롤러에서 법안 목록 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 주목할 법안 (sort 파라미터 지원) — 홈 탭 동적 교체용 */
    controller.getTrending = wrapWithContext(async function getTrending(req, res, next) {
        try {
            const VALID_SORTS = new Set(['recent', 'close', 'popular', 'bipartisan']);
            const raw = req.query.sort ? String(req.query.sort) : 'recent';
            const sort = VALID_SORTS.has(raw) ? raw : 'recent';
            const items = await billService.getTrending(sort);
            res.status(200).json({ sort, items });
        } catch (error) {
            logger.error('주목할 법안 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 법안 검색 API (커뮤니티 첨부용) */
    controller.search = wrapWithContext(async function search(req, res, next) {
        try {
            const q = (req.query.q || '').trim();
            if (!q || q.length < 2) return res.status(200).json({ items: [] });
            const items = await billService.search(q);
            res.status(200).json({ items });
        } catch (error) {
            logger.error('법안 검색 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 법안 목록 페이지 (검색/필터/정렬/페이징) */
    controller.getListPage = wrapWithContext(async function getListPage(req, res, next) {
        try {
            const pageSize = 50;
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const offset = (page - 1) * pageSize;

            const search = req.query.search ? String(req.query.search).trim() : null;
            const status = req.query.status ? String(req.query.status) : null;
            const committeeRaw = req.query.committee ? String(req.query.committee).trim() : null;
            const committee = committeeRaw || null;
            const partyRaw = req.query.party ? String(req.query.party).trim() : null;
            const party = partyRaw || null;
            // 법안명 완전일치 — 카드의 "같은 법률 개정안 N건 →" 링크가 여기로 착지.
            // search(ILIKE 부분일치)와 별개다: 부분일치면 "○○법 일부개정법률안(대안)" 같은
            // 변형까지 딸려와 카드에 표시한 건수와 결과 건수가 어긋난다.
            const billNameRaw = req.query.bill_name ? String(req.query.bill_name).trim() : null;
            const billName = billNameRaw || null;

            // AI 분석 필터 — 'Y'(있음) / 'N'(없음) / null(전체)
            const hasAnalysisRaw = String(req.query.has_analysis || '');
            const hasAnalysis =
                (hasAnalysisRaw === 'Y' || hasAnalysisRaw === '1') ? 'Y' :
                (hasAnalysisRaw === 'N') ? 'N' :
                null;
            // AI 카테고리 main — 쉼표 분리 복수 지원 (16종 고정 set)
            // 구버전 호환: ai_category 파라미터도 ai_category_main 으로 받음
            const aiCategoryRaw = req.query.ai_category_main || req.query.ai_category || null;
            const aiCategoryMain = aiCategoryRaw ? String(aiCategoryRaw).trim() || null : null;
            // 정렬 — 화이트리스트
            const VALID_SORTS = new Set(['recent', 'ai_priority', 'requested']);
            const sort = VALID_SORTS.has(req.query.sort) ? req.query.sort : 'recent';

            // 분석 요청 필터 — 'any'(요청 있음) / 'priority'(임계값 도달) / null(전체)
            const VALID_REQ = new Set(['any', 'priority']);
            const requestStatus = VALID_REQ.has(req.query.request_status) ? req.query.request_status : null;
            const priorityThreshold = billService.getRequestThreshold();

            const [bills, statusCounts, topicCounts, partyCounts, aiCategories, baseStats, requestStats] = await Promise.all([
                billService.getList({ search, status, committee, party, hasAnalysis, aiCategoryMain, sort, requestStatus, priorityThreshold, billName, limit: pageSize, offset }),
                billService.getStatusCounts(committee, party, billName, search),
                billService.getTopicCounts(),
                billService.getPartyCounts(),
                billService.getAiCategories(),
                billService.getAnalysisStats(),
                billService.getRequestStats()
            ]);

            // EJS 호환을 위해 한 객체로 병합
            const analysisStats = { ...baseStats, ...requestStats };

            const totalCount = bills.length > 0 ? parseInt(bills[0].total_count) : 0;
            const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

            /* 범위 밖 페이지(`?page=99999`)는 **빈 목록을 200 으로** 내놓고 있었다 (soft 404).
               내용 없는 페이지가 색인되지 않도록 마지막 페이지로 접는다.
               ⚠️ totalPages 는 쿼리 뒤에야 알 수 있어 여기서만 판정할 수 있다.
               ⚠️ 빈 결과일 땐 total_count 를 못 읽어 totalPages 가 1 이 된다 — 목록 첫 장으로 떨어진다 (그래도 빈 화면보다 낫다) */
            if (page > totalPages) {
                const qs = new URLSearchParams({ ...req.query });
                if (totalPages > 1) qs.set('page', String(totalPages)); else qs.delete('page');
                const tail = qs.toString();
                return res.redirect(301, '/bill' + (tail ? `?${tail}` : ''));
            }

            res.render('bill/bill', {
                pageTitle: '법안',
                pageStyles: 'bill/bill',
                currentUrl: '/bill',
                pageDesc: '22대 국회 법안을 처리 상태·소관 위원회·대표발의 정당으로 찾아봅니다. 발의부터 본회의 의결까지의 경과와 AI 쉬운 말 분석',
                bills,
                statusCounts,
                topicCounts,
                partyCounts,
                aiCategories,
                analysisStats,
                requestThreshold: billService.getRequestThreshold(),
                query: {
                    search: search || '',
                    status: status || '',
                    committee: committee || '',
                    party: party || '',
                    bill_name: billName || '',
                    has_analysis: hasAnalysis || '',
                    ai_category_main: aiCategoryMain || '',
                    request_status: requestStatus || '',
                    sort
                },
                pagination: { page, pageSize, totalCount, totalPages }
            });
        } catch (error) {
            logger.error('웹 컨트롤러에서 법안 목록 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    controller.getDetail = wrapWithContext(async function getDetail(req, res, next) {
        try {
            const billData = await billService.getDetail(req.params.id);
            if (!billData || billData.length === 0) {
                return res.status(404).json({ message: '법안을 찾을 수 없습니다.' });
            }
            res.status(200).json(billData);
        } catch (error) {
            logger.error('API 컨트롤러에서 법안 상세 정보 조회 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 법안 상세 페이지 */
    controller.getDetailPage = wrapWithContext(async function getDetailPage(req, res, next) {
        try {
            const billId = req.params.id;
            const billData = await billService.getDetail(billId);
            if (!billData || billData.length === 0) {
                return res.status(404).render('error_pages/404', {
                    pageTitle: '법안 찾을 수 없음',
                    pageStyles: 'error',
                    message: '요청하신 법안 정보를 찾을 수 없습니다.'
                });
            }
            const bill = billData[0];

            const userId = req.session?.userId || null;
            const [coProposers, votes, analysis, analysisRequestCount, hasRequested] = await Promise.all([
                billService.getBillCoProposers(billId),
                billService.getBillDetailVotes(billId),
                billService.getAiAnalysis(billId).catch((err) => {
                    logger.warn(`AI 분석 조회 실패 (bill_id=${billId}): ${err.message}`);
                    return null;
                }),
                billService.getAnalysisRequestCount(billId),
                billService.hasUserRequested(billId, userId)
            ]);

            const voters = {
                agree:    votes.filter(v => v.vote_result === '찬성'),
                disagree: votes.filter(v => v.vote_result === '반대'),
                abstain:  votes.filter(v => v.vote_result === '기권'),
                absent:   votes.filter(v => v.vote_result === '불참')
            };

            // 공동대표 인원 수 — proposer_yn=true 인 발의자가 2명 이상이면 공동대표
            const coRepCount = coProposers.filter(cp => cp.proposer_yn).length;

            /* 색인·설명 (2026-08-19 AdSense 반려 대응)
               - AI 분석이 없는 법안(전체의 99%)은 본문이 국회 원문 그대로라 사이트 고유 텍스트가 없다 →
                 noindex (사이트맵에서도 뺐다 — utils/sitemap.js). 분석 있는 법안만 색인 대상
               - description 은 분석이 있으면 AI 한 줄 요약, 없으면 메타 조합 (전 페이지 동일 문구 금지) */
            const hasAnalysis = !!analysis;
            const descParts = [
                bill.proposer_name ? `${bill.proposer_name} 의원 대표발의` : null,
                bill.propose_dt ? `${String(bill.propose_dt).slice(0, 10)} 발의` : null,
                bill.committee || null,
                bill.proc_result_name || '계류 중'
            ].filter(Boolean);
            const pageDesc = hasAnalysis && analysis.summary
                ? `${analysis.summary} · ${bill.bill_name}`
                : `${bill.bill_name} · ${descParts.join(' · ')}`;

            /* 제목도 이 법안만의 것이어야 한다 (2026-08-21). bill_name 만 쓰면 동명 법안(전체의 87%,
               조세특례제한법 일부개정법률안 788건)이 브라우저 탭·공유 미리보기·검색결과에서 구분되지 않는다.
               ⚠️ proposer_name 은 의원(mona_cd 있음)일 수도 위원장·정부(없음)일 수도 있어 표현을 나눈다 */
            const titleTail = [
                bill.proposer_name ? `${bill.proposer_name}${bill.mona_cd ? ' 대표발의' : ' 제안'}` : null,
                bill.propose_dt ? String(bill.propose_dt).slice(0, 10).replace(/-/g, '.') : null,
            ].filter(Boolean).join(' · ');

            res.render('bill/bill_detail', {
                // 괄호로 묶는다 — 브랜드 꼬리(`· 당말사 · 당 말고 사람`)도 `·` 라 그냥 이으면 점 사슬이 된다
                pageTitle: titleTail ? `${bill.bill_name} (${titleTail})` : bill.bill_name,
                pageStyles: 'bill/bill_detail',
                currentUrl: `/bill/${billId}`,
                pageDesc,
                noindex: !hasAnalysis,
                bill,
                coProposers,
                coRepCount,
                voters,
                voteCounts: {
                    agree:    voters.agree.length,
                    disagree: voters.disagree.length,
                    abstain:  voters.abstain.length,
                    absent:   voters.absent.length
                },
                analysis,
                analysisRequestCount,
                hasRequested,
                requestThreshold: billService.getRequestThreshold()
            });

        } catch (error) {
            logger.error('웹 컨트롤러에서 법안 상세 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 분석 요청 — POST /bill/:id/request-analysis (requireLogin 미들웨어로 보호) */
    controller.requestAnalysis = wrapWithContext(async function requestAnalysis(req, res, next) {
        try {
            const billId = req.params.id;
            const userId = req.session?.userId;
            if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });

            // 법안 존재 확인 (404 방지)
            const billRows = await billService.getDetail(billId);
            if (!billRows || billRows.length === 0) {
                return res.status(404).json({ error: '법안을 찾을 수 없습니다.' });
            }

            const result = await billService.requestAnalysis(billId, userId);
            return res.status(200).json({ success: true, ...result });
        } catch (err) {
            if (err.code === 'ALREADY_ANALYZED' || err.message === 'ALREADY_ANALYZED') {
                return res.status(400).json({ error: '이미 분석된 법안입니다.', code: 'ALREADY_ANALYZED' });
            }
            logger.error('분석 요청 처리 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    /* 분석 요청 상태 조회 — GET /api/bill/:id/analysis-status */
    controller.getAnalysisStatus = wrapWithContext(async function getAnalysisStatus(req, res, next) {
        try {
            const billId = req.params.id;
            const userId = req.session?.userId || null;
            const [count, hasRequested] = await Promise.all([
                billService.getAnalysisRequestCount(billId),
                billService.hasUserRequested(billId, userId)
            ]);
            res.status(200).json({
                count,
                hasRequested: userId ? hasRequested : null,
                threshold: billService.getRequestThreshold()
            });
        } catch (err) {
            logger.error('분석 요청 상태 조회 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    /* 마이페이지 — GET /my/analysis-requests */
    controller.getMyAnalysisRequestsPage = wrapWithContext(async function getMyAnalysisRequestsPage(req, res, next) {
        try {
            const userId = req.session?.userId;
            if (!userId) {
                const next_ = encodeURIComponent('/my/analysis-requests');
                return res.redirect(`/auth/login?next=${next_}`);
            }
            const requests = await billService.getMyAnalysisRequests(userId);
            const requestThreshold = billService.getRequestThreshold();
            res.render('my/analysis_requests', {
                pageTitle: '내가 요청한 분석',
                pageStyles: 'my/analysis_requests',
                currentUrl: '/my/analysis-requests',
                requests,
                requestThreshold
            });
        } catch (err) {
            logger.error('마이페이지 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    return controller;
};
