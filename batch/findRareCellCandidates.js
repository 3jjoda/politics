// findRareCellCandidates.js — 희소 셀(social 전통 −1 · institution 안정 −1) 사람 검토 후보 뽑기 (AI 호출 0)
//
//   왜: v2 매핑은 축 안에서 두 방향을 같은 수로 맞추므로 **희소 방향이 축의 크기를 정한다**
//       (2026-08-16 재분류 후 전통 247 · 안정 187 → 사회 494 · 제도 374 건). 분할-반 신뢰도(사회 0.63 · 제도 0.60)를
//       올리는 길은 이 두 셀을 채우는 것뿐인데, AI 는 이미 한 번 봤으므로 남은 건 사람이 보는 것이다.
//
//   무엇을 하나: 파일럿 테이블(bill_axis_mapping_pilot)에서 아래 세 부류를 키워드로 긁어 주제별로 묶는다
//     A. 지금 none 인데 희소 셀 키워드가 걸리는 법안        (AI 가 보수적으로 버린 것)
//     B. 반대 방향(자율 +1 / 개혁 +1)으로 분류됐는데 희소 셀 키워드가 걸리는 법안 (AI 오류 후보)
//     C. 희소 셀인데 low confidence 라 선별에서 빠진 법안   (사람이 high 로 올리면 바로 들어간다)
//     D. 파일럿에 아예 없는 법안 (138건) 중 키워드 매칭
//
//   산출: out/rare-cell-candidates.md — 주제별 표 (bill_id · 법안명 · 현재 분류 · AI 메모 · 원문 앞부분) + 적용용 SQL 템플릿
//   사용: node batch/findRareCellCandidates.js
//   🔴 이 스크립트는 **후보**를 뽑을 뿐 아무것도 바꾸지 않는다. 판정은 사람이 하고, 아래 SQL 템플릿으로 pilot 테이블을 고친 뒤
//      `node batch/mapBillAxisPilot.js --select-only --target 100000 --sync-v2` → `node batch/calcPoliticianAxis.js` 순으로 반영한다
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import cfg from '../config/database.js';

const pool = new pg.Pool(cfg);

// 주제 → 키워드 (법안명·원문 앞 600자·AI 메모에서 찾는다). 각 주제는 하나의 희소 셀에 속한다.
// ⚠️ 키워드는 후보를 넓게 잡는 그물이다 — 걸렸다고 그 셀인 게 아니다 (예: '집회' 는 완화 법안도 걸린다). 사람이 방향을 본다
const THEMES = [
  // 🔴 주제어만으로는 수천 건이 걸린다 (첫 실행 2,943건). 주제어 + **방향 동사** 를 같이 요구해 사람이 볼 수 있는 양으로 조인다
  // ── social 전통 (−1) ──
  { cell: 'social', dir: -1, name: '집회·시위 제한',        re: /(집회|시위|옥외집회).{0,30}(제한|금지|규제|처벌|불허|강화)/ },
  { cell: 'social', dir: -1, name: '표현·정보 규제',        re: /(허위(사실|정보|조작)|가짜뉴스|명예훼손|모욕죄?|혐오 ?표현|불법정보|국가 ?상징|국기 ?모독|욱일기|역사 ?왜곡).{0,40}(처벌|규제|금지|삭제|차단|강화|신설|과태료)/ },
  { cell: 'social', dir: -1, name: '이민·외국인 제한',      re: /(외국인|이민|이주 ?노동|난민|불법 ?체류|귀화|영주).{0,40}(제한|강화|퇴거|단속|요건|상호주의|금지|취소|배제)/ },
  { cell: 'social', dir: -1, name: '청소년 보호 규제',      re: /(청소년|미성년자?).{0,20}(이용 ?(시간 )?제한|접근 ?(제한|차단)|출입 ?(금지|제한)|시청 ?제한|셧다운)|16세 미만|(SNS|소셜 ?미디어|온라인 ?플랫폼).{0,20}(제한|규제|금지)/ },
  { cell: 'social', dir: -1, name: '가족·성 역할',          re: /낙태|임신 ?중절|동성 ?(결혼|혼|커플)|생활 ?동반자|혼인 ?제도|비혼|호주제|성별 ?정정|성전환|가족 ?해체|전통 ?가족|건전 ?가정/ },
  { cell: 'social', dir: -1, name: '형벌 우선(가치 쟁점)',   re: /사형|촉법 ?소년|소년범|형사 ?미성년|비범죄화|가석방 ?(제한|불허|금지)|(마약|대마).{0,20}(합법|허용|비범죄|의료용)/ },
  { cell: 'social', dir: -1, name: '종교·이념·교육 통제',   re: /(교과서|역사 ?교육|이념|정치 ?편향|종교).{0,30}(금지|제한|규제|검정|국정|중립 ?의무)|반국가|이적 ?단체|국가보안법/ },
  // ── institution 안정 (−1) ──
  { cell: 'institution', dir: -1, name: '검찰 권한 유지·확대',    re: /(검사|검찰).{0,25}(수사권|직접 ?수사|보완 ?수사|수사 ?범위|수사 ?개시).{0,25}(유지|확대|회복|복원|강화|부여|보장)|검찰청 ?폐지.{0,10}(반대|철회)/ },
  { cell: 'institution', dir: -1, name: '공수처·특검 축소',       re: /(공수처|고위공직자범죄수사처).{0,30}(폐지|축소|제한|해체|권한 ?제한|위법|불법|진상 ?조사)|특(별)?검(사)?.{0,20}(폐지|제한|남용|반대)/ },
  { cell: 'institution', dir: -1, name: '사법부·헌재 독립 강화',   re: /(대법관|대법원장|헌법 ?재판관|법관|사법부|헌법재판소|법원).{0,30}(독립|중립|정치적 ?영향|외부 ?영향|자격 ?(요건|제한)|임기 ?보장|신분 ?보장)/ },
  { cell: 'institution', dir: -1, name: '선관위 자율·독립',       re: /(선거관리위원회|선관위).{0,30}(독립|중립|자율|상임|권한 ?강화|신분 ?보장)/ },
  { cell: 'institution', dir: -1, name: '대통령·행정부 권한',     re: /(대통령|행정부|국무총리|정부).{0,25}(권한 ?(강화|확대|보장)|거부권|사면권|긴급 ?(명령|재정)|권한대행)|계엄.{0,20}(요건|절차|해제)/ },
  { cell: 'institution', dir: -1, name: '국회 견제 축소·탄핵 요건', re: /(탄핵|국정조사|국정감사|국회 ?(감시|통제|동의|출석)|인사청문|자료 ?제출).{0,30}(요건 ?강화|제한|축소|남용 ?방지|금지|정족수|기간 ?제한)/ },
  { cell: 'institution', dir: -1, name: '정보 비공개·기밀',       re: /(비공개|기밀|보안 ?등급|열람 ?제한|공개 ?(제한|예외|배제|금지)|비밀 ?유지)/ },
];

