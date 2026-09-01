// syncSpeeches.js — 의원 발언 기록 동기화 (politician_speeches)
//
// 소스: 열린국회정보 `npeslxqbanwkimebr` (국회의원 영상회의록 / 발언영상)
//
// 왜 이 데이터인가:
//   기존 평가 축(발의·표결·가결률)이 전부 **본회의·법안 기준**이라 상임위가 안 보였다.
//   이 데이터는 회의의 **73%가 위원회·국감**이라 그 구멍을 메운다.
//   (공공 API 전수 조사 결과 출석 API 는 존재하지 않는다. 발언은 출석보다 나은 지표이기도 하다 —
//    출석은 존재고 발언은 참여다.)
//
// ⚠️ **"이 날짜 이후" 인자가 없다.** 필수 인자가 `CT1`(대수) + `TAKING_DATE`(연도 접두) 뿐이라
//    증분 조회 자체가 불가능하다. 연도 전체를 다시 받아 UPSERT 하는 수밖에 없다.
//    (clip_id, mona_cd) UNIQUE 라 멱등하다. 올해분만 받으면 10페이지·수 초.
//
// 실행 순서: syncPoliticians · syncCommittees **다음**.
//   이 배치는 이름 문자열만 받아서 politicians 로 이름 매칭을 하고,
//   동명이인은 politician_committees 로 가른다. 둘 다 최신이어야 귀속이 정확하다.
//
// 인자:
//   (없음)        올해분만 (크론용)
//   --full        제22대 시작연도(2024)부터 전부 — 분류 로직이 바뀌었을 때 소급 적용용
//   --year 2025   특정 연도만
//   --dry-run     DB 를 쓰지 않고 파싱률·분류 분포만 출력

import pg from 'pg';
import axios from 'axios';
import dbConfig from '../config/database.js';
import logger from '../utils/logger.js';
import { startBatchRun, finishBatchRun } from '../utils/batchRun.js';
import { startWatchdog } from '../utils/watchdog.js';

const OP = 'npeslxqbanwkimebr';
const PAGE = 1000;
const FIRST_YEAR = 2024;          // 제22대 개원
const DRY = process.argv.includes('--dry-run');
const FULL = process.argv.includes('--full');

/* 🔴 파싱률 안전장치.
   ESSENTIAL_PERSON 은 자유 텍스트라 원천의 표기가 바뀌면 파서가 조용히 무너진다.
   실측 98.6% 이므로 90% 미만이면 "원천이 조금 달라진 것" 이 아니라 사고로 본다. */
const MIN_PARSE_RATE = 0.90;

/* ─────────────────────────────────────────────────────────────
   파서 — 여기가 이 배치의 전부다. 함부로 손대지 말 것.

   `ESSENTIAL_PERSON` 은 `"이름 직위(소속)  행위"` 를 ` / ` 로 이은 자유 텍스트다.
     "서영교 위원장(더불어민주당)  질의 / 정성호 장관(법무부)  답변"
     "조정식 국회의장  발언, 산회"                 ← 괄호 없음 (의장은 당적 이탈이라 소속이 없다)
     "김이탁 제1차관(국토교통부)  답변"            ← 직위에 숫자
     "김태규 위원장 직무대행(방송통신위원회)  답변" ← 직위가 두 어절

   🔴 정규식 한 방으로 뽑지 말 것 (2026-09-01 재작성).
      구 `SEG_RE` 는 직위를 한 어절(`{2,12}`)로 봐서 **직위가 두 어절이면 소속을 통째로 놓쳤다.**
      `"김태규 위원장 직무대행(방송통신위원회)  답변"` 이 `직위=위원장 · 소속=없음 · 행위=직무대행`
      으로 파싱돼 ① 소속이 사라지고 ② 진짜 행위(답변)까지 잃었다. 실측 544건.
      소속이 사라지면 아래 `classifyRole` 이 정부 위원회 위원장을 국회 상임위원장으로 본다.

   → **괄호가 경계다.** 실측 전건(133,891 세그먼트)이 이 구조를 지킨다:
        [괄호 앞] 이름 + 직위(1~5어절)   [괄호 안] 소속   [괄호 뒤] 행위(쉼표로 여러 개)
      괄호가 없으면(6.4%) 두 칸 이상의 공백이 직위와 행위를 가른다.
   ───────────────────────────────────────────────────────────── */

