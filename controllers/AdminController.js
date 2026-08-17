// controllers/AdminController.js — 관리자: 의원 직위 관리
//
// 이 화면의 존재 이유: 직위 데이터는 자동 수집 경로가 없어 수동인데(소관 기관이 흩어져 있다),
// SQL 로 직접 넣으려면 mona_cd 를 매번 찾아야 한다. 그 수고를 없애는 게 핵심이다.
//
// ⚠️ 상임위 직위(위원장·간사·위원)는 여기서 못 고친다 — syncCommittees 가 매일 전체 교체한다.

import AdminDao from '../daos/AdminDao.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';
import { KIND_LABEL } from '../middlewares/pageViews.js';

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

    /* 방문 통계. ?days=7|30|90 (기본 30). 모르는 값은 30 으로 접는다.
       ⚠️ 관리자 전용 — 순위표(상세 TOP)를 공개하면 그 자체가 편집이 된다 */
    const DAYS_OPTIONS = [7, 30, 90];
    controller.getStatsPage = wrapWithContext(async function getStatsPage(req, res, next) {
        const days = DAYS_OPTIONS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
        try {
            const [daily, byKind, topPol, topBill, topBrief, users, userList] = await Promise.all([
                dao.getStatsDaily(days),
                dao.getStatsByKind(days),
                dao.getStatsTopTargets(days, 'politician_detail', 20),
                dao.getStatsTopTargets(days, 'bill_detail', 20),
                dao.getStatsTopTargets(days, 'briefing_detail', 10),
                dao.getStatsUsers(days),
                dao.getStatsUserList(days, 50),
            ]);
            const sum = (k) => daily.reduce((a, d) => a + Number(d[k] || 0), 0);
            res.render('admin/stats', {
                pageTitle: '방문 통계',
                pageStyles: null,
                currentUrl: '/admin/stats',
                days, daysOptions: DAYS_OPTIONS,
                daily, byKind, topPol, topBill, topBrief, users, userList,
                kindLabel: KIND_LABEL,
                totals: { views: sum('views'), uniques: sum('uniques') },
                today: daily[daily.length - 1] || null,
                yesterday: daily[daily.length - 2] || null,
            });
        } catch (error) {
            logger.error('관리자 방문 통계 렌더링 중 에러:', `${error.message}\n${error.stack}`);
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

    /* GET /admin/schedule — 운영 일정: 정기·조건부 작업이 언제 했고 언제 해야 하는지 한 화면에 (2026-08-16)
       🔴 일정 테이블을 따로 만들지 않는다. 각 작업이 이미 남기는 기록(batch_runs · 매핑 updated_at · 좌표 computed_at ·
          직위 review_after · 브리핑 날짜)에서 "마지막" 을 읽고, 주기는 여기 코드에 적는다.
          외부 알림(카톡·메일)이 아니라 관리자가 들어와서 보는 화면 — 크론 체인이 죽은 것도 여기서 보인다 */
    controller.getSchedulePage = wrapWithContext(async function getSchedulePage(req, res, next) {
        try {
            const [sig, batches] = await Promise.all([dao.getScheduleSignals(), dao.getScheduleBatches()]);
            const today = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()));
            const dayDiff = (ymd) => ymd ? Math.round((new Date(ymd.slice(0, 10)) - today) / 86400000) : null;   // 양수 = 미래
            const addDays = (ymd, n) => { const d = new Date(ymd.slice(0, 10)); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
            const statusOf = (dueYmd, soonDays = 14) => {
                if (!dueYmd) return 'unknown';
                const k = dayDiff(dueYmd);
                return k < 0 ? 'overdue' : k <= soonDays ? 'soon' : 'ok';
            };

            const rows = [];
            // ① 축 매핑 분기 갱신 (사용자가 로컬에서 · 크레딧 ≈ $1)
            const mapNext = sig.mapping_last ? addDays(sig.mapping_last, 91) : null;
            rows.push({
                key: 'mapping', title: '축 매핑 분기 갱신', cadence: '3개월마다 · 로컬 · 약 $1',
                last: sig.mapping_last, next: mapNext, status: statusOf(mapNext, 21),
                note: `v2 매핑 ${Number(sig.mapping_n || 0).toLocaleString('ko-KR')}건 · 마지막 갱신 뒤 발의된 법안 ${Number(sig.bills_since_mapping || 0).toLocaleString('ko-KR')}건 (매달 약 4%p 씩 커버리지가 빠진다)`,
                howto: [
                    'node batch/mapBillAxisPilot.js --target 100000 --max-candidates 20000 --sync-v2',
                    'node batch/calibrateAxisAnchors.js',
                    'MIN_N=5 node batch/validateAxisPilot.js',
                ],
                check: '분할-반 신뢰도(직전 경제 0.88 · 사회 0.63 · 제도 0.60) · 정당 평균 방향(민주 + / 국힘 −) · 경제 부호 정합(직전 89%). 로그의 균형 선별에서 전통·안정 셀이 늘었으면 findRareCellCandidates.js 도. 끝나면 CLAUDE.md 「눈금 보정 실측」 갱신',
            });
            // ② 의원 좌표 재계산 (매일 새벽 크론)
            const axisLastYmd = sig.axis_last ? sig.axis_last.slice(0, 10) : null;
            const axisAge = axisLastYmd ? -dayDiff(axisLastYmd) : null;
            rows.push({
                key: 'axis', title: '의원 좌표 재계산', cadence: '매일 04:00 KST · 크론(calcPoliticianAxis)',
                last: sig.axis_last, next: axisLastYmd ? addDays(axisLastYmd, 1) : null,
                status: axisAge === null ? 'unknown' : axisAge > 2 ? 'overdue' : 'ok',
                note: `세 축 다 있는 의원 ${sig.axis_n3 || 0}명`,
                howto: ['node batch/calcPoliticianAxis.js   # 바로 반영하고 싶을 때만. 평소엔 크론'],
                check: '이틀 넘게 안 돌았으면 크론 체인(아래 배치 표)을 볼 것',
            });
            // ③ 유형 분포 점검 (조건부: 진단 완료자 50명)
            const done = Number(sig.users_done || 0);
            rows.push({
                key: 'types', title: '유형 9종 분포 점검', cadence: '진단 완료자 50명 도달 시 1회 (이후 100명마다)',
                last: null, next: null, status: done >= 50 ? 'soon' : 'ok',
                note: `완료자 ${done}명 / 50명`,
                howto: [`SELECT ... FROM user_axis_score  -- 유형은 utils/axisConfig.js typeOf() 로 계산 (경제×사회 사분면 + 온건/균형)`],
                check: '한 유형에 40%+ 몰리면 axisConfig.js 의 임계값 0.20/0.55 를 옮긴다 (공유 가치가 떨어진다)',
            });
            // ④ 직위 재확인 (review_after)
            const tDue = Number(sig.titles_due || 0), tSoon = Number(sig.titles_soon || 0);
            rows.push({
                key: 'titles', title: '의원 직위 재확인', cadence: '직위별 review_after · 크론 로그가 30일 전부터 알림',
                last: null, next: sig.titles_next, status: tDue > 0 ? 'overdue' : tSoon > 0 ? 'soon' : 'ok',
                note: `기한 지난 것 ${tDue}건 · 30일 안 ${tSoon}건`,
                howto: ['/admin/titles 에서 확인·수정 (SQL 불필요)'],
                check: '의장단·원내대표·당대표·장관 — 바뀐 뒤 안 지우면 두 명으로 보인다',
                link: '/admin/titles',
            });
            // ⑤ 브리핑 (매일, 원천 1~2일 지연)
            const bAge = sig.briefing_last ? -dayDiff(sig.briefing_last) : null;
            rows.push({
                key: 'briefing', title: '국회 브리핑 카드', cadence: '매일 새벽 크론(genBriefing) · 원천 1~2일 지연이 정상',
                last: sig.briefing_last, next: null,
                status: bAge === null ? 'unknown' : bAge > 5 ? 'overdue' : 'ok',
                note: bAge === null ? '' : `마지막 카드 날짜에서 ${bAge}일 경과 (5일 넘으면 배치 확인)`,
                howto: ['node batch/genBriefing.js   # 수동 보충 · --date YYYY-MM-DD'],
                check: '/briefing 대기 카드가 4장 넘게 쌓였는지',
                link: '/briefing',
            });

            // 배치 체인 — 실패·멈춤 표시
            const chain = ['syncPoliticians','syncCommittees','syncSpeeches','syncBills','syncBillSummary','syncVotes','refreshCrossPartyVote','refreshDissent','refreshCommitteeSpeech','calcPoliticianAxis','calcGroupAxisAvg','genBriefing'];
            const byName = Object.fromEntries(batches.map(b => [b.batch_name, b]));
            const NO_LOG = new Set(['calcPoliticianAxis', 'calcGroupAxisAvg']);   // batch_runs 에 기록을 안 남기는 배치 — 좌표는 위 ② 행(computed_at)으로 본다
            const batchRows = chain.map(name => {
                const b = byName[name] || {};
                if (NO_LOG.has(name) && !b.batch_name) return { name, status: 'nolog', last_success: null, last_failed: null };
                const lastOk = b.last_success ? b.last_success.slice(0, 10) : null;
                const age = lastOk ? -dayDiff(lastOk) : null;
                let st = 'unknown';
                if (b.stuck > 0) st = 'overdue';
                else if (b.latest_status === 'failed') st = 'overdue';
                else if (age !== null && age > 2) st = 'overdue';
                else if (age !== null) st = 'ok';
                return { name, ...b, status: st, age };
            });
            const chainAlert = batchRows.filter(r => r.status === 'overdue');

            res.render('admin/schedule', {
                pageTitle: '운영 일정', pageStyles: null, currentUrl: '/admin/schedule',
                rows, batchRows, chainAlert, today: today.toISOString().slice(0, 10),
            });
        } catch (err) {
            logger.error('운영 일정 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    return controller;
};
