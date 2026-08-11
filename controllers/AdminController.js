// controllers/AdminController.js — 관리자: 의원 직위 관리
//
// 이 화면의 존재 이유: 직위 데이터는 자동 수집 경로가 없어 수동인데(소관 기관이 흩어져 있다),
// SQL 로 직접 넣으려면 mona_cd 를 매번 찾아야 한다. 그 수고를 없애는 게 핵심이다.
//
// ⚠️ 상임위 직위(위원장·간사·위원)는 여기서 못 고친다 — syncCommittees 가 매일 전체 교체한다.

import AdminDao from '../daos/AdminDao.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';

// DB CHECK 와 같은 값이어야 한다 (ddl/migrations/2026-08-12-politician-titles.sql)
const CATEGORIES = ['의장단', '국무위원', '교섭단체', '당직'];

/* 폼 입력 정리 + 검증. 실패하면 사람이 읽을 수 있는 사유를 돌려준다. */
function parseForm(body) {
    const s = (v) => (typeof v === 'string' ? v.trim() : '');
    const monaCd = s(body.mona_cd);
    const category = s(body.category);
    const title = s(body.title);
    const reviewAfter = s(body.review_after);

    if (!monaCd) return { error: '의원을 선택하세요.' };
    if (!CATEGORIES.includes(category)) return { error: '구분이 올바르지 않습니다.' };
    if (!title) return { error: '직위명을 입력하세요.' };
    if (title.length > 60) return { error: '직위명은 60자 이내여야 합니다.' };
    // DATE 컬럼이라 형식이 틀리면 500 이 난다 — 여기서 걸러 메시지로 돌려준다
    if (reviewAfter && !/^\d{4}-\d{2}-\d{2}$/.test(reviewAfter)) {
        return { error: '확인 예정일은 YYYY-MM-DD 형식이어야 합니다.' };
    }
    return {
        data: {
            monaCd, category, title, reviewAfter,
            sourceUrl: s(body.source_url),
            note: s(body.note),
        },
    };
}

export default (db) => {
    const dao = AdminDao(db);
    const controller = {};

    controller.getTitlesPage = wrapWithContext(async function getTitlesPage(req, res, next) {
        try {
            const [titles, politicians, committeeRoles] = await Promise.all([
                dao.getTitles(), dao.getPoliticianOptions(), dao.getCommitteeRoles(),
            ]);
            res.render('admin/titles', {
                pageTitle: '직위 관리',
                pageStyles: null,
                currentUrl: '/admin/titles',
                titles, politicians, committeeRoles,
                categories: CATEGORIES,
                flash: req.query.ok || null,
                error: req.query.err || null,
            });
        } catch (error) {
            logger.error('관리자 직위 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    /* 결과를 쿼리스트링으로 넘기고 리다이렉트 — 새로고침 시 재전송(중복 INSERT)을 막는 PRG 패턴 */
    const back = (res, { ok, err }) =>
        res.redirect(`/admin/titles?${ok ? `ok=${encodeURIComponent(ok)}` : `err=${encodeURIComponent(err)}`}`);

    controller.createTitle = wrapWithContext(async function createTitle(req, res) {
        const { data, error } = parseForm(req.body);
        if (error) return back(res, { err: error });
        try {
            if (!(await dao.politicianExists(data.monaCd))) return back(res, { err: '존재하지 않는 의원입니다.' });
            await dao.create(data);
            logger.info(`[admin] 직위 추가: ${data.monaCd} · ${data.category} · ${data.title} (by ${req.user?.email})`);
            return back(res, { ok: `추가했습니다 — ${data.title}` });
        } catch (e) {
            // UNIQUE (mona_cd, title) 위반이 가장 흔하다
            const msg = e.code === '23505' ? '이미 같은 의원에게 같은 직위가 등록돼 있습니다.' : e.message;
            logger.error(`[admin] 직위 추가 실패: ${e.message}`);
            return back(res, { err: msg });
        }
    });

    controller.updateTitle = wrapWithContext(async function updateTitle(req, res) {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return back(res, { err: '잘못된 요청입니다.' });
        const { data, error } = parseForm(req.body);
        if (error) return back(res, { err: error });
        try {
            if (!(await dao.politicianExists(data.monaCd))) return back(res, { err: '존재하지 않는 의원입니다.' });
            const n = await dao.update(id, data);
            if (!n) return back(res, { err: '대상을 찾을 수 없습니다.' });
            logger.info(`[admin] 직위 수정 #${id}: ${data.title} (by ${req.user?.email})`);
            return back(res, { ok: `저장했습니다 — ${data.title}` });
        } catch (e) {
            const msg = e.code === '23505' ? '이미 같은 의원에게 같은 직위가 등록돼 있습니다.' : e.message;
            logger.error(`[admin] 직위 수정 실패: ${e.message}`);
            return back(res, { err: msg });
        }
    });

    controller.deleteTitle = wrapWithContext(async function deleteTitle(req, res) {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return back(res, { err: '잘못된 요청입니다.' });
        try {
            const n = await dao.remove(id);
            logger.info(`[admin] 직위 삭제 #${id} (${n}건, by ${req.user?.email})`);
            return back(res, n ? { ok: '삭제했습니다.' } : { err: '대상을 찾을 수 없습니다.' });
        } catch (e) {
            logger.error(`[admin] 직위 삭제 실패: ${e.message}`);
            return back(res, { err: e.message });
        }
    });

    return controller;
};
