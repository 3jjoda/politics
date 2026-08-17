// calibrateAxisAnchors.js — 눈금 보정: 사용자 문항(balance_game_questions, v1) 의 부호와
//   의원 좌표를 만드는 법안 매핑(bill_axis_mapping, v2) 의 부호가 **같은 쪽을 가리키는지** 확인한다.
//
//   왜: 사용자 좌표는 문항 20개(태도), 의원 좌표는 공동발의 × AI 매핑(행동) — 서로 다른 자다 (의도된 설계).
//       두 자를 하나로 만드는 게 아니라, 축 이름이 같은 두 자의 **방향**이 맞는지만 본다.
//       (v1 표결 기반 사회축과 v2 사회축의 상관이 −0.22 였다 — 같은 이름이 다른 걸 재고 있을 수 있다)
//
//   무엇을 하나 (AI 호출 0 · 크레딧 0 · DB 읽기만):
//     ① 문항마다 주제 키워드로 v2 매핑 안의 **앵커 법안**을 찾는다 (없으면 그 문항 주제는 의원 비교에 기여하지 못한다)
//     ② 앵커 법안의 매핑 부호(agree_score)가 문항의 +1 쪽과 같은지 — 법안명·AI 메모·원문의 키워드로 **추정 부호**를 만들어 비교.
//        🔴 추정은 휴리스틱이다. 표를 눈으로 확인하는 것이 본체고, 이 숫자는 어디를 먼저 볼지 알려줄 뿐이다
//     ③ 앵커 법안 공동발의자의 좌표 평균이 매핑 부호와 같은 쪽인지 (문항 → 법안 → 의원 사슬이 한 방향인지).
//        ⚠️ 그 법안 자체가 서명자 좌표에 들어가 있어 약간 순환적이다 — 방향 확인용이지 독립 검증이 아니다
//
//   사용:  node batch/calibrateAxisAnchors.js            # 콘솔 요약 + out/axis-calibration.md (전체 표)
//          node batch/calibrateAxisAnchors.js --q q2     # 한 문항만 상세
//   결과 해석 → CLAUDE.md 「진단의 의도를 화면에 쓴다」 · 「의원 성향 좌표 v2」
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import cfg from '../config/database.js';
import { AXIS_META, POL_MAPPING_VERSION } from '../utils/axisConfig.js';

const pool = new pg.Pool(cfg);
const POL_VER = POL_MAPPING_VERSION || 'v2';
const onlyQ = (() => { const i = process.argv.indexOf('--q'); return i > -1 ? process.argv[i + 1] : null; })();

