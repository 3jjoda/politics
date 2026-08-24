// services/IssueService.js — 쟁점(/issue) 데이터 조립
//
// 성격: **AI 없음, 순수 SQL.** 쟁점 머리의 숫자(건수·기간·상태·정당·서명자)는 전부 집계값이고,
// 개별 법안 해설만 bill_ai_analysis(5-Zone)가 맡는다. 브리핑과 같은 분담이다 —
// **숫자는 SQL, 문장은 템플릿, 생성물에서 숫자를 받지 않는다.**
//
// 🔴 순위를 매기지 않는다. 키워드 매칭은 후보를 좁힐 뿐 "이 법안이 이 쟁점인가" 를 가르지 못한다
//    (실측 근거는 utils/issues.js 주석). 신뢰할 수 있는 자동 분류는 **근거 법률(bill_name)** 하나뿐이라
//    그걸로만 묶는다. 관련도 점수·정렬을 넣고 싶어지면 그 주석을 먼저 읽을 것.

import IssueDao from '../daos/IssueDao.js';
import { ISSUES, issueBySlug } from '../utils/issues.js';
import logger from '../utils/logger.js';

const CACHE_TTL_MS = 10 * 60 * 1000;   // 배치가 하루 1회만 바꾸므로 10분이면 충분
const MIN_GROUP = 2;                   // 이 미만인 법률은 "그 외" 로 묶는다 (13개 단건 그룹은 노이즈)