const NAME_RE = /^[가-힣]{2,4}$/;

/** "이름 직위(소속)  행위" → { name, role, org, act } · 못 읽으면 null */
export const parseSegment = (seg) => {
    const s = String(seg || '').trim();
    if (!s) return null;

    // 소속 괄호는 **마지막** 것으로 본다 — "(전)정보통신기획평가원 …" 처럼 앞에 붙는 괄호가 있다
    const open = s.lastIndexOf('(');
    const close = open > -1 ? s.indexOf(')', open) : -1;

    let head, org = null, act = null;
    if (close > -1) {
        head = s.slice(0, open).trim();
        org = s.slice(open + 1, close).trim() || null;
        act = s.slice(close + 1).trim() || null;
    } else {
        // 괄호 없음 — 두 칸 이상 공백이 직위와 행위를 가른다
        const m = s.split(/\s{2,}/);
        head = m[0].trim();
        act = m.length > 1 ? m.slice(1).join(' ').trim() || null : null;
    }

    const words = head.split(/\s+/).filter(Boolean);
    const name = words.shift();
    if (!name || !NAME_RE.test(name) || words.length === 0) return null;

    return { name, role: words.join(' '), org, act };
};

/* 직위 분류.
   🔴 **직위만 보면 안 된다 — 소속을 같이 봐야 한다** (2026-09-01).
      구버전 주석은 "CHAIR·MEMBER 는 국회의원만 가질 수 있는 직위라 이름 매칭이 안전하다" 고
      단정했는데 **틀렸다.** 정부·독립기관에도 `위원장`·`위원` 이 있다:
        방송통신위원회 288 · 금융위원회 570 · 공정거래위원회 340 · 국가인권위원회 178 …
      그래서 방통위원장 이진숙(192건)·방통위 직무대행 김태규(227건)의 **정부측 답변이
      국회 상임위원장 사회 발언으로 집계**됐다. 두 사람 모두 나중에 의원이 되어 이름이 매칭됐다.
      집계 대상(chair·member)이라 상임위 참여율의 분모·분자까지 오염됐다.

   → 국회 직위(CHAIR·MEMBER)는 **소속이 정당일 때만** 인정한다.
     소속이 없으면(괄호 없음) 그대로 인정한다 — 국회의장·부의장은 당적을 이탈해 소속 표기가 없다. */
const CHAIR = new Set(['위원장', '위원장대리', '소위원장', '국회의장', '의장', '국회부의장', '부의장']);
const MEMBER = new Set([
    '위원', '간사', '의원', '정책위원', '감사반장', '감사반장대리',
    '원내대표',   // 교섭단체 대표 — 국회의원만 가능한 자리라 위 두 집합과 같은 성격이다
]);

/* 정당 화이트리스트.
   ⚠️ `parties` 테이블은 **현재 정당만** 담는다 (실측 8개). 22대 임기 중 사라진 정당이 빠져 있어
      그것만 쓰면 그 소속 의원이 통째로 외부인으로 밀린다 — 그래서 아래 상수와 합집합을 쓴다.
   ⚠️ 그래도 못 채운 정당이 생길 수 있으므로, 배치가 **"정당이 아니라고 판정한 소속"을 로그로
      찍는다** (`[소속미상]`). 새 정당이 누락되면 거기 이름이 뜬다. 조용히 틀리지 않게 하는 장치다. */
const PARTY_FALLBACK = [
    '더불어민주당', '국민의힘', '조국혁신당', '개혁신당', '진보당', '기본소득당', '사회민주당', '무소속',
    // 22대 임기 중 존재했거나 총선 비례연합으로 쓰인 이름들 (parties 에 없다)
    '새로운미래', '국민의미래', '더불어민주연합', '자유통일당', '녹색정의당', '정의당', '시대전환', '한국의희망',
];
let PARTY_SET = new Set(PARTY_FALLBACK);
/** parties 테이블 값을 상수에 **더한다** (덮어쓰지 않는다). syncSpeeches 기동 시 1회. */
export const setPartyNames = (names = []) => {
    PARTY_SET = new Set([...PARTY_FALLBACK, ...names.filter(Boolean).map((s) => String(s).trim())]);
};
export const isParty = (org) => PARTY_SET.has(String(org || '').trim());