// ── 문항 → 앵커 규칙 ─────────────────────────────────────────────────────────
//   name: bill_name ILIKE 패턴들 (OR) · sum: 원문(summary) ILIKE 패턴들 (AND 로 name 과 결합, 생략 가능)
//   plus / minus: 추정 부호용 키워드 (법안명 + AI 메모 + 원문 앞 500자에서 찾음). 둘 다 걸리거나 둘 다 없으면 null(사람 판단)
//   문항의 +1 이 무엇을 뜻하는지는 balance_game_questions 의 option 점수에서 그대로 읽는다 (여기선 주제만 정한다)
const RULES = {
  q1:  { topic: '최저임금',           name: ['%최저임금법%'],
         plus: /인상|보장|확대|산입범위 축소|적용 확대|현실화/, minus: /차등|구분 적용|동결|유예|완화|산입범위 확대|업종별/ },
  q2:  { topic: '다주택 세제',        name: ['%종합부동산세법%', '%지방세법%', '%소득세법%'], sum: ['%다주택%'],
         plus: /중과|강화|인상|상향|투기 억제/, minus: /완화|감면|폐지|인하|공제 확대|유예|배제|제외/ },
  q3:  { topic: '대기업 규제',        name: ['%독점규제 및 공정거래%', '%상법 일부개정%'],
         plus: /강화|제재|과징금|의무|책임|규제 신설|보호/, minus: /완화|예외|경감|폐지|부담 완화|자율/ },
  q4:  { topic: '근로시간(52시간)',   name: ['%근로기준법%'], sum: ['%근로시간%'],
         plus: /단축|엄격|제한|보호|상한|휴식/, minus: /유연|특례|확대|예외|탄력|선택적|연장 허용/ },
  q5:  { topic: '공공의료·의대 정원', name: ['%공공보건의료%', '%의료법%', '%지역의사%', '%국립%의과대학%', '%보건의료인력%'],
         sum: ['%공공%'],
         plus: /확대|공공|국공립|지역의사|의무복무|신설|증원/, minus: /자율|민간|완화|축소/ },
  // ── 사회 5문항 (2026-08-16 교체: q6·q7·q8·q10 비활성 → q21~q24. 옛 규칙은 지웠다 — 비활성 문항은 조회에 안 잡힌다)
  q21: { topic: '집회·시위 규제',     name: ['%집회 및 시위에 관한 법률%'],
         plus: /완화|자유 확대|허용|형사처벌 완화|행정질서벌|구체화/, minus: /제한|금지|규제|강화|확대 적용/ },
  q22: { topic: '온라인 표현 규제',   name: ['%정보통신망 이용촉진%', '%형법%', '%언론중재%'], sum: ['%명예훼손%', '%허위%', '%불법정보%', '%표현%', '%게시%'],
         plus: /친고죄|반의사불벌|폐지|완화|표현의 자유|표현 자유|언론자유/, minus: /차단|삭제 의무|처벌 강화|규제 강화|제한|금지/ },
  q23: { topic: '이주민·외국인 권리', name: ['%공직선거법%', '%출입국관리법%', '%난민법%', '%재한외국인%', '%국적법%'], sum: ['%외국인%', '%이주%', '%난민%', '%체류%'],
         plus: /보장|확대|권리|보호|허용|체류권|구금 금지/, minus: /제한|강화|요건|퇴거|상호주의|반복 제한/ },
  q9:  { topic: '청소년 온라인 규제', name: ['%게임산업진흥%', '%청소년 보호법%', '%청소년보호법%', '%정보통신망 이용촉진%'], sum: ['%게임%', '%청소년%SNS%', '%16세%', '%소셜%'],
         plus: /자율|폐지|완화|선택|보호자 판단/, minus: /규제|제한|금지|의무|강화|셧다운/ },
  q24: { topic: '촉법소년·소년범',    name: ['%소년법%', '%특정강력범죄%'], 
         plus: /교화|보호처분|재활|인권|완화/, minus: /연령 인하|처벌 강화|형량|상향|강력범죄|수사권/ },
  q16: { topic: '검찰 권한',          name: ['%검찰청법%', '%형사소송법%', '%고위공직자범죄수사처%', '%공수처%', '%중대범죄수사청%', '%검찰청 폐지%'],
         plus: /분리|분산|견제|이관|축소|공수처|투명|공개|권리 보장|피의자|피해자/, minus: /유지|복원|폐지법률안|검찰(의|청)? 수사권 (확대|강화|회복)/ },
  q17: { topic: '연동형 비례대표제',  name: ['%공직선거법%'], sum: ['%비례대표%'],
         plus: /연동|소수정당|확대|비례성/, minus: /병립|폐지|단순|위성정당 방지|축소/ },
  q18: { topic: '개헌·권력구조',      name: ['%헌법개정%', '%국민투표법%', '%대한민국헌법%'],
         plus: /분산|중임|내각제|개편|개헌/, minus: /유지/ },
  q19: { topic: '사법부 인사',        name: ['%법원조직법%', '%헌법재판소법%'], sum: ['%임명%', '%대법관%', '%재판관%', '%추천%'],
         plus: /증원|국회|통제|추천위|다양화|민주적/, minus: /독립|중립|정치적 영향 배제/ },
  q20: { topic: '선관위 견제',        name: ['%선거관리위원회법%'],
         plus: /감사|견제|공개|외부|국회|검증/, minus: /유지|독립/ },
};

// 패턴은 코드 상수라 문자열 리터럴로 직접 넣는다 (사용자 입력 없음). 작은따옴표만 이스케이프
const like = (col, pats) => '(' + pats.map(p => `${col} ILIKE '${p.replace(/'/g, "''")}'`).join(' OR ') + ')';

// ── 데이터 ───────────────────────────────────────────────────────────────────
const { rows: questions } = await pool.query(`
  SELECT id, axis, prompt, option_a_text, option_a_score, option_b_text, option_b_score
    FROM balance_game_questions WHERE pack_id='general' AND is_active ORDER BY display_order`);
const { rows: mapTotals } = await pool.query(`
  SELECT axis, agree_score, COUNT(*)::int n FROM bill_axis_mapping WHERE mapping_version=$1 GROUP BY 1,2 ORDER BY 1,2`, [POL_VER]);

