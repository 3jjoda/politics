// controllers/AnomalyController.js — 「설명이 필요한 숫자」(/why)
//
// 사이트에 지표는 많은데 누가 이상한지를 먼저 꺼내주지 않았다. 매일 한 장씩 꺼내 질문으로 만든다.
// 🔴 우리는 판정하지 않는다. 숫자와 한계를 놓고 판단 질문을 던진 뒤, 답은 댓글에 맡긴다.
//    선정 규칙·중립성 장치는 utils/anomalies.js 주석에 있다.

import AnomalyService from '../services/AnomalyService.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default (db) => {
    const service = AnomalyService(db);

    /* 목록 */
    const getIndexPage = async (req, res, next) => {
        try {
            /* 지표 탭 — 화이트리스트. 모르는 값은 에러가 아니라 전체로 조용히 접는다
               (`/xray/chart`·`/issue` 와 같은 판단 — URL 을 손으로 고쳐도 안전하다) */
            const metric = service.METRICS.some((m) => m.key === req.query.metric) ? req.query.metric : null;
            const { cards, page, totalPages, total, allTotal, tabs } = await service.getPage(req.query.page, metric);
            res.render('anomaly/index', {
                pageTitle: page > 1 ? `설명이 필요한 숫자 ${page}페이지` : '설명이 필요한 숫자',
                pageStyles: 'anomaly',
                currentUrl: '/why',
                pageDesc: '국회 기록에서 설명이 필요한 숫자를 하루 한 가지씩 꺼냅니다. 순위를 매기지 않고, 이유를 알면 적고 모르면 모른다고 씁니다.',
                cards, page, totalPages, total, allTotal, tabs, metric,
                rules: service.SELECTION_RULES,
                metrics: service.METRICS,
            });
        } catch (err) { next(err); }
    };

    /* 상세 — 댓글이 붙는 단위 */
    const getDetailPage = async (req, res, next) => {
        const date = String(req.params.date || '');
        // 🔴 형식이 아니면 404 다. 목록으로 조용히 보내지 않는다 (잘못된 링크가 200 을 받으면 안 된다)
        if (!DATE_RE.test(date)) {
            return res.status(404).render('error_pages/404', {
                pageTitle: '찾을 수 없음', pageStyles: 'error', currentUrl: '/why',
                message: '그런 날짜가 없습니다.',
            });
        }
        try {
            const card = await service.getByDate(date);
            if (!card) {
                return res.status(404).render('error_pages/404', {
                    pageTitle: '찾을 수 없음', pageStyles: 'error', currentUrl: '/why',
                    message: '그날의 카드가 없습니다.',
                });
            }
            const neighbors = await service.getNeighbors(date);
            res.render('anomaly/detail', {
                pageTitle: `${card.name} 의원 · ${card.metricLabel}`,
                pageStyles: 'anomaly',
                currentUrl: `/why/${date}`,
                pageDesc: card.headline,
                ogTitle: card.headline,
                ogDesc: `${card.metricLabel} ${card.value}${card.unit} · ${card.medianLabel} ${card.median}${card.unit}. ${card.explainText}`,
                card, neighbors,
                rules: service.SELECTION_RULES,
            });
        } catch (err) { next(err); }
    };

    return { getIndexPage, getDetailPage };
};