const { rows } = await pool.query(`
  SELECT b.bill_id, b.bill_name, TO_CHAR(b.propose_dt,'YYYY-MM-DD') dt, b.committee, LEFT(b.summary, 600) sum600,
         p.axis, p.agree_score, p.confidence, p.reason, p.is_selected, p.prompt_version,
         (SELECT COUNT(*) FROM bill_co_proposers c WHERE c.bill_id=b.bill_id)::int n_co
    FROM bills b LEFT JOIN bill_axis_mapping_pilot p ON p.bill_id=b.bill_id
   WHERE b.summary IS NOT NULL
     AND (p.bill_id IS NULL                                        -- D. 파일럿에 없음
          OR p.axis = 'none'                                       -- A. none
          OR (p.axis IN ('social','institution') AND p.agree_score > 0)   -- B. 반대 방향
          OR (p.axis IN ('social','institution') AND p.agree_score < 0 AND p.confidence = 'low'))  -- C. low
`);

const strip = s => (s || '').replace(/^\s*(■\s*)?제안이유(\s*및\s*주요\s*내용)?\s*/, '').replace(/\s+/g, ' ');
const out = [];
const w = (s = '') => out.push(s);
w(`# 희소 셀 후보 — social 전통(−1) · institution 안정(−1) · 사람 검토용`);
w(`생성 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · 검사 대상 ${rows.length}건 (none/반대방향/low/미분류)`);
w('');
w('판정 규칙 (프롬프트와 같음): **전통** = 가족·성역할 보수 · 이민 제한 · 표현/집회 규제 · 청소년 보호 규제 · 가치 쟁점에서 형벌 우선 / ');
w('**안정** = 검찰 수사권 유지·확대 · 공수처 폐지 · 사법부·선관위 독립성 강화 · 국회 감시권 축소 · 정보 비공개 · 대통령 권한 강화(제한은 개혁).');
w('🔴 처벌 강화 일반·"질서 유지"·"헌정 수호" 는 여기 아니다 (none). 키워드에 걸렸다고 그 셀이 아니다 — 방향을 읽을 것.');
w('');
w('| 부류 | 뜻 |'); w('|---|---|');
w('| A none | AI 가 버렸다 — 대부분 진짜 none 이다. 셀에 맞는 것만 건진다 |');
w('| B 반대 | 자율/개혁으로 분류돼 있다 — 뒤집을 근거가 있으면 뒤집는다 (AI 오류) |');
w('| C low | 희소 셀인데 low — high/medium 으로 올리면 바로 선별된다 |');
w('| D 없음 | 파일럿에 없다 (공동발의 8명 미만·위원회 없음 등) |');
w('');