/* ⛔ 구 `gov` 를 셋으로 가른다 (2026-08-15).
   구버전은 CHAIR·MEMBER 가 아니면 전부 `gov` 로 몰았는데, 화면에 `국무위원석 답변` 이라
   라벨을 붙였더니 **참고인 1건짜리 의원이 장관처럼 표시됐다.**

   원인은 라벨이 아니라 **귀속**이다. 이 API 는 mona_cd 를 주지 않아 이름으로만 매칭하는데,
   외부 직위는 현역 의원과 이름이 겹친다 (실측: 도지사 김영환 87건 · 회장 김병주 21건 ·
   변호사 김종민 15건 · 교수 박은정 7건 — 전부 동명의 **다른 사람**이다).

   → 세 갈래로 나눠 저장하되 **화면에는 셋 다 쓰지 않는다.** 분류는 "이 행이 왜 의정활동이
     아닌지" 를 기록으로 남기기 위한 것이다. 집계는 member·chair 만 한다. */
const WITNESS_RE = /(참고인|증인|진술인|신청인)$/;
const GOVT_RE = /(장관|차관|총리|청장|처장|실장|국장|과장|본부장|위원장후보|후보자|대사|검찰총장|감사원장|기획관|감사관|부장)$/;

/** 직위 + 소속 → role_kind.
 *  @param role 원문 직위 (여러 어절 가능: `위원장 직무대행`)
 *  @param org  괄호 안 소속 (없으면 null)
 *  ⚠️ 판정은 **직위의 첫 어절**로 한다. `위원장 직무대행`·`위원장 대리` 는 국회에도 정부에도 있어
 *     첫 어절만으로는 못 가른다 — 그래서 소속이 필요하다. */
export const classifyRole = (role, org = null) => {
    const head = String(role || '').split(/\s+/)[0];
    const isChair = CHAIR.has(role) || CHAIR.has(head);
    const isMember = MEMBER.has(role) || MEMBER.has(head);

    if (isChair || isMember) {
        // 🔴 소속이 있는데 정당이 아니면 국회의원이 아니다 (방통위원장·금융위원장·선관위원 …)
        if (org && !isParty(org)) return 'government';
        return isChair ? 'chair' : 'member';
    }
    if (WITNESS_RE.test(head) || WITNESS_RE.test(role)) return 'witness';
    if (GOVT_RE.test(head) || GOVT_RE.test(role)) return 'government';
    return 'other';
};

/* 회의 종류 — TITLE 에서 뽑는다.
   ⚠️ **순서가 곧 우선순위다.** `…국정조사특별위원회` 는 국정조사이면서 위원회이고,
      `…교육위원회 의학교육소위원회` 는 소위원회이면서 위원회다. 좁은 것부터 본다. */
export const classifyMeeting = (title = '') => {
    if (/본회의/.test(title)) return '본회의';
    if (/국정감사/.test(title)) return '국정감사';
    if (/국정조사/.test(title)) return '국정조사';
    if (/인사청문/.test(title)) return '인사청문회';
    if (/공청회/.test(title)) return '공청회';
    if (/청문회/.test(title)) return '청문회';
    if (/소위원회/.test(title)) return '소위원회';
    if (/위원회/.test(title)) return '위원회';
    return '기타';
};

// 클립 고유 id. 같은 클립이 여러 행으로 중복돼 오므로(실측 9.7%) 이걸로 접는다.
const clipIdOf = (url = '') => (String(url).match(/[?&]no=(\d+)/) || [])[1] || null;

// "HH:MM:SS" → 초. ⚠️ 이 값은 **개인 발언시간이 아니다** (한 클립에 질의+답변이 함께 녹화된다).
const secOf = (t) => {
    const m = String(t || '').match(/^(\d+):(\d+):(\d+)$/);
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
};

/* 행위는 **첫 번째 것만** 쓴다 — `"발언, 산회"` 의 산회·정회·상정은 진행 절차지 발언이 아니다.
   ⚠️ 컬럼이 VARCHAR(20) 이라 자른다. `"개의, 발언, 의사일정 제1항 상정"` 같은 긴 값이 온다. */
const firstAct = (act) => {
    const v = act ? String(act).split(/[,·]/)[0].trim() : '';
    return v ? v.slice(0, 20) : null;
};

async function fetchYear(key, age, year) {
    const rows = [];
    for (let pIndex = 1; ; pIndex++) {
        const { data } = await axios.get(`https://open.assembly.go.kr/portal/openapi/${OP}`, {
            params: { KEY: key, Type: 'json', pIndex, pSize: PAGE, CT1: String(age), TAKING_DATE: String(year) },
            timeout: 30000,
        });

        const body = data?.[OP];
        if (!body) {
            // 결과 없음은 에러가 아니다 (RESULT 만 담은 다른 모양으로 온다)
            const code = data?.RESULT?.CODE;
            if (code && code !== 'INFO-000' && code !== 'INFO-200') {
                throw new Error(`API 오류(${year}): ${code} ${data.RESULT.MESSAGE}`);
            }
            break;
        }

        const total = body[0]?.head?.[0]?.list_total_count ?? 0;
        const page = body[1]?.row || [];
        rows.push(...page);
        if (rows.length >= total || page.length === 0) break;
    }
    return rows;
}

/* 이름 → mona_cd. 동명이인은 회의 제목의 위원회명으로 가른다.
   ⚠️ politicians 동명이인은 실측 **박지원 1쌍뿐**이고 **둘 다 더불어민주당**이라 정당으로는
      못 가른다. 위원회는 완전히 갈린다 (법사위·정보위 vs 보건복지위·예결위).
   ⚠️ 못 가리면 **버린다.** 틀린 귀속보다 없는 편이 낫다. */
function makeResolver(politicianRows, committeeRows) {
    const byName = new Map();
    for (const r of politicianRows) {
        if (!byName.has(r.name)) byName.set(r.name, []);
        byName.get(r.name).push(r.mona_cd);
    }
    const cmts = new Map();
    for (const r of committeeRows) {
        if (!cmts.has(r.mona_cd)) cmts.set(r.mona_cd, []);
        cmts.get(r.mona_cd).push(r.dept_nm);
    }

    const stat = { homonym: 0, homonymResolved: 0, unknown: 0 };
    const resolve = (name, title) => {
        const cands = byName.get(name);
        if (!cands) { stat.unknown++; return null; }          // 외부인 — 정상적인 미매칭
        if (cands.length === 1) return cands[0];

        stat.homonym++;
        const hit = cands.filter((cd) => (cmts.get(cd) || []).some((d) => title?.includes(d)));
        if (hit.length !== 1) return null;
        stat.homonymResolved++;
        return hit[0];
    };
    return { resolve, stat };
}

function parseAll(apiRows, resolver) {
    // 같은 클립이 여러 행으로 온다 → 먼저 접는다
    const clips = new Map();
    for (const r of apiRows) {
        const cid = clipIdOf(r.LINK_URL);
        if (cid && !clips.has(cid)) clips.set(cid, r);
    }

    const stat = {
        apiRows: apiRows.length, clips: clips.size, segTotal: 0, segParsed: 0,
        failSamples: [], demoted: 0, nonPartyOrg: {},
    };
    const byKind = {};
    const out = [];
    const seen = new Set();

    for (const [clipId, r] of clips) {
        const meetingKind = classifyMeeting(r.TITLE);
        const recSec = secOf(r.REC_TIME);
        const segs = String(r.ESSENTIAL_PERSON || '').split('/').map((s) => s.trim()).filter(Boolean);

        for (const seg of segs) {
            stat.segTotal++;
            const p = parseSegment(seg);
            if (!p) {
                // 실측 실패분은 전부 외부인이다 ("실무자  답변" 처럼 이름이 없는 것)
                if (stat.failSamples.length < 10) stat.failSamples.push(seg);
                continue;
            }
            stat.segParsed++;

            const { name, role, org, act } = p;
            const roleKind = classifyRole(role, org);
            byKind[roleKind] = (byKind[roleKind] || 0) + 1;

            /* 🔴 국회 직위인데 소속이 정당이 아니라 강등된 건을 센다.
               정당 목록에 빠진 정당이 있으면 여기에 그 이름이 뜬다 (조용히 틀리지 않게 하는 장치). */
            if (roleKind === 'government' && org && (CHAIR.has(role.split(/\s+/)[0]) || MEMBER.has(role.split(/\s+/)[0]))) {
                stat.demoted++;
                stat.nonPartyOrg[org] = (stat.nonPartyOrg[org] || 0) + 1;
            }

            const monaCd = resolver.resolve(name, r.TITLE);
            if (!monaCd) continue;

            // (clip_id, mona_cd) UNIQUE — 같은 문 안에서 두 번 걸리면 ON CONFLICT 가 실패한다
            const k = `${clipId}|${monaCd}`;
            if (seen.has(k)) continue;
            seen.add(k);

            out.push([clipId, monaCd, role.slice(0, 40), roleKind, firstAct(act), r.TAKING_DATE,
                meetingKind, r.TITLE || null, recSec, r.LINK_URL || null, org ? org.slice(0, 60) : null]);
        }
    }
    return { rows: out, stat, byKind };
}