const report = [];
const summary = [];
const out = (s = '') => report.push(s);

out(`# 눈금 보정 — 문항(v1) ↔ 법안 매핑(${POL_VER}) 부호 정합`);
out(`생성 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · v2 매핑 ${mapTotals.reduce((s, r) => s + r.n, 0)}건`);
out('');
out('| 축 | −1 (' + '왼쪽' + ') | +1 (오른쪽) |');
out('|---|---|---|');
for (const ax of ['economy', 'social', 'institution']) {
  const m = AXIS_META[ax];
  const neg = mapTotals.find(r => r.axis === ax && r.agree_score < 0)?.n ?? 0;
  const pos = mapTotals.find(r => r.axis === ax && r.agree_score > 0)?.n ?? 0;
  out(`| ${m.name} | ${m.Lx} ${neg} | ${m.Rx} ${pos} |`);
}
out('');

for (const q of questions) {
  if (onlyQ && q.id !== onlyQ) continue;
  const rule = RULES[q.id];
  const meta = AXIS_META[q.axis];
  const plusText  = q.option_a_score > 0 ? q.option_a_text : q.option_b_text;
  const minusText = q.option_a_score > 0 ? q.option_b_text : q.option_a_text;
  out(`## ${q.id} · ${meta.name} · ${rule?.topic ?? '(규칙 없음)'}`);
  out(`> ${q.prompt}`);
  out(`> **+1 = ${plusText}** (${meta.R}) · **−1 = ${minusText}** (${meta.L})`);
  if (q.axis === 'security') { out(`> 안보축은 의원 좌표가 없어 보정 대상이 아님 (건너뜀)`); out(''); summary.push({ q: q.id, axis: q.axis, topic: rule?.topic, anchors: '-', judged: '-', agree: '-', chain: '-' }); continue; }
  if (!rule) { out(''); continue; }

  const where = [like('b.bill_name', rule.name)];
  if (rule.sum) where.push(like('b.summary', rule.sum));
  const params = [POL_VER];
  const { rows: anchors } = await pool.query(`
    WITH a AS (
      SELECT b.bill_id, b.bill_name, TO_CHAR(b.propose_dt,'YYYY-MM-DD') dt, b.proc_result_name,
             m.agree_score, m.weight, m.notes, LEFT(b.summary, 500) sum500
        FROM bills b JOIN bill_axis_mapping m ON m.bill_id=b.bill_id AND m.mapping_version=$1 AND m.axis='${q.axis}'
       WHERE ${where.join(' AND ')}
    ),
    co AS (
      SELECT a.bill_id, COUNT(*)::int n_co,
             AVG(s.${q.axis})::float8 co_axis,                       -- 서명자 좌표 평균 (그 축)
             COUNT(s.${q.axis})::int n_scored,
             STRING_AGG(DISTINCT p.party_name, '·' ORDER BY p.party_name) parties
        FROM a JOIN bill_co_proposers c ON c.bill_id=a.bill_id
        LEFT JOIN politicians p ON p.mona_cd=c.mona_cd
        LEFT JOIN politician_axis_score s ON s.mona_cd=c.mona_cd AND s.mapping_version=$1
       GROUP BY a.bill_id
    )
    SELECT a.*, co.n_co, co.co_axis, co.n_scored, co.parties FROM a LEFT JOIN co USING (bill_id)
     ORDER BY a.dt DESC`, params);

  // 같은 주제인데 매핑에 안 들어간 법안 수 (다른 축으로 갔거나 none) — 커버리지 참고
  const { rows: [{ n_all }] } = await pool.query(`
    SELECT COUNT(*)::int n_all FROM bills b WHERE ${where.join(' AND ')}`);
  const { rows: [{ n_other }] } = await pool.query(`
    SELECT COUNT(*)::int n_other FROM bills b JOIN bill_axis_mapping m ON m.bill_id=b.bill_id AND m.mapping_version=$1 AND m.axis<>'${q.axis}'
     WHERE ${where.join(' AND ')}`, params);

  let judged = 0, agree = 0, chainN = 0, chainOk = 0;
  const rowsOut = [];
  for (const a of anchors) {
    const text = `${a.bill_name} ${a.notes || ''} ${a.sum500 || ''}`;
    const hp = rule.plus.test(text), hm = rule.minus.test(text);
    // 추정 부호: 한쪽 키워드만 걸릴 때만. AI 메모(notes)가 있으면 메모를 우선 본다 (짧고 결론적이다)
    let guess = null;
    if (a.notes) { const gp = rule.plus.test(a.notes), gm = rule.minus.test(a.notes); if (gp !== gm) guess = gp ? 1 : -1; }
    if (guess === null && hp !== hm) guess = hp ? 1 : -1;
    let verdict = '?';
    if (guess !== null) { judged++; const ok = Math.sign(a.agree_score) === guess; if (ok) agree++; verdict = ok ? '✅' : '❌'; }
    let chain = '';
    if (a.n_scored >= 3 && Number.isFinite(a.co_axis)) {
      chainN++; const ok = Math.sign(a.co_axis) === Math.sign(a.agree_score) || Math.abs(a.co_axis) < 0.05;
      if (ok) chainOk++; chain = `${a.co_axis >= 0 ? '+' : ''}${a.co_axis.toFixed(2)}${ok ? '' : ' ⚠️'}`;
    }
    rowsOut.push(`| ${verdict} | ${a.agree_score > 0 ? '+1 ' + meta.R : '−1 ' + meta.L} | ${guess === null ? '?' : (guess > 0 ? '+1' : '−1')} | ${a.dt} | ${a.bill_name.replace(/\|/g, '/')} | ${(a.notes || '').replace(/\|/g, '/')} | ${a.n_co ?? 0} | ${chain} | ${a.bill_id} |`);
  }
  out(`앵커 ${anchors.length}건 (주제 법안 ${n_all}건 중 · 다른 축으로 매핑 ${n_other}건 · 미매핑 ${n_all - anchors.length - n_other}건) · 추정 가능 ${judged}건 중 부호 일치 **${agree}** · 서명자 좌표 방향 일치 ${chainOk}/${chainN}`);
  out('');
  if (anchors.length) {
    out('| 판정 | 매핑 부호 | 추정 | 발의일 | 법안 | AI 메모 | 서명 | 서명자 좌표 평균 | bill_id |');
    out('|---|---|---|---|---|---|---|---|---|');
    rowsOut.forEach(r => out(r));
  } else {
    out('_이 주제의 법안이 v2 매핑에 없다 → 이 문항은 의원 비교에 기여하지 못하고 있다_');
  }
  out('');
  summary.push({ q: q.id, axis: q.axis, topic: rule.topic, anchors: anchors.length, judged, agree, chain: chainN ? `${chainOk}/${chainN}` : '-', unmapped: n_all - anchors.length - n_other, other: n_other });
}

