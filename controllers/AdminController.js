// controllers/AdminController.js — 관리자: 의원 직위 관리
//
// 이 화면의 존재 이유: 직위 데이터는 자동 수집 경로가 없어 수동인데(소관 기관이 흩어져 있다),
// SQL 로 직접 넣으려면 mona_cd 를 매번 찾아야 한다. 그 수고를 없애는 게 핵심이다.
//
// ⚠️ 상임위 직위(위원장·간사·위원)는 여기서 못 고친다 — syncCommittees 가 매일 전체 교체한다.

import AdminDao from '../daos/AdminDao.js';
import IssueService from '../services/IssueService.js';
import logger from '../utils/logger.js';
import { wrapWithContext } from '../utils/wrapWithContext.js';
import { KIND_LABEL } from '../middlewares/pageViews.js';
import { REPORT_REASONS, REPORT_STATUS, resolveReportType } from '../utils/reportReasons.js';

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
    const issueService = IssueService(db);   // 쟁점 후보 발굴 (/admin/issue-candidates)
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

    /* ── 신고 처리 (2026-08-27) ──
       🔴 처리 단위는 **대상**이다 (신고가 아니다). 같은 댓글에 신고가 3건이면 한 줄로 뜨고
          한 번의 판단으로 3건이 같이 닫힌다. 자세한 이유는 마이그레이션 파일 주석. */
    const REPORT_FILTERS = ['open', 'handled', 'all'];

    controller.getReportsPage = wrapWithContext(async function getReportsPage(req, res, next) {
        /* 모르는 값은 에러가 아니라 기본값으로 접는다 (URL 을 손으로 고쳐도 안전 — /xray/chart 와 같은 판단) */
        const filter = REPORT_FILTERS.includes(String(req.query.status)) ? String(req.query.status) : 'open';
        try {
            const [groups, summary] = await Promise.all([
                dao.getReportGroups(filter, 100),
                dao.getReportSummary(),
            ]);
            res.render('admin/reports', {
                pageTitle: '신고 처리',
                pageStyles: null,
                currentUrl: '/admin/reports',
                groups, summary, filter,
                reasons: REPORT_REASONS,
                statusMeta: REPORT_STATUS,
                flash: req.query.ok || null,
                error: req.query.err || null,
            });
        } catch (error) {
            logger.error('관리자 신고 페이지 렌더링 중 에러:', `${error.message}\n${error.stack}`);
            next(error);
        }
    });

    const backReports = (res, filter, { ok, err }) => {
        const q = [`status=${encodeURIComponent(filter)}`];
        q.push(ok ? `ok=${encodeURIComponent(ok)}` : `err=${encodeURIComponent(err)}`);
        return res.redirect(`/admin/reports?${q.join('&')}`);
    };

    /* POST /admin/reports/:type/:targetId — action=keep|remove
       🔴 「살려둠」이 대상을 되살리는 것은 **우리가 지운 경우(status='removed')뿐**이다.
          작성자 본인이 지운 글까지 되살리면 그건 삭제 의사를 뒤집는 것이라 하면 안 된다. */
    controller.resolveReport = wrapWithContext(async function resolveReport(req, res) {
        const filter = REPORT_FILTERS.includes(String(req.query.status)) ? String(req.query.status) : 'open';
        const type = resolveReportType(req.params.type);
        const targetId = Number(req.params.targetId);
        const action = String((req.body || {}).action || '');

        if (!type || !Number.isSafeInteger(targetId) || targetId <= 0) {
            return backReports(res, filter, { err: '잘못된 요청입니다.' });
        }
        if (!['keep', 'remove'].includes(action)) {
            return backReports(res, filter, { err: '알 수 없는 처리입니다.' });
        }
        try {
            const before = await dao.getReportGroupStatus(type, targetId);
            if (!before || before.n === 0) return backReports(res, filter, { err: '이미 없는 신고입니다.' });

            if (action === 'remove') {
                await dao.setTargetDeleted(type, targetId, true);
            } else if (before.status === 'removed') {
                await dao.setTargetDeleted(type, targetId, false);   // 우리가 지운 것만 되살린다
            }
            const n = await dao.resolveReports(type, targetId, action === 'remove' ? 'removed' : 'kept',
                                               req.user?.user_id || null);
            const what = type === 'comment' ? '댓글' : '글';
            const verb = action === 'remove' ? '삭제했습니다'
                       : (before.status === 'removed' ? '되살렸습니다' : '살려뒀습니다');
            logger.info(`[admin] 신고 처리: ${type}#${targetId} → ${action} (신고 ${n}건, by ${req.user?.email})`);
            return backReports(res, filter, { ok: `${what}을 ${verb} (신고 ${n}건 처리)` });
        } catch (e) {
            logger.error(`[admin] 신고 처리 실패: ${e.message}`);
            return backReports(res, filter, { err: e.message });
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
                /* 비회원이 이 화면의 주인공이다 — 운영 초기엔 회원(대부분 본인·테스트 계정)이 전체를 지배한다.
                   관리자는 middlewares/pageViews.js 에서 아예 집계 제외되지만, 테스트용 일반 계정은 남는다. */
                totals: {
                    views: sum('views'), uniques: sum('uniques'),
                    guestViews: sum('guest_views'), guestUniques: sum('guest_uniques'),
                    memberViews: sum('member_views'), memberUniques: sum('member_uniques'),
                    /* 신규 + 재방문 = uniques (같은 집합을 쪼갠 값). 회원/비회원 분해와는 축이 다르다 */
                    newVisitors: sum('new_visitors'), returningVisitors: sum('returning_visitors'),
                },
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
            return back(res, { ok: `추가했습니다: ${data.title}` });
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
            return back(res, { ok: `저장했습니다: ${data.title}` });
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
                check: '의장단·원내대표·당대표·장관. 바뀐 뒤 안 지우면 두 명으로 보인다',
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

    /* 쟁점 후보 발굴 — 선정 기준(utils/issues.js)을 **실행 가능하게** 만드는 화면.
       🔴 자동 선정은 안 된다는 게 결론이므로 이 화면은 "후보를 정해주는" 게 아니라
          사람이 고를 때 쓰는 **재료와 검사기**다. 최종 판단·이름은 사람이 하고 이유는 `why` 에 쓴다. */
    controller.getIssueCandidatesPage = wrapWithContext(async function getIssueCandidatesPage(req, res, next) {
        try {
            // ?kw=상속세,증여세 — 검사기. 없으면 후보 목록만 그린다
            const raw = String(req.query.kw || '').trim();
            const keywords = raw ? raw.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 6) : [];

            const [candidates, check] = await Promise.all([
                issueService.getCandidates(),
                keywords.length ? issueService.checkKeywords(keywords) : Promise.resolve(null),
            ]);

            res.render('admin/issue_candidates', {
                pageTitle: '쟁점 후보',
                pageStyles: null,
                currentUrl: '/admin/issue-candidates',
                kwRaw: raw,
                check,
                ...candidates,
            });
        } catch (error) {
            logger.error(`쟁점 후보 화면 실패 — ${error.message}`);
            next(error);
        }
    });

    /* SNS 콘텐츠 허브 — 캐러셀 도구 4종 + 브리핑 인스타 카드·쓰레드를 한 화면에서 (2026-08-26).
       🔴 도구 페이지들(/promo/*·/briefing/:id/card)은 공개 라우트다 — 여기는 **찾아가는 메뉴**지 권한 경계가 아니다
       (권한 경계를 여기로 옮기면 브리핑 카드처럼 로그인 상태에 따라 미리보기가 안 되는 문제가 생긴다). */
    controller.getSnsPage = wrapWithContext(async function getSnsPage(req, res, next) {
        try {
            const [{ rows: briefings }, { rows: logRows }, { rows: axisAgg }, { rows: weekAgg }, { rows: unpaired }] = await Promise.all([
                db.query(`SELECT id, TO_CHAR(briefing_date, 'YYYY-MM-DD') AS briefing_date, headline, model
                            FROM briefing_posts ORDER BY briefing_date DESC LIMIT 7`),
                db.query(`SELECT id, TO_CHAR(posted_on, 'YYYY-MM-DD') AS posted_on, slot, channel, axis, format,
                                 saves, reach, replies, note
                            FROM sns_log ORDER BY posted_on DESC, id DESC LIMIT 60`),
                /* 축별 집계 — 🔴 **채널로 먼저 쪼갠다** (2026-08-27). 채널마다 채우는 칸이 달라서
                   (저장은 인스타만 · 답글은 쓰레드 중심) 섞으면 평균이 곧바로 거짓이 된다.
                   실제로 쓰레드 행에 저장 0 이 들어가 `오늘` 축 평균 저장이 내려가 있었다.
                   ⚠️ `COUNT(지표)` 를 같이 낸다 — 게시 18건인데 평균이 1건에서 나온 값일 수 있다.
                      화면이 `n=` 으로 밝히지 않으면 표본 1짜리를 순위로 읽게 된다. */
                db.query(`SELECT channel, axis, COUNT(*)::int AS cnt
                               , COUNT(saves)::int   AS n_saves,   ROUND(AVG(saves))::int   AS avg_saves
                               , COUNT(reach)::int   AS n_reach,   ROUND(AVG(reach))::int   AS avg_reach
                               , COUNT(replies)::int AS n_replies, ROUND(AVG(replies))::int AS avg_replies
                            FROM sns_log GROUP BY channel, axis ORDER BY channel, COUNT(*) DESC`),
                db.query(`SELECT TO_CHAR(DATE_TRUNC('week', posted_on), 'MM.DD') AS wk, COUNT(*)::int AS cnt
                               , SUM(saves)::int AS saves, SUM(replies)::int AS replies
                            FROM sns_log GROUP BY 1 ORDER BY 1 DESC LIMIT 6`),
                /* 짝 없는 브리핑 — 인스타·쓰레드 중 한쪽만 기록된 건 (2026-08-27).
                   🔴 브리핑은 항상 두 채널에 같이 올리므로 한쪽만 있으면 **기록이 빠진 것**이다.
                      실제로 08-12 브리핑의 쓰레드 행이 통째로 빠져 있었는데 눈으로는 못 잡았다.
                   ⚠️ 패턴에 역슬래시(\d)를 쓰지 말 것 — 템플릿 리터럴이 먹어서 매칭이 통째로 실패하고,
                      그러면 경고가 **조용히 안 뜬다**. 대괄호 표현([0-9])이라야 안전하다.
                   ⚠️ 포맷의 `(MM-DD)` 로 묶는다 — 그게 브리핑을 식별하는 유일한 키다 (bill 처럼 id 를 안 들고 있다). */
                db.query(`SELECT bd
                               , BOOL_OR(channel = '인스타') AS has_ig
                               , BOOL_OR(channel = '쓰레드') AS has_th
                               , MIN(TO_CHAR(posted_on, 'MM-DD')) AS d
                            FROM (SELECT SUBSTRING(format FROM '[(]([0-9][0-9]-[0-9][0-9])[)]') AS bd, channel, posted_on
                                    FROM sns_log WHERE format LIKE '브리핑%') t
                           WHERE bd IS NOT NULL
                           GROUP BY bd
                          HAVING NOT (BOOL_OR(channel = '인스타') AND BOOL_OR(channel = '쓰레드'))
                           ORDER BY bd DESC`),
            ]);
            res.render('admin/sns', {
                pageTitle: 'SNS 콘텐츠', pageStyles: null, currentUrl: '/admin/sns',
                briefings: briefings.map((b) => ({
                    id: Number(b.id), date: b.briefing_date, headline: b.headline,
                    // 폴백·활동없음 카드는 올릴 카드가 아니다 (export API 의 publishable 과 같은 판정)
                    publishable: b.model !== 'fallback' && b.model !== 'none',
                })),
                logRows, axisAgg, weekAgg, unpaired,
                // 폼 기본값 — 오늘 (KST 고정, 로컬 getter 금지)
                todayKst: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()),
                flash: req.query.ok || null,
                error: req.query.err || null,
            });
        } catch (err) {
            logger.error('SNS 콘텐츠 허브 렌더링 중 에러:', `${err.message}\n${err.stack}`);
            next(err);
        }
    });

    /* ── SNS 성과표 (sns_log) — PRG 패턴 (titles 와 동일). 지표는 게시 당일 비워두고 금요일에 채운다 ── */
    const backSns = (res, { ok, err }) =>
        res.redirect(`/admin/sns?${ok ? `ok=${encodeURIComponent(ok)}` : `err=${encodeURIComponent(err)}`}#sns-log`);
    const SNS_ENUM = {
        slot: ['', '아침', '점심', '저녁'],
        channel: ['인스타', '쓰레드', '유튜브', '기타'],
        axis: ['당신', '숫자', '오늘', '사람', '브랜드'],
    };
    // 숫자 칸: 빈 문자열 = NULL (아직 안 잼). 음수·쓰레기는 거부
    const numOrNull = (v) => {
        const t = String(v ?? '').trim();
        if (t === '') return { val: null };
        const n = Number(t);
        return Number.isInteger(n) && n >= 0 ? { val: n } : { bad: true };
    };
    const parseSnsForm = (body) => {
        const postedOn = String(body.postedOn || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(postedOn)) return { error: '게시일이 필요합니다 (YYYY-MM-DD).' };
        const slot = SNS_ENUM.slot.includes(body.slot) ? body.slot : '';
        const channel = String(body.channel || '');
        const axis = String(body.axis || '');
        if (!SNS_ENUM.channel.includes(channel)) return { error: '채널을 선택해주세요.' };
        if (!SNS_ENUM.axis.includes(axis)) return { error: '축을 선택해주세요.' };
        const format = String(body.format || '').trim().slice(0, 100);
        if (!format) return { error: '포맷을 적어주세요 (예: 문안 8 · 브리핑 캐러셀).' };
        const nums = {};
        for (const k of ['saves', 'reach', 'replies']) {
            const r = numOrNull(body[k]);
            if (r.bad) return { error: '저장·도달·답글은 0 이상의 정수만 됩니다.' };
            nums[k] = r.val;
        }
        return { data: { postedOn, slot, channel, axis, format, ...nums, note: String(body.note || '').trim() } };
    };

    controller.createSnsLog = wrapWithContext(async function createSnsLog(req, res) {
        const { data, error } = parseSnsForm(req.body);
        if (error) return backSns(res, { err: error });
        try {
            await db.query(`INSERT INTO sns_log (posted_on, slot, channel, axis, format, saves, reach, replies, note)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [data.postedOn, data.slot, data.channel, data.axis, data.format, data.saves, data.reach, data.replies, data.note]);
            return backSns(res, { ok: `기록했습니다: ${data.postedOn} ${data.format}` });
        } catch (e) {
            logger.error(`[admin] SNS 기록 실패: ${e.message}`);
            return backSns(res, { err: e.message });
        }
    });

    /* 지표만 나중에 채우는 수정 — 행의 인라인 폼이 숫자 셋 + 비고만 보낸다 */
    controller.updateSnsLog = wrapWithContext(async function updateSnsLog(req, res) {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return backSns(res, { err: '잘못된 요청입니다.' });
        const nums = {};
        for (const k of ['saves', 'reach', 'replies']) {
            const r = numOrNull(req.body[k]);
            if (r.bad) return backSns(res, { err: '저장·도달·답글은 0 이상의 정수만 됩니다.' });
            nums[k] = r.val;
        }
        try {
            const { rowCount } = await db.query(
                `UPDATE sns_log SET saves = $2, reach = $3, replies = $4, note = $5 WHERE id = $1`,
                [id, nums.saves, nums.reach, nums.replies, String(req.body.note || '').trim()]);
            if (!rowCount) return backSns(res, { err: '대상을 찾을 수 없습니다.' });
            return backSns(res, { ok: '지표를 채웠습니다.' });
        } catch (e) {
            logger.error(`[admin] SNS 기록 수정 실패: ${e.message}`);
            return backSns(res, { err: e.message });
        }
    });

    controller.deleteSnsLog = wrapWithContext(async function deleteSnsLog(req, res) {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return backSns(res, { err: '잘못된 요청입니다.' });
        const { rowCount } = await db.query(`DELETE FROM sns_log WHERE id = $1`, [id]);
        return rowCount ? backSns(res, { ok: '지웠습니다.' }) : backSns(res, { err: '대상을 찾을 수 없습니다.' });
    });

    return controller;
};