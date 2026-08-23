// controllers/IssueController.js — 쟁점(/issue)
//
// **뉴스를 보고 온 사람에게 국회 기록을 준다.** 기사를 수집·인용하지 않는다.
// 화면에 나가는 건 전부 DB(공적 기록)이고 뉴스는 검색 링크로만 나간다.
// 선정 기준·중립성 규칙은 utils/issues.js 주석에 있다.

import IssueService from '../services/IssueService.js';
import { ISSUES, issueBySlug } from '../utils/issues.js';
import { summaryPreview } from '../utils/billSummary.js';
import logger from '../utils/logger.js';

export default (db) => {
    const service = IssueService(db);

    /* 목록 정렬 — 화이트리스트. 모르는 값은 에러가 아니라 기본값으로 조용히 접는다
       (`/xray/chart` 와 같은 판단 — URL 을 손으로 고쳐도 안전하고, 링크가 깨져도 빈 화면보다 낫다).
       🔴 기본은 **최근 움직인 순**이다. 쟁점이 늘어나면 목록에서 가장 먼저 묻는 게
          "지금 뭐가 움직이나" 이지 "뭐가 크나" 가 아니다. */
    const SORTS = {
        recent:  { label: '최근 움직인 순', fn: (a, b) => String(b.lastDate || '').localeCompare(String(a.lastDate || '')) },
        bills:   { label: '법안 많은 순',   fn: (a, b) => (b.total || 0) - (a.total || 0) },
        pending: { label: '계류 많은 순',   fn: (a, b) => (b.pending || 0) - (a.pending || 0) },
    };
    const DEFAULT_SORT = 'recent';

    /* 목록 */
    const getIndexPage = async (req, res, next) => {
        try {
            const sort = Object.prototype.hasOwnProperty.call(SORTS, req.query.sort) ? req.query.sort : DEFAULT_SORT;
            const issues = (await service.list()).sort(SORTS[sort].fn);
            res.render('issue/index', {
                sort,
                sorts: Object.entries(SORTS).map(([k, v]) => ({ key: k, label: v.label })),
                pageTitle: '쟁점',
                pageStyles: 'issue',
                currentUrl: '/issue',
                pageDesc: '뉴스에서 오가는 사안에 대해 국회 기록에 무엇이 남았는지 모았습니다. 발의된 법안, 이름을 올린 의원, 아직 정해지지 않은 것.',
                issues,
            });
        } catch (err) { next(err); }
    };

    /* 상세 */
    const getDetailPage = async (req, res, next) => {
        const issue = issueBySlug(req.params.slug);
        // 🔴 모르는 slug 는 404 다. 목록으로 조용히 보내지 않는다 —
        //    잘못된 링크가 200 을 받으면 색인에 빈 페이지가 쌓인다
        if (!issue) {
            return res.status(404).render('error_pages/404', {
                pageTitle: '찾을 수 없음', pageStyles: 'error', currentUrl: '/issue',
                message: '그런 쟁점이 없습니다.',
            });
        }
        try {
            const data = await service.get(issue.slug);
            res.render('issue/detail', {
                pageTitle: issue.title,
                pageStyles: 'issue',
                currentUrl: `/issue/${issue.slug}`,
                pageDesc: issue.desc,
                ogTitle: `${issue.title} · 국회 기록`,
                ogDesc: issue.desc,
                ...data,
            });
        } catch (err) {
            logger.error(`issue/${issue.slug} 렌더 실패 — ${err.message}`);
            next(err);
        }
    };

    /* 접힌 「법안 전체 보기」의 한 페이지 (JSON).
       ⚠️ 추가 쿼리가 없다 — 서비스가 캐시된 전건을 자른다.
       ⚠️ 모르는 slug 는 404, 범위 밖 page 는 마지막으로 접는다 (에러 아님). */
    const getBillsPageApi = async (req, res, next) => {
        const issue = issueBySlug(req.params.slug);
        if (!issue) return res.status(404).json({ error: 'NOT_FOUND' });
        try {
            const data = await service.getBillsPage(issue.slug, req.query.page);
            if (!data) return res.json({ page: 1, totalPages: 1, total: 0, bills: [] });
            res.json({
                page: data.page, totalPages: data.totalPages, total: data.total,
                // 화면이 쓰는 필드만 내려보낸다 (summary 원문 전체를 실으면 페이지당 수십 KB)
                bills: data.bills.map((b) => ({
                    bill_id: b.bill_id, bill_name: b.bill_name, proposer_name: b.proposer_name,
                    party_name: b.party_name, propose_dt: b.propose_dt,
                    proc_result_name: b.proc_result_name, co_count: Number(b.co_count),
                    vote_count: Number(b.vote_count), has_analysis: b.has_analysis,
                    body: b.has_analysis && b.ai_summary
                        ? b.ai_summary
                        : (b.raw_summary ? summaryPreview(b.raw_summary, 130) : ''),
                })),
            });
        } catch (err) {
            logger.error(`issue bills api(${issue.slug}) 실패 — ${err.message}`);
            next(err);
        }
    };

    return { getIndexPage, getDetailPage, getBillsPageApi };
};
