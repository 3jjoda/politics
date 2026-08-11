// controllers/ChartController.js — 커스텀 차트 빌더 (`/xray/chart`)
//
// Phase A: 만들고 즉시 보기. 저장 테이블 없음 — **스펙이 URL 에 담기므로 URL 이 곧 저장이다.**

import ChartService from '../services/ChartService.js';
import { SOURCES, CHART_TYPES, SORTS } from '../services/chartRegistry.js';
import { nf } from '../utils/xrayFormat.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

export default (db) => {
    const chartService = ChartService(db);
    const controller = {};

    controller.getChartPage = wrapWithContext(async function getChartPage(req, res, next) {
        try {
            const spec = chartService.parseSpec(req.query);
            const [result, options] = await Promise.all([
                chartService.run(spec),
                chartService.getOptions(),
            ]);

            // 축·지표·필터 목록은 **소스마다 다르다** — 현재 소스에서 쓸 수 있는 것만 내려보낸다
            const choices = chartService.choicesFor(spec.source);

            const specQuery = chartService.toQuery(spec);
            // 카톡·X 등에 붙였을 때 뜨는 미리보기 — "무엇을 공유하는지" 가 차트마다 다르므로 직접 넘긴다
            const title = `${result.dim.label}별 ${result.measure.label}`;

            res.render('xray/chart', {
                pageTitle: '차트 만들기',
                pageStyles: null,
                currentUrl: '/xray/chart',
                ogTitle: `${title} · 당말사`,
                ogDesc: `${result.src.label} ${result.rows.length}개 그룹 · 표본 ${nf(result.total)}건. 국회 데이터로 직접 만든 차트입니다.`,
                ogPath: '/xray/chart' + (specQuery ? '?' + specQuery : ''),
                spec,
                specQuery,
                result,
                options,
                SOURCES, CHART_TYPES, SORTS,
                DIMENSIONS: choices.dims,
                MEASURES: choices.measures,
                FILTERS: choices.filters,
                nf,
            });
        } catch (error) {
            logger.error('차트 빌더 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    return controller;
};