const summary = [];
const seen = new Set();
for (const t of THEMES) {
  const hits = [];
  for (const r of rows) {
    if (r.axis && r.axis !== 'none' && r.axis !== t.cell) continue;   // 다른 축으로 확정된 건 그 축 문제라 여기서 안 다룬다
    const text = `${r.bill_name} ${r.reason || ''} ${strip(r.sum600)}`;
    if (!t.re.test(text)) continue;
    hits.push(r);
  }
  const kind = r => !r.axis ? 'D 없음' : r.axis === 'none' ? 'A none' : r.agree_score > 0 ? 'B 반대' : 'C low';
  const cnt = { 'A none': 0, 'B 반대': 0, 'C low': 0, 'D 없음': 0 };
  hits.forEach(r => cnt[kind(r)]++);
  summary.push({ cell: t.cell, theme: t.name, total: hits.length, ...cnt });
  w(`## ${t.cell === 'social' ? '전통' : '안정'} · ${t.name} — ${hits.length}건 (A ${cnt['A none']} · B ${cnt['B 반대']} · C ${cnt['C low']} · D ${cnt['D 없음']})`);
  w('');
  if (!hits.length) { w('_없음_'); w(''); continue; }
  w('| 부류 | 발의일 | 서명 | 법안 | 현재 | AI 메모 | 원문 | bill_id |');
  w('|---|---|---|---|---|---|---|---|');
  hits.sort((a, b) => (kind(a) > kind(b) ? 1 : -1) || (b.dt || '').localeCompare(a.dt || ''));
  for (const r of hits) {
    const cur = !r.axis ? '—' : r.axis === 'none' ? 'none' : `${r.axis} ${r.agree_score > 0 ? '+1' : '−1'} ${r.confidence}`;
    w(`| ${kind(r)} | ${r.dt} | ${r.n_co} | ${r.bill_name.replace(/\|/g, '/')} | ${cur} | ${(r.reason || '').replace(/\|/g, '/')} | ${strip(r.sum600).slice(0, 140).replace(/\|/g, '/')} | ${r.bill_id} |`);
    seen.add(r.bill_id);
  }
  w('');
}

// ── E. 서명자 구성이 한쪽으로 쏠린 none / 반대방향 법안 (탐색 신호 — 라벨이 아니다) ──
//   키워드 그물로는 안정 셀이 안 나온다 (B 부류는 대부분 AI 가 맞았다). 22대에서 '기존 권력기관 권한 유지' 쪽 법안은
//   구조적으로 한 정당이 내므로, **서명자의 85% 이상이 한 정당**이고 관련 위원회인 none/반대방향 법안을 사람이 훑는다.
//   🔴 정당은 판정 근거가 아니다. 이 목록에 있다고 안정/전통이 아니고, 내용이 셀 정의에 맞아야만 넣는다.
//   (그래서 두 정당 모두 뽑는다 — 한쪽만 뽑으면 그 자체가 편집이 된다)
const { rows: skew } = await pool.query(`
  WITH sig AS (
    SELECT c.bill_id, COUNT(*)::int n, 
           MAX(pn.party) AS top_party, MAX(pn.share)::float8 AS top_share
      FROM bill_co_proposers c
      JOIN LATERAL (
        SELECT pl.party_name party, COUNT(*)::float8 / NULLIF((SELECT COUNT(*) FROM bill_co_proposers c2 JOIN politicians p2 ON p2.mona_cd=c2.mona_cd WHERE c2.bill_id=c.bill_id),0) share
          FROM bill_co_proposers c1 JOIN politicians pl ON pl.mona_cd=c1.mona_cd WHERE c1.bill_id=c.bill_id
         GROUP BY pl.party_name ORDER BY 2 DESC LIMIT 1) pn ON TRUE
     GROUP BY c.bill_id)
  SELECT b.bill_id, b.bill_name, TO_CHAR(b.propose_dt,'YYYY-MM-DD') dt, b.committee, LEFT(b.summary,600) sum600,
         p.axis, p.agree_score, p.confidence, p.reason, sig.n n_co, sig.top_party, ROUND((sig.top_share*100)::numeric) top_pct
    FROM bills b JOIN sig USING (bill_id) LEFT JOIN bill_axis_mapping_pilot p ON p.bill_id=b.bill_id
   WHERE b.summary IS NOT NULL AND sig.n >= 10 AND sig.top_share >= 0.85
     AND (p.bill_id IS NULL OR p.axis='none')
     AND (
       (b.committee IN ('법제사법위원회','행정안전위원회','국회운영위원회')
        AND (b.bill_name || ' ' || COALESCE(b.summary,'')) ~ '(검찰|검사의|공수처|특별검사|법원|대법|헌법재판|선거관리위|대통령|탄핵|계엄|사면|국정조사|인사청문|수사권|정보공개)')
       OR
       (b.committee IN ('법제사법위원회','행정안전위원회','여성가족위원회','문화체육관광위원회','교육위원회')
        AND (b.bill_name || ' ' || COALESCE(b.summary,'')) ~ '(집회|시위|표현의 자유|명예훼손|허위사실|외국인|이민|난민|청소년 (보호|유해)|혼인|낙태|가족|종교|역사 ?교육|교과서|사형|소년범|촉법)')
     )
   ORDER BY sig.top_party, b.committee, b.propose_dt DESC`);