const COLS = 11;
const CHUNK = 2000;   // 2000 × 11 = 22,000 파라미터 (PG 상한 65,535)

async function upsert(pool, rows) {
    let written = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const values = chunk.map((_, j) => {
            const b = j * COLS;
            return `(${Array.from({ length: COLS }, (_, k) => `$${b + k + 1}`).join(',')})`;
        }).join(',');

        const { rowCount } = await pool.query(`
            INSERT INTO politician_speeches
                (clip_id, mona_cd, role, role_kind, act, taking_date, meeting_kind, conf_title, rec_sec, link_url, org)
            VALUES ${values}
            ON CONFLICT (clip_id, mona_cd) DO UPDATE SET
                role         = EXCLUDED.role,
                role_kind    = EXCLUDED.role_kind,
                act          = EXCLUDED.act,
                taking_date  = EXCLUDED.taking_date,
                meeting_kind = EXCLUDED.meeting_kind,
                conf_title   = EXCLUDED.conf_title,
                rec_sec      = EXCLUDED.rec_sec,
                link_url     = EXCLUDED.link_url,
                org          = EXCLUDED.org`, chunk.flat());
        written += rowCount;
    }
    return written;
}

async function run() {
    const yearArgIdx = process.argv.indexOf('--year');
    const thisYear = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()));
    const years = yearArgIdx > -1 && process.argv[yearArgIdx + 1]
        ? [Number(process.argv[yearArgIdx + 1])]
        : FULL
            ? Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i)
            : [thisYear];

    logger.info(`[Speeches START] ${years.join(', ')}년${FULL ? ' (--full)' : ''}${DRY ? ' (dry-run)' : ''}`);
    const stopWatchdog = startWatchdog('syncSpeeches', 20);
    const pool = new pg.Pool(dbConfig);
    const runId = DRY ? null : await startBatchRun(pool, 'syncSpeeches');
    const startTime = Date.now();

    try {
        const key = process.env.OPEN_ASSEMBLY_API_KEY;
        if (!key) throw new Error('OPEN_ASSEMBLY_API_KEY 환경변수가 없습니다.');
        const age = process.env.ASSEMBLY_AGE || '22';

        const [{ rows: pols }, { rows: cmts }, { rows: partyRows }] = await Promise.all([
            pool.query('SELECT mona_cd, name FROM politicians'),
            pool.query('SELECT mona_cd, dept_nm FROM politician_committees'),
            pool.query('SELECT party_name FROM parties'),
        ]);
        if (pols.length === 0) throw new Error('politicians 가 비어 있습니다 — syncPoliticians 를 먼저 실행하세요.');
        if (cmts.length === 0) logger.warn('  ⚠ politician_committees 가 비어 있습니다 — 동명이인을 가를 수 없어 그 행들이 버려집니다');

        // 소속이 정당인지 판정할 목록. 조회가 비어도 상수 폴백이 있어 배치는 산다
        setPartyNames(partyRows.map((r) => r.party_name));

        const apiRows = [];
        for (const y of years) {
            const r = await fetchYear(key, age, y);
            logger.info(`  [조회] ${y}년 ${r.length}행`);
            apiRows.push(...r);
        }
        if (apiRows.length === 0) throw new Error('조회 결과가 0행입니다 — API 인자(CT1·TAKING_DATE)를 확인하세요.');

        const resolver = makeResolver(pols, cmts);
        const { rows, stat, byKind } = parseAll(apiRows, resolver);

        // ── 검증 리포트 (저장 전에 반드시 눈으로 확인할 수 있게) ──
        const parseRate = stat.segParsed / stat.segTotal;
        logger.info(`  [클립] ${stat.apiRows}행 → ${stat.clips}개 (중복 ${(100 - stat.clips / stat.apiRows * 100).toFixed(1)}%)`);
        logger.info(`  [파싱] ${(parseRate * 100).toFixed(1)}% (${stat.segParsed}/${stat.segTotal})`);
        if (stat.failSamples.length) logger.info(`         실패 예: ${stat.failSamples.slice(0, 3).map((s) => JSON.stringify(s)).join(' ')}`);
        logger.info(`  [분류] ${Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);

        /* 🔴 국회 직위인데 소속이 정당이 아니라 government 로 내린 건.
           여기 뜬 이름이 **실제 정당**이면 PARTY_FALLBACK 에 빠진 것이다 — 반드시 확인할 것. */
        if (stat.demoted) {
            const top = Object.entries(stat.nonPartyOrg).sort((a, b) => b[1] - a[1]).slice(0, 12);
            logger.info(`  [소속미상] 국회 직위이나 소속이 정당이 아니어서 제외 ${stat.demoted}건`
                + ` — ${top.map(([o, n]) => `${o} ${n}`).join(' · ')}`);
        }
        logger.info(`  [귀속] 동명이인 ${resolver.stat.homonym}건 중 ${resolver.stat.homonymResolved}건 해소`
            + ` (${resolver.stat.homonym - resolver.stat.homonymResolved}건 폐기) · 의원 아님 ${resolver.stat.unknown}건`);

        const saveKind = rows.reduce((a, r) => { a[r[3]] = (a[r[3]] || 0) + 1; return a; }, {});
        logger.info(`  [저장대상] ${rows.length}행 / 의원 ${new Set(rows.map((r) => r[1])).size}명`
            + ` — ${Object.entries(saveKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);

        if (parseRate < MIN_PARSE_RATE) {
            throw new Error(`파싱률 ${(parseRate * 100).toFixed(1)}% — 최소 기대치(${MIN_PARSE_RATE * 100}%) 미만이라 저장을 중단합니다. `
                + 'ESSENTIAL_PERSON 표기가 바뀌었을 수 있습니다 (SEG_RE 확인).');
        }

        if (DRY) {
            logger.info('[dry-run] DB 를 쓰지 않고 종료합니다.');
            await finishBatchRun(pool, runId, { status: 'success', stats: { dryRun: true, rows: rows.length } });
            return;
        }

        const written = await upsert(pool, rows);

        // politicians 에 없는 mona_cd 는 화면에서 조인이 안 된다 (FK 는 일부러 안 걸었다)
        const { rows: [orphan] } = await pool.query(`
            SELECT COUNT(*)::int AS n FROM politician_speeches s
             WHERE NOT EXISTS (SELECT 1 FROM politicians p WHERE p.mona_cd = s.mona_cd)`);
        if (orphan.n > 0) logger.warn(`  ⚠ politicians 에 없는 의원 ${orphan.n}행 — syncPoliticians 를 먼저 돌렸는지 확인`);

        // 구 'gov' 잔여 확인 — --full 을 한 번도 안 돌리면 옛 분류가 남는다
        const { rows: [legacy] } = await pool.query(
            `SELECT COUNT(*)::int AS n FROM politician_speeches WHERE role_kind = 'gov'`);
        if (legacy.n > 0) {
            logger.warn(`  ⚠ 옛 분류 role_kind='gov' 가 ${legacy.n}행 남아 있습니다 — `
                + `\`node batch/syncSpeeches.js --full\` 로 소급 적용하세요`);
        }

        const { rows: [tot] } = await pool.query(`
            SELECT COUNT(*)::int AS n, COUNT(DISTINCT mona_cd)::int AS m
                 , TO_CHAR(MIN(taking_date), 'YYYY-MM-DD') AS mn
                 , TO_CHAR(MAX(taking_date), 'YYYY-MM-DD') AS mx
              FROM politician_speeches`);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`[Speeches SUCCESS] ${written}행 반영 · 누적 ${tot.n}행 / 의원 ${tot.m}명 / ${tot.mn}~${tot.mx} (${duration}초)`);
        await finishBatchRun(pool, runId, {
            status: 'success',
            stats: {
                years, apiRows: stat.apiRows, clips: stat.clips,
                parseRate: Number(parseRate.toFixed(4)), written,
                ...saveKind, orphan: orphan.n, legacyGov: legacy.n,
                total: tot.n, politicians: tot.m, lastDate: tot.mx,
            },
        });
    } catch (error) {
        logger.error('[Speeches FAILED]:', error.message);
        await finishBatchRun(pool, runId, { status: 'failed', error: error.message });
        process.exitCode = 1;
    } finally {
        await pool.end();
        stopWatchdog();
        logger.info('[Speeches END]');
    }
}

run();