// ── 축별 요약 ─────────────────────────────────────────────────────────────────
const byAxis = {};
for (const s of summary) { if (s.axis === 'security' || typeof s.judged !== 'number') continue; const b = byAxis[s.axis] ??= { anchors: 0, judged: 0, agree: 0 }; b.anchors += s.anchors; b.judged += s.judged; b.agree += s.agree; }
out('## 축별 요약');
out('| 축 | 앵커 법안 | 추정 가능 | 부호 일치 | 정합률 |');
out('|---|---|---|---|---|');
for (const [ax, b] of Object.entries(byAxis)) out(`| ${AXIS_META[ax].name} | ${b.anchors} | ${b.judged} | ${b.agree} | ${b.judged ? Math.round(b.agree / b.judged * 100) + '%' : '-'} |`);
out('');
out('🔴 정합률은 키워드 추정 기준이다. ❌ 와 ? 행을 눈으로 확인한 뒤 결론을 내릴 것.');

// ── 출력 ─────────────────────────────────────────────────────────────────────
console.table(summary);
console.log('\n축별 정합률 (추정 기준):');
for (const [ax, b] of Object.entries(byAxis)) console.log(`  ${AXIS_META[ax].name.padEnd(6)} 앵커 ${String(b.anchors).padStart(3)} · 추정 ${String(b.judged).padStart(3)} · 일치 ${String(b.agree).padStart(3)} · ${b.judged ? Math.round(b.agree / b.judged * 100) + '%' : '-'}`);
if (!onlyQ) {
  const dir = path.resolve('out'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'axis-calibration.md');
  fs.writeFileSync(file, report.join('\n'), 'utf8');
  console.log(`\n전체 표 → ${file}`);
} else {
  console.log('\n' + report.join('\n'));
}
await pool.end();
