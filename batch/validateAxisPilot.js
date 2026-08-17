// validateAxisPilot.js — 파일럿 매핑(bill_axis_mapping_pilot, is_selected) × 공동발의 → 4축 좌표 검증
//   ① 축별 커버리지·sd·정당 η²·정당별 탈락률·활동량/불참률 상관·극단 의원
//   ② 분할-반 신뢰도 (매핑을 방향별로 반씩 나눠 두 좌표의 상관) + 당내 상관
//   ③ 전 코퍼스로 확장했을 때 희소 방향이 정하는 축별 상한 추정
// 사용: node batch/validateAxisPilot.js            (MIN_N=3 환경변수로 축당 최소 서명 수 조정)
// 결과 해석은 CLAUDE.md 「매핑 확장 파일럿」 참조.
import "dotenv/config";
// 파일럿 매핑(bill_axis_mapping_pilot, is_selected) × 공동발의 → 4축 좌표 + 검증
import pg from 'pg';
import cfg from '../config/database.js';
const pool = new pg.Pool(cfg);
const AXES=['economy','social','security','institution'];
const MIN_N = parseInt(process.env.MIN_N||'3',10);   // 축당 최소 서명 법안 수

const { rows: mem } = await pool.query(`
  SELECT p.mona_cd, p.name, COALESCE(p.party_name,'무소속') party,
         (SELECT COUNT(*) FROM bill_co_proposers c WHERE c.mona_cd=p.mona_cd) co_total,
         v.absent_rate, s.economy::float8 e0, s.social::float8 s0, s.security::float8 sec0, s.institution::float8 i0,
         d.dissent_rate::float8 dissent, cp.gap::float8 gap
    FROM politicians p
    LEFT JOIN (SELECT mona_cd, COUNT(*) FILTER (WHERE vote_result='불참')::float8/COUNT(*) absent_rate FROM bill_votes GROUP BY 1) v ON v.mona_cd=p.mona_cd
    /* 🔴 여기는 'v1' 이 맞다 — POL_MAPPING_VERSION(v2) 으로 바꾸지 말 것.
       v1 = 파일럿 **이전** 기준선이고, 아래 "파일럿 이전 기준선 v1, 같은 축" 지표가
       "새 매핑이 기존과 얼마나 다른가" 를 잰다.
       v2 는 mapBillAxisPilot.js 의 syncV2 가 이 파일럿을 그대로 미러링한 결과라,
       v2 와 비교하면 파일럿을 파일럿과 대조하는 **순환**이 되어 r=1 근처만 나오고 검증이 무의미해진다.
       ⚠️ politician_axis_score 의 v1 행(294)을 지우면 그 지표가 에러 없이 NaN 으로만 바뀐다 — 남겨둘 것.
       ⚠️ 이 주석은 SQL 템플릿 리터럴 안이다 — 역따옴표 문자를 쓰면 문자열이 그 자리에서 끊긴다 (실제로 두 번 깨뜨렸다). */
    LEFT JOIN politician_axis_score s ON s.mona_cd=p.mona_cd AND s.mapping_version='v1'
    LEFT JOIN politician_dissent d ON d.mona_cd=p.mona_cd
    LEFT JOIN politician_cross_party_vote cp ON cp.mona_cd=p.mona_cd
   ORDER BY p.mona_cd`);
// 공동발의 기반: 서명한 매핑 법안의 agree_score 가중평균 (부호는 항상 '찬성')
const { rows: sc } = await pool.query(`
  SELECT c.mona_cd, m.axis,
         SUM(m.agree_score*m.weight)/SUM(m.weight) AS score, COUNT(*)::int n,
         COUNT(*) FILTER (WHERE m.agree_score>0)::int pos, COUNT(*) FILTER (WHERE m.agree_score<0)::int neg
    FROM bill_co_proposers c JOIN bill_axis_mapping_pilot m ON m.bill_id=c.bill_id AND m.is_selected
   GROUP BY 1,2`);
const S=new Map(); for(const r of sc){ if(!S.has(r.mona_cd)) S.set(r.mona_cd,{}); S.get(r.mona_cd)[r.axis]={score:+r.score,n:r.n,pos:r.pos,neg:r.neg}; }
const { rows: mapstat } = await pool.query(`SELECT axis, agree_score, COUNT(*)::int n, SUM((SELECT COUNT(*) FROM bill_co_proposers c WHERE c.bill_id=m.bill_id))::int co FROM bill_axis_mapping_pilot m WHERE is_selected GROUP BY 1,2 ORDER BY 1,2`);
console.log('선별 매핑:'); console.table(mapstat);