export default (db) => {
    const dao = IssueDao(db);
    const cache = new Map();     // slug → { at, data }
    const inflight = new Map();  // slug → Promise

    /* 근거 법률별 묶음. n>=2 는 이름 있는 그룹, 나머지는 "그 외 단건 법률" 하나로.
       ⚠️ 단건을 **버리지 않는다** — 숨기면 머리의 총 건수와 목록 합계가 안 맞아
          "나머지는 어디 갔나" 가 된다 (브리핑 접기와 같은 규칙). */
    const groupByLaw = (bills) => {
        const byLaw = new Map();
        bills.forEach((b) => {
            const k = b.bill_name || '(법안명 없음)';
            if (!byLaw.has(k)) byLaw.set(k, []);
            byLaw.get(k).push(b);
        });
        const named = [];
        const singles = [];
        for (const [law, rows] of byLaw) (rows.length >= MIN_GROUP ? named : singles).push({ law, bills: rows });
        named.sort((a, b) => b.bills.length - a.bills.length || b.bills[0].propose_dt.localeCompare(a.bills[0].propose_dt));
        singles.sort((a, b) => b.bills[0].propose_dt.localeCompare(a.bills[0].propose_dt));
        return {
            groups: named,
            singles: singles.flatMap((s) => s.bills),
        };
    };

    /* 🔴 "그래서 어떻게 됐나" — 처리 결과를 **네 갈래 서사**로 접는다 (2026-08-23).
       상태 칩만 늘어놓으면 `대안반영폐기 38` 이 무슨 뜻인지 아무도 모른다. 사용자가 쟁점 페이지에
       들어와서 가장 먼저 묻는 건 "그래서 어떻게 됐어?" 인데 칩은 거기 답하지 않는다.
       ⚠️ 원천의 결과명이 늘어날 수 있다. 모르는 값은 버리지 말고 `other` 로 모은다 —
          버리면 갈래 합계가 총 건수와 안 맞아 "나머지는 어디 갔나" 가 된다. */
    const OUTCOME = {
        passed:  ['원안가결', '수정가결'],
        merged:  ['대안반영폐기', '수정안반영폐기'],
        dropped: ['철회'],
        killed:  ['부결', '폐기', '임기만료폐기'],
    };
    const buildOutcome = (bills) => {
        const bucket = { passed: [], merged: [], dropped: [], killed: [], other: [], pending: [] };
        bills.forEach((b) => {
            const r = b.proc_result_name;
            if (!r) return bucket.pending.push(b);
            const k = Object.keys(OUTCOME).find((key) => OUTCOME[key].includes(r));
            bucket[k || 'other'].push(b);
        });
        const waited = bucket.pending
            .map((b) => Number(b.pending_days))
            .filter((n) => Number.isFinite(n));
        return {
            ...bucket,
            // 통과한 법안은 **목록으로 보여준다** — 이 쟁점에서 실제로 무슨 일이 일어났는지의 답이라
            // 숫자만 두면 확인할 방법이 없다
            passedBills: bucket.passed.slice(0, 5),
            longestWait: waited.length ? Math.max(...waited) : null,
            otherLabels: [...new Set(bucket.other.map((b) => b.proc_result_name))],
        };
    };

    /* 🔴 "그래서 내 삶에 뭐가 달라지는데?" — 이 질문의 답은 **이미 DB 에 있었다** (2026-08-23).
       5-Zone 의 Zone 2 가 정확히 그것이다: changes(지금은/바뀌면) + affected(혜택/손해/direct).
       `affected.direct` 는 `["전세 임차인","임대인","부동산 중개사"]` 처럼 **실제 사람 목록**이라
       쟁점 페이지에서 바로 쓸 수 있는데 그동안 법안 상세에만 갇혀 있었다.

       ⚠️ changes 의 값에는 `<strong>` 이 들어 있다 (법안 상세는 renderRichText 로 렌더).
          여기선 **태그를 걷어내고 자른다** — 자르는 길이가 태그 중간에 걸리면 마크업이 깨지고,
          카드가 압축 표시라 강조가 없어도 읽힌다. 되살리려면 서버용 renderRichText 부터 만들 것.
       ⚠️ 해설 없는 법안은 여기 안 나온다. **커버리지를 화면에 숫자로 밝힐 것** (5 / 102).
          안 밝히면 "이 쟁점의 영향은 이게 전부" 로 읽힌다. */
    const stripTags = (v) => String(v || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const cut = (v, n) => (v.length > n ? `${v.slice(0, n).trim()}…` : v);
    const buildImpacts = (bills) => bills
        .filter((b) => b.has_analysis && b.ai_changes)
        .map((b) => ({
            bill_id: b.bill_id,
            bill_name: b.bill_name,
            proposer_name: b.proposer_name,
            proc_result_name: b.proc_result_name,
            proc_dt: b.proc_dt,
            passed: OUTCOME.passed.includes(b.proc_result_name),
            headline: b.ai_summary,
            current: cut(stripTags(b.ai_changes.current), 110),
            revised: cut(stripTags(b.ai_changes.revised), 170),
            benefit: cut(stripTags(b.ai_affected?.benefit), 120),
            loss: cut(stripTags(b.ai_affected?.loss), 120),
            who: (Array.isArray(b.ai_affected?.direct) ? b.ai_affected.direct : []).slice(0, 5),
        }))
        // 통과한 것 먼저 — "이미 바뀐 것" 이 "바뀔 수도 있는 것" 보다 확실한 정보다.
        // 그 안에서는 bills 순서(최신 발의순)를 그대로 쓴다 — 최근 제안이 더 관련 있다
        .sort((a, b) => (b.passed - a.passed));

    const tally = (rows, key, fallback) => {
        const m = new Map();
        rows.forEach((r) => { const k = r[key] || fallback; m.set(k, (m.get(k) || 0) + 1); });
        return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
    };

    /* 🔴 전체 기준선은 **전 쟁점 공통**이라 따로 캐시한다. 전건(18,830행) 스캔이라 쟁점마다 돌리면 안 된다.
       ⚠️ 실패해도 null 을 돌린다 — 비교값이 없으면 화면이 기준선 없이 숫자만 낸다 (페이지는 산다). */
    let globalCache = null;
    let globalInflight = null;
    function getGlobal() {
        if (globalCache && Date.now() - globalCache.at < CACHE_TTL_MS) return Promise.resolve(globalCache.data);
        if (globalInflight) return globalInflight;
        globalInflight = dao.getGlobalBenchmark()
            .then((d) => { globalCache = { at: Date.now(), data: d }; return d; })
            .catch((err) => { logger.error(`전체 기준선 조회 실패 — ${err.message}`); return null; })
            .finally(() => { globalInflight = null; });
        return globalInflight;
    }

    /* 쟁점 지표 + 전체 기준선 → 화면이 그대로 쓸 모양.
       🔴 **비교값이 있어야 사실이 된다.** "위원회 처리 5%" 는 전체가 26.2% 라는 걸 알아야 뜻이 생긴다.
       ⚠️ 좋다/나쁘다를 붙이지 않는다 — `dir`(above/below/near)까지만 내고 해석은 화면 각주가 맡는다. */
    const pct = (a, b) => (b > 0 ? Math.round(a / b * 1000) / 10 : null);
    function shapeBenchmark(mine, all) {
        if (!mine || !mine.total) return null;
        const rows = [
            { key: 'cmt', label: '위원회 문턱을 넘은 법안',
              mine: pct(mine.cmt_done, mine.total), all: all ? pct(all.cmt_done, all.total) : null,
              unit: '%', detail: `${mine.cmt_done}건 / ${mine.total}건` },
            { key: 'cross', label: '두 거대 정당이 같이 이름을 올린 법안',
              mine: pct(mine.cross_party, mine.signed_total), all: all ? pct(all.cross_party, all.signed_total) : null,
              unit: '%', detail: `${mine.cross_party}건 / ${mine.signed_total}건` },
            { key: 'wait', label: '아직 심사 중인 법안의 평균 대기',
              mine: mine.pending_days, all: all ? all.pending_days : null,
              unit: '일', detail: null },
        ];
        return rows.map((r) => {
            const diff = (r.mine != null && r.all != null) ? Math.round((r.mine - r.all) * 10) / 10 : null;
            // 근사 판정: 비율은 3%p, 일수는 30일 안이면 "비슷"
            const near = diff == null ? true : Math.abs(diff) < (r.unit === '%' ? 3 : 30);
            return { ...r, diff, dir: near ? 'near' : (diff > 0 ? 'above' : 'below') };
        });
    }

    async function build(issue) {
        const [bills, signers, briefings, topSigners, bench, globalBench] = await Promise.all([
            dao.getBills(issue.keywords),
            dao.getSigners(issue.keywords),
            // 쟁점 페이지는 22대 전체를 모은 것이라 **지금도 움직이는지**가 안 보인다.
            // 최근 브리핑에 이 쟁점 법안이 있었다는 게 그 신호이자 브리핑으로 가는 길이다.
            dao.getBriefings(issue.keywords).catch(() => []),
            // "누가 이걸 밀고 있나" — 정당 분포만으로는 답이 안 된다. 의원 페이지로 가는 유일한 길이기도 하다
            dao.getTopSigners(issue.keywords).catch(() => []),
            dao.getBenchmark(issue.keywords).catch(() => null),
            getGlobal(),
        ]);
        if (!bills.length) return { issue, bills: [], stats: null, groups: [], singles: [], signers: [], briefings: [], topSigners: [], benchmark: null };

        const { groups, singles } = groupByLaw(bills);
        const dates = bills.map((b) => b.propose_dt).filter(Boolean).sort();

        return {
            issue,
            bills,
            groups,
            singles,
            signers,
            // 키워드 → 뉴스 **검색 링크만** 만든다. 기사를 수집·표시하지 않는다
            // (저작권 + 매체 선택이 곧 편집 입장이 되는 중립성 문제 — 브리핑과 같은 규칙)
            newsLinks: issue.keywords.map((k) => ({
                keyword: k,
                naver: `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(k)}`,
                google: `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(k)}`,
            })),
            briefings,
            topSigners,
            benchmark: shapeBenchmark(bench, globalBench),
            outcome: buildOutcome(bills),
            impacts: buildImpacts(bills),
            stats: {
                total: bills.length,
                analyzed: bills.filter((b) => b.has_analysis).length,
                pending: bills.filter((b) => !b.proc_result_name).length,
                withVotes: bills.filter((b) => Number(b.vote_count) > 0).length,
                firstDate: dates[0] || null,
                lastDate: dates.at(-1) || null,
                lawCount: groups.length + singles.length,
                byStatus: tally(bills, 'proc_result_name', '계류'),
                byParty: tally(bills, 'party_name', '(명부 없음)'),
                signerTotal: signers.reduce((a, s) => a + Number(s.n), 0),
            },
        };
    }

    /* 10분 캐시 + inflight 공유 (XrayService·BriefingService 와 같은 수법).
       ⚠️ 실패는 캐시하지 않는다 — 다음 요청에 다시 시도해야 한다. */
    function get(slug) {
        const issue = issueBySlug(slug);
        if (!issue) return Promise.resolve(null);

        const hit = cache.get(slug);
        if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.data);
        if (inflight.has(slug)) return inflight.get(slug);

        const pr = build(issue)
            .then((data) => { cache.set(slug, { at: Date.now(), data }); return data; })
            .catch((err) => { logger.error(`IssueService.get(${slug}) 실패 — ${err.message}`); throw err; })
            .finally(() => inflight.delete(slug));
        inflight.set(slug, pr);
        return pr;
    }

    /* 접힌 「법안 전체 보기」의 페이지.
       🔴 **추가 쿼리가 없다** — `get(slug)` 이 이미 전건을 캐시로 들고 있어 그걸 자른다.
          그래서 페이징이 DB 부하를 늘리지 않고, 대신 **SSR 페이로드를 줄인다**
          (국민연금 165행 전부 SSR 하면 162KB. 20행이면 그만큼 빠진다).
       ⚠️ 정렬은 `getIssueBills.sql` 이 정한 순서 그대로다 (최신 발의순 + bill_id tiebreak).
          여기서 다시 정렬하면 SSR 첫 페이지와 API 다음 페이지의 경계가 어긋난다
          (의원 상세에서 실제로 3건 중복이 났던 함정). */
    const BILLS_PER_PAGE = 20;
    async function getBillsPage(slug, page = 1) {
        const d = await get(slug);
        if (!d || !d.bills.length) return null;
        const total = d.bills.length;
        const totalPages = Math.max(1, Math.ceil(total / BILLS_PER_PAGE));
        // 범위 밖은 에러가 아니라 접는다 (브리핑 피드·/xray/chart 와 같은 판단)
        const p = Math.min(Math.max(1, Number(page) || 1), totalPages);
        return {
            page: p, totalPages, total, perPage: BILLS_PER_PAGE,
            bills: d.bills.slice((p - 1) * BILLS_PER_PAGE, p * BILLS_PER_PAGE),
        };
    }

    /* 브리핑 → 쟁점. 그날 발의된 법안이 어느 쟁점에 걸리는지.
       🔴 **날짜로 잇는다.** 카드의 `bill_ids` 는 그날의 대표 5건뿐이라 그걸로 매칭하면
          겹침을 크게 놓친다 (실측: bill_ids 기준 9/32 카드 → 날짜 기준 **19/32**).
       ⚠️ 실패해도 빈 배열을 돌려 브리핑을 살린다 — 부가 정보 때문에 페이지가 죽으면 안 된다. */
    const dateCache = new Map();   // 'YYYY-MM-DD' → { at, data }
    async function getIssuesForDate(date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return [];
        const hit = dateCache.get(date);
        if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
        try {
            const counts = await Promise.all(ISSUES.map((i) => dao.countForDate(i.keywords, date)));
            const data = ISSUES
                .map((i, n) => ({ slug: i.slug, title: i.title, n: counts[n] }))
                .filter((x) => x.n > 0)
                .sort((a, b) => b.n - a.n);
            dateCache.set(date, { at: Date.now(), data });
            return data;
        } catch (err) {
            logger.error(`IssueService.getIssuesForDate(${date}) 실패 — ${err.message}`);
            return [];
        }
    }

    /* 목록용 — 쟁점마다 요약 수치. 캐시를 그대로 재사용한다 (추가 쿼리 없음).
       🔴 `lastDate`(가장 최근 발의일)를 같이 낸다. 쟁점이 늘어나면 목록에서
          가장 먼저 묻는 게 **"지금 뭐가 움직이나"** 라서 그게 기본 정렬 기준이 된다.
       ⚠️ 오늘 날짜는 `Intl` 로 KST 를 뽑는다 — 로컬 getter 금지 (프로젝트 공통 규칙). */
    const todayKST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    const daysBetween = (from, to) => {
        const p = (v) => { const [y, m, d] = String(v).split('-').map(Number); return Date.UTC(y, m - 1, d); };
        return Math.round((p(to) - p(from)) / 86400000);
    };

    const list = () => Promise.all(ISSUES.map(async (i) => {
        try {
            const d = await get(i.slug);
            const last = d?.stats?.lastDate || null;
            return {
                ...i,
                total: d?.stats?.total || 0,
                pending: d?.stats?.pending || 0,
                analyzed: d?.stats?.analyzed || 0,
                lawCount: d?.stats?.lawCount || 0,
                lastDate: last,
                daysAgo: last ? daysBetween(last, todayKST()) : null,
            };
        } catch {
            return { ...i, total: null, pending: 0, analyzed: 0, lawCount: 0, lastDate: null, daysAgo: null };
        }
    }));

    /* ─────────────────────────────────────────────────────────────
       쟁점 후보 발굴 (관리자 전용 · /admin/issue-candidates)
       ─────────────────────────────────────────────────────────────
       🔴 자동 선정은 안 된다는 게 결론이다 (utils/issues.js 기준 주석).
          그래서 이건 **후보를 자동으로 뽑는 도구가 아니라, 사람이 고를 때 쓰는 재료**다.
          최종 판단과 이름 짓기는 사람이 하고 그 이유를 `why` 에 쓴다. */

    /* 키워드 세트가 선정 기준을 통과하는지 판정. 화면의 검사기가 쓴다.
       ⚠️ ⑤ 제목(법률명·제도명으로 쓸 수 있나)은 **사람만 판단할 수 있어** 자동 판정에서 뺐다.
          화면이 그 항목을 "직접 확인" 으로 표시한다 — 통과했다고 표시하면 거짓이 된다. */
    const MIN_BILLS = 10;
    const MIN_PARTIES = 2;
    const RECENT_MONTHS = 12;
    async function checkKeywords(rawKeywords) {
        const asked = (rawKeywords || []).map((k) => String(k).trim()).filter(Boolean);
        const tooShort = asked.filter((k) => [...k].length < 3);
        const used = asked.filter((k) => [...k].length >= 3);
        if (!used.length) {
            return { asked, used, tooShort, error: '3글자 이상 키워드가 하나도 없습니다.' };
        }

        const bills = await dao.getBills(used);
        const parties = new Set(bills.map((b) => b.party_name || '(명부 없음)'));
        const dates = bills.map((b) => b.propose_dt).filter(Boolean).sort();
        const pending = bills.filter((b) => !b.proc_result_name);

        // 최근 12개월 기준일 — DB 가 KST 라 오늘도 KST 다. 문자열 비교로 충분 (YYYY-MM-DD)
        const now = new Date();
        const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - RECENT_MONTHS, now.getUTCDate()))
            .toISOString().slice(0, 10);
        const last = dates.at(-1) || '';

        // 이미 있는 쟁점과 겹치는지 — 같은 주제를 두 번 만들지 않게
        const overlaps = [];
        for (const iss of ISSUES) {
            const mine = new Set(bills.map((b) => b.bill_id));
            const theirs = await dao.getBills(iss.keywords);
            const n = theirs.filter((b) => mine.has(b.bill_id)).length;
            if (n > 0) overlaps.push({ slug: iss.slug, title: iss.title, n, pct: Math.round(n / bills.length * 100) });
        }

        const groups = groupByLaw(bills);
        return {
            asked, used, tooShort,
            total: bills.length,
            parties: [...parties],
            pending: pending.length,
            firstDate: dates[0] || null,
            lastDate: last || null,
            checks: [
                { id: 1, label: `관련 법안 ${MIN_BILLS}건 이상`, ok: bills.length >= MIN_BILLS, got: `${bills.length}건` },
                { id: 2, label: `정당 ${MIN_PARTIES}곳 이상 발의`, ok: parties.size >= MIN_PARTIES, got: `${parties.size}곳` },
                { id: 3, label: `최근 ${RECENT_MONTHS}개월 안 발의 있음`, ok: !!last && last >= cutoff, got: last || '없음' },
                { id: 4, label: '계류가 남아 있음', ok: pending.length > 0, got: `${pending.length}건` },
                { id: 6, label: '키워드 3글자 이상', ok: tooShort.length === 0, got: tooShort.length ? `${tooShort.join(', ')} 탈락` : '전부 통과' },
            ],
            overlaps,
            topLaws: groups.groups.slice(0, 8).map((g) => ({ law: g.law, n: g.bills.length })),
            sample: bills.slice(0, 8),
        };
    }

    /* 후보 재료 묶음 — 신호 2종 + 현재 쟁점 커버리지 */
    async function getCandidates() {
        const [opposed, themes, current] = await Promise.all([
            dao.getOpposedBills(20).catch((e) => { logger.error(`getOpposedBills 실패 — ${e.message}`); return []; }),
            dao.getRepeatedThemes(2).catch((e) => { logger.error(`getRepeatedThemes 실패 — ${e.message}`); return []; }),
            list(),
        ]);

        // 반대표 신호 중 **이미 어느 쟁점에도 안 잡히는 것**만 남긴다 (이미 다루는 걸 또 띄우면 노이즈)
        const coveredIds = new Set();
        for (const iss of ISSUES) {
            try {
                (await dao.getBills(iss.keywords)).forEach((b) => coveredIds.add(b.bill_id));
            } catch { /* 한 쟁점이 죽어도 후보 목록은 뜬다 */ }
        }
        return {
            opposed: opposed.map((b) => ({ ...b, covered: coveredIds.has(b.bill_id) })),
            themes,
            current,
        };
    }

    return { get, list, getBillsPage, getIssuesForDate, getCandidates, checkKeywords };
};