const partyGroups = {};
for (const r of skew) (partyGroups[r.top_party] ??= []).push(r);
w(`## E. 서명자 85%+ 가 한 정당 · none · 관련 위원회 · 넓은 주제어 — ${skew.length}건`);
w('탐색 신호일 뿐이다. 정당이 아니라 **내용**이 셀 정의에 맞아야 넣는다. 두 정당을 다 낸다 — 한쪽만 보면 그게 편집이다.');
w('');
for (const [party, list] of Object.entries(partyGroups)) {
  w(`### ${party} — ${list.length}건`);
  w('| 위원회 | 발의일 | 서명 | 법안 | 현재 | AI 메모 | 원문 | bill_id |');
  w('|---|---|---|---|---|---|---|---|');
  for (const r of list) {
    const cur = !r.axis ? '—' : r.axis === 'none' ? 'none' : `${r.axis} ${r.agree_score > 0 ? '+1' : '−1'} ${r.confidence}`;
    w(`| ${(r.committee||'').replace('위원회','')} | ${r.dt} | ${r.n_co}(${r.top_pct}%) | ${r.bill_name.replace(/\|/g,'/')} | ${cur} | ${(r.reason||'').replace(/\|/g,'/')} | ${strip(r.sum600).slice(0,140).replace(/\|/g,'/')} | ${r.bill_id} |`);
    seen.add(r.bill_id);
  }
  w('');
}
summary.push({ cell: '(E)', theme: '서명자 쏠림 none/반대', total: skew.length, ...Object.fromEntries(Object.entries(partyGroups).map(([k,v])=>[k,v.length])) });

w('## 적용 SQL 템플릿');
w('판정한 것만 골라 아래처럼 pilot 테이블을 고친다 (`prompt_version` 은 `human` 으로 — 재분류 대상에서 빠지고 이력이 남는다):');
w('```sql');
w(`-- 전통(−1) 로 넣기 / 안정(−1) 로 넣기 — 없는 행(D)은 INSERT`);
w(`UPDATE bill_axis_mapping_pilot SET axis='social', agree_score=-1, disagree_score=1, weight=1.0, confidence='high', reason='사람 검토: <20자 이유>', prompt_version='human', model='human' WHERE bill_id IN ('PRC_...');`);
w(`UPDATE bill_axis_mapping_pilot SET axis='institution', agree_score=-1, disagree_score=1, weight=1.0, confidence='high', reason='사람 검토: <20자 이유>', prompt_version='human', model='human' WHERE bill_id IN ('PRC_...');`);
w(`INSERT INTO bill_axis_mapping_pilot (bill_id, axis, agree_score, disagree_score, weight, confidence, reason, prompt_version, model) VALUES ('PRC_...', 'social', -1, 1, 1.0, 'high', '사람 검토: ...', 'human', 'human') ON CONFLICT (bill_id) DO NOTHING;`);
w('```');
w('그 다음: `node batch/mapBillAxisPilot.js --select-only --target 100000 --sync-v2` → `node batch/calcPoliticianAxis.js` → `node batch/calibrateAxisAnchors.js` · `MIN_N=5 node batch/validateAxisPilot.js` 로 신뢰도 확인.');
w('⚠️ 균형 선별은 축 단위라, 전통 셀이 N건 늘면 자율 셀도 N건 더 들어온다 — 사회축 매핑은 2N 늘어난다.');

const dir = path.resolve('out'); fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'rare-cell-candidates.md');
fs.writeFileSync(file, out.join('\n'), 'utf8');
console.table(summary);
console.log(`후보 법안(중복 제거) ${seen.size}건 → ${file}`);
await pool.end();