const pearson=(a,b)=>{const p=[];for(let i=0;i<a.length;i++)if(Number.isFinite(a[i])&&Number.isFinite(b[i]))p.push([a[i],b[i]]);const n=p.length;if(n<5)return NaN;const ma=p.reduce((s,x)=>s+x[0],0)/n,mb=p.reduce((s,x)=>s+x[1],0)/n;let sab=0,sa=0,sb=0;for(const[x,y]of p){sab+=(x-ma)*(y-mb);sa+=(x-ma)**2;sb+=(y-mb)**2;}return sab/Math.sqrt(sa*sb);};
const sd=a=>{const p=a.filter(Number.isFinite);const m=p.reduce((s,x)=>s+x,0)/p.length;return Math.sqrt(p.reduce((s,x)=>s+(x-m)**2,0)/p.length);};
const parties=['더불어민주당','국민의힘','조국혁신당','개혁신당','진보당','무소속'];
for(const ax of AXES){
  const f=mem.map(m=>{const x=S.get(m.mona_cd)?.[ax]; return x&&x.n>=MIN_N?x.score:NaN;});
  const ns=mem.map(m=>S.get(m.mona_cd)?.[ax]?.n||0);
  const have=f.filter(Number.isFinite).length;
  const all=f.filter(Number.isFinite); const gm=all.reduce((s,x)=>s+x,0)/all.length; const sst=all.reduce((s,x)=>s+(x-gm)**2,0); let ssb=0;
  // 최빈값 비중 (소수점 2자리)
  const cnt=new Map(); for(const v of all){const k=v.toFixed(2); cnt.set(k,(cnt.get(k)||0)+1);} const modeShare=Math.max(...cnt.values())/all.length;
  console.log(`\n=== ${ax} — 좌표 있음 ${have}/${mem.length} (축당 서명 ≥${MIN_N}) · sd ${sd(f).toFixed(3)} · 최빈값 비중 ${(modeShare*100).toFixed(0)}% · 서명수 중앙값 ${[...ns].sort((a,b)=>a-b)[Math.floor(ns.length/2)]}`);
  const rows=[];
  for(const p of parties){ const idx=mem.map((m,i)=>m.party===p?i:-1).filter(i=>i>=0); const g=idx.map(i=>f[i]).filter(Number.isFinite); if(idx.length<3) continue; const gmn=g.length?g.reduce((s,x)=>s+x,0)/g.length:NaN; if(g.length) ssb+=g.length*(gmn-gm)**2;
    rows.push({party:p, n:idx.length, has:g.length, dropRate:((1-g.length/idx.length)*100).toFixed(0)+'%', mean:gmn.toFixed(2), sd:sd(g).toFixed(3), min:g.length?Math.min(...g).toFixed(2):'-', max:g.length?Math.max(...g).toFixed(2):'-'}); }
  console.table(rows);
  console.log(`  η²(정당) ${(ssb/sst*100).toFixed(1)}% · r(공동발의 총건수) ${pearson(f,mem.map(m=>+m.co_total)).toFixed(2)} · r(불참률) ${pearson(f,mem.map(m=>m.absent_rate)).toFixed(2)} · r(축당 서명수) ${pearson(f,ns).toFixed(2)} · r(당론이탈) ${pearson(f,mem.map(m=>m.dissent)).toFixed(2)} · r(교차격차) ${pearson(f,mem.map(m=>m.gap)).toFixed(2)}`);
  // 'v1' = 파일럿 이전 기준선 (위 조인 주석 참조). 현행 프로덕션은 v2 지만 그건 이 파일럿의 미러라 비교 대상이 아니다
  console.log(`  r(파일럿 이전 기준선 v1, 같은 축) ${pearson(f,mem.map(m=>m[{economy:'e0',social:'s0',security:'sec0',institution:'i0'}[ax]])).toFixed(2)}`);
  const ord=mem.map((m,i)=>({m,v:f[i],n:ns[i]})).filter(x=>Number.isFinite(x.v)).sort((a,b)=>a.v-b.v);
  const fmt=x=>`${x.m.name}(${x.m.party.slice(0,3)}·${x.n}건) ${x.v.toFixed(2)}`;
  console.log('  −극:', ord.slice(0,6).map(fmt).join(' · '));
  console.log('  +극:', ord.slice(-6).reverse().map(fmt).join(' · '));
  // 당내 분포: 민주·국힘의 사분위
  for(const p of ['더불어민주당','국민의힘']){ const g=mem.map((m,i)=>m.party===p?f[i]:NaN).filter(Number.isFinite).sort((a,b)=>a-b); if(g.length<8) continue; const q=k=>g[Math.floor(g.length*k)].toFixed(2); console.log(`  ${p} 사분위 ${q(0.1)} / ${q(0.25)} / ${q(0.5)} / ${q(0.75)} / ${q(0.9)}`); }
}
await pool.end();
// ===== ② ③ =====
// 분할-반 신뢰도 + 당내 상관 + 전 코퍼스 확장 시 도달 가능한 표본 추정
{ const pool = new pg.Pool(cfg); const { rows: mem } = await pool.query(`
  SELECT p.mona_cd, COALESCE(p.party_name,'무소속') party,
         (SELECT COUNT(*) FROM bill_co_proposers c WHERE c.mona_cd=p.mona_cd)::int co_total,
         v.absent_rate FROM politicians p
    LEFT JOIN (SELECT mona_cd, COUNT(*) FILTER (WHERE vote_result='불참')::float8/COUNT(*) absent_rate FROM bill_votes GROUP BY 1) v ON v.mona_cd=p.mona_cd`);
const { rows: sig } = await pool.query(`
  SELECT c.mona_cd, m.axis, m.bill_id, m.agree_score::int s FROM bill_co_proposers c JOIN bill_axis_mapping_pilot m ON m.bill_id=c.bill_id AND m.is_selected
    JOIN politicians p ON p.mona_cd=c.mona_cd`);
// 축별 법안 목록 → 방향별로 반씩 나눠 두 절반 모두 균형 유지
let seed=7; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
for(const ax of AXES){
  const bills=[...new Set(sig.filter(x=>x.axis===ax).map(x=>x.bill_id))];
  const dir=new Map(sig.filter(x=>x.axis===ax).map(x=>[x.bill_id,x.s]));
  const rs=[];
  for(let rep=0;rep<20;rep++){
    const half=new Set();
    for(const d of [-1,1]){ const g=bills.filter(b=>dir.get(b)===d).sort(()=>rnd()-0.5); g.slice(0,Math.floor(g.length/2)).forEach(b=>half.add(b)); }
    const A=new Map(),B=new Map();
    for(const x of sig){ if(x.axis!==ax) continue; const t=half.has(x.bill_id)?A:B; const o=t.get(x.mona_cd)||{s:0,n:0}; o.s+=x.s;o.n++; t.set(x.mona_cd,o); }
    const a=[],b=[]; for(const m of mem){const x=A.get(m.mona_cd),y=B.get(m.mona_cd); if(x&&y&&x.n>=2&&y.n>=2){a.push(x.s/x.n);b.push(y.s/y.n);} }
    rs.push({r:pearson(a,b),n:a.length});
  }
  const rmean=rs.reduce((s,x)=>s+x.r,0)/rs.length, nmean=rs.reduce((s,x)=>s+x.n,0)/rs.length;
  // Spearman-Brown 으로 전체 길이 신뢰도
  const full=2*rmean/(1+rmean);
  // 당내 상관 (민주·국힘 각각, n>=3 좌표)
  const S=new Map(); for(const x of sig){ if(x.axis!==ax) continue; const o=S.get(x.mona_cd)||{s:0,n:0}; o.s+=x.s;o.n++; S.set(x.mona_cd,o); }
  const line=[];
  for(const p of ['더불어민주당','국민의힘']){ const f=[],ab=[],co=[]; for(const m of mem){ if(m.party!==p) continue; const o=S.get(m.mona_cd); if(!o||o.n<3) continue; f.push(o.s/o.n); ab.push(m.absent_rate); co.push(m.co_total);} line.push(`${p.slice(0,2)}: n=${f.length} r불참 ${pearson(f,ab).toFixed(2)} r활동량 ${pearson(f,co).toFixed(2)}`); }
  console.log(`${ax.padEnd(11)} 분할-반 r=${rmean.toFixed(2)} (양쪽 ≥2건인 의원 ${nmean.toFixed(0)}명) → 전체길이 신뢰도 ${full.toFixed(2)} | 당내: ${line.join(' · ')}`);
}
// 확장 추정: 분류 2,118건 중 희소 방향 비율 → 전 코퍼스(18,770) 환산 → 의원당 기대 서명 수 (법안당 평균 서명 12.5명/309명 ≈ 4%)
const { rows: rate } = await pool.query(`SELECT axis, agree_score, COUNT(*)::int n FROM bill_axis_mapping_pilot WHERE confidence IN ('high','medium') AND axis<>'none' GROUP BY 1,2 ORDER BY 1,2`);
const { rows: tot } = await pool.query(`SELECT COUNT(*)::int n FROM bill_axis_mapping_pilot`);
const { rows: corp } = await pool.query(`SELECT COUNT(*)::int n FROM bills WHERE summary IS NOT NULL`);
console.log(`\n분류 ${tot[0].n}건 → 코퍼스 ${corp[0].n}건 환산 (희소 방향이 축의 상한):`);
for(const ax of AXES){ const neg=rate.find(r=>r.axis===ax&&r.agree_score===-1)?.n||0, pos=rate.find(r=>r.axis===ax&&r.agree_score===1)?.n||0; const scarce=Math.min(neg,pos); const est=Math.round(scarce/tot[0].n*corp[0].n); console.log(`  ${ax.padEnd(11)} −1 ${neg} / +1 ${pos} → 희소 ${scarce} (${(scarce/tot[0].n*100).toFixed(1)}%) → 코퍼스 전체 시 균형 매핑 약 ${est*2}건 → 의원당 서명 기대 ≈ ${(est*2*0.04).toFixed(0)}건`); }
await pool.end(); }
