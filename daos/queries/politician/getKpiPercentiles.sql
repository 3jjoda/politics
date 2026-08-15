/* KPI 백분위 — 현직 의원 코호트 전체를 **한 번에** 낸다.
   서비스가 10분 캐시하고 mona_cd 로 찾아 쓴다 (의원마다 쿼리하지 않는다). 실측 61ms / 309행.

   🔴 코호트 규칙 — 왜 이렇게 갈랐는지는 실측이 근거다 (2026-08-15):

     · 퇴임(active_yn = FALSE, 10명) — **전 지표 제외.**
       임기가 짧아 건수가 구조적으로 적다 (발의 중앙값 현직 54 vs 퇴임 19~47).
       백분위는 "현재 국회" 통계라는 CLAUDE.md 원칙과도 같다 (/xray·홈 KPI 가 active_yn=TRUE 인 이유).

     · 국무위원 겸직(7명) — **전 지표 제외.**
       실측 발의 27(일반 60) · 공동 458(713) · 표결참여 40.0%(76.8%). 셋 다 절반 수준이다.
       부처를 맡으면 의정활동이 주는 게 당연한데 백분위를 붙이면 장관 전원이 하위권이 된다.

     · 의장단(3명) — **표결참여율만 제외.**
       발의 65·공동 820 으로 오히려 평균 위다. 표결참여만 68.7%인데 국회의장은 관례상
       본회의 표결에 불참(중립)하기 때문이다. 이건 게으름이 아니라 역할이다.

     · 중도 합류(승계·보궐, 20명) — **건수 지표(발의·공동발의)만 제외.**
       🔴 `bill_votes` 모수가 곧 **재직 기간의 대리 지표**다. 표결 모수는 "그 사람이 재직 중일 때
          본회의에 올라온 법안 수" 라서 그렇다. 실측이 교과서적으로 갈린다:
            모수 598 → 279명 (2024-05 개원부터, 첫 발의 2024-05~11)
            모수 0·164·330·348·511 → 20명 (첫 발의가 각각 2026-06~08 · 2026-07 · 2025-09 · 2025-08 · 2025-02)
          모수와 첫 발의일이 **정확히 대응**한다. 지난달 들어와 2건 낸 사람을 임기 전체 재직자와
          나란히 세우면 "하위 1%" 가 되는데 그건 게으름이 아니라 재직 기간이다.
       ⚠️ **표결참여율은 제외하지 않는다** — 그건 비율이라 분모가 자기 재직 기간이다 (기간 보정이 이미 돼 있다).
          단 표본이 얇으면 흔들리므로 모수 100 미만은 뺀다 (실측상 0 아니면 164 이상이라 사실상 "기록 있으면 포함").

   🔴 가결율의 백분위는 **만들지 않는다.** 되살리지 말 것 — 실측이 명확하다:
     · 가결 0건이 94명(32%)이라 셋 중 하나가 통째로 최하위로 묶인다
     · 같은 "가결 1건"인데 백분위가 32~93 으로 흩어진다 (11건 중 1건 = 9.1% → 93분위 /
       110건 중 1건 = 0.9% → 32분위). **많이 낸 사람이 벌을 받는다**
     · 최댓값이 26.1%. 계류가 76%라 이 지표는 사실상 "얼마나 오래전에 냈나" 를 잰다
     대신 중앙값(med_pass_rate)만 앵커로 내려보내고 화면이 "중앙값 N%" 로 병기한다.
*/
WITH bl AS (          /* bills 1회 스캔 — 발의·가결을 같이 센다 */
  SELECT mona_cd
       , COUNT(*) AS propose
       , COUNT(*) FILTER (WHERE proc_result_name IN ('원안가결','수정가결')) AS passed
    FROM bills
   WHERE mona_cd IS NOT NULL
   GROUP BY mona_cd
), cp AS (
  SELECT mona_cd, COUNT(*) AS copropose
    FROM bill_co_proposers
   WHERE proposer_yn = FALSE
   GROUP BY mona_cd
), vt AS (
  SELECT mona_cd
       , COUNT(*) AS vote_tot
       , COUNT(*) FILTER (WHERE vote_result IN ('찬성','반대','기권')) AS vote_att
    FROM bill_votes
   GROUP BY mona_cd
), ti AS (
  SELECT mona_cd
       , bool_or(category = '국무위원') AS is_minister
       , bool_or(category = '의장단')   AS is_speaker
    FROM politician_titles
   GROUP BY mona_cd
), m AS (
  /* ⚠️ 상관 서브쿼리로 쓰면 309번씩 돌아 **1,483ms** 였다. 테이블당 1회 집계 후 조인이 필수다 */
  SELECT p.mona_cd
       , p.active_yn
       , COALESCE(bl.propose, 0)   AS propose
       , COALESCE(bl.passed, 0)    AS passed
       , COALESCE(cp.copropose, 0) AS copropose
       , COALESCE(vt.vote_tot, 0)  AS vote_tot
       /* ⚠️ politician_titles 는 수동 관리라 비어 있을 수 있다. 그 경우 전부 FALSE 가 되어
          아무도 제외되지 않는다 — 조용히 틀리는 게 아니라 "제외 없음" 으로 안전하게 무너진다 */
       , COALESCE(ti.is_minister, FALSE) AS is_minister
       , COALESCE(ti.is_speaker,  FALSE) AS is_speaker
       , CASE WHEN COALESCE(vt.vote_tot,0) > 0
              THEN vt.vote_att * 100.0 / vt.vote_tot END AS vote_rate
       , CASE WHEN COALESCE(bl.propose,0) > 0
              THEN bl.passed * 100.0 / bl.propose END AS pass_rate
    FROM politicians p
    LEFT JOIN bl ON bl.mona_cd = p.mona_cd
    LEFT JOIN cp ON cp.mona_cd = p.mona_cd
    LEFT JOIN vt ON vt.mona_cd = p.mona_cd
    LEFT JOIN ti ON ti.mona_cd = p.mona_cd
), tenure AS (
  /* 임기 전체 재직 기준선 = 현직 표결 모수의 최댓값. 상수로 박지 않는다 — 회기가 갈수록 늘어난다 */
  SELECT MAX(vote_tot) AS full_term FROM m WHERE active_yn
), f AS (
  SELECT m.*
       /* 임기의 90% 이상을 재직했나 (실측 컷: 538 이상 → 모수 598 인 279명. 511(85%)은 빠진다) */
       , (m.vote_tot >= t.full_term * 0.9) AS full_tenure
    FROM m CROSS JOIN tenure t
), coh_cnt AS (          /* 건수 코호트 — 재직 기간이 같은 사람끼리만 */
  SELECT mona_cd
       , PERCENT_RANK() OVER (ORDER BY propose)   AS pr_propose
       , PERCENT_RANK() OVER (ORDER BY copropose) AS pr_copropose
    FROM f
   WHERE active_yn AND NOT is_minister AND full_tenure
), coh_vote AS (         /* 비율 코호트 — 기간 보정이 이미 돼 있어 중도 합류도 포함, 의장단만 뺀다 */
  SELECT mona_cd
       , PERCENT_RANK() OVER (ORDER BY vote_rate) AS pr_vote
    FROM f
   WHERE active_yn AND NOT is_minister AND NOT is_speaker AND vote_tot >= 100
), stat AS (
  SELECT (SELECT COUNT(*) FROM f WHERE active_yn AND NOT is_minister AND full_tenure) AS n_cnt
       , (SELECT COUNT(*) FROM f
           WHERE active_yn AND NOT is_minister AND NOT is_speaker AND vote_tot >= 100) AS n_vote
       , (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY propose)
            FROM f WHERE active_yn AND NOT is_minister AND full_tenure) AS med_propose
       , (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY copropose)
            FROM f WHERE active_yn AND NOT is_minister AND full_tenure) AS med_copropose
       , (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY vote_rate)
            FROM f WHERE active_yn AND NOT is_minister AND NOT is_speaker AND vote_tot >= 100) AS med_vote
       , (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pass_rate)
            FROM f WHERE active_yn AND NOT is_minister AND full_tenure AND pass_rate IS NOT NULL) AS med_pass_rate
       /* 대표발의 비중 = 대표 / (대표+공동). "이름만 올리는 편인가, 직접 주도하는 편인가".
          ⚠️ 비율의 중앙값이지 중앙값의 비율이 아니다 (med_propose/med_copropose 로 계산하면 다른 값이 나온다).
          🔴 이 숫자 혼자로는 아무 뜻이 없다 — 화면에 **중앙값을 반드시 같이** 낼 것 */
       , (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY propose * 100.0 / NULLIF(propose + copropose, 0))
            FROM f WHERE active_yn AND NOT is_minister AND full_tenure
                     AND (propose + copropose) > 0) AS med_lead_share
)
SELECT f.mona_cd
     , f.active_yn
     , f.is_minister
     , f.is_speaker
     , f.full_tenure
     , f.vote_tot::int
     , c.pr_propose::float8   AS pr_propose
     , c.pr_copropose::float8 AS pr_copropose
     , v.pr_vote::float8      AS pr_vote
     , s.n_cnt::int
     , s.n_vote::int
     , s.med_propose::float8
     , s.med_copropose::float8
     , s.med_vote::float8
     , s.med_pass_rate::float8
     , s.med_lead_share::float8
  FROM f
  LEFT JOIN coh_cnt  c ON c.mona_cd = f.mona_cd
  LEFT JOIN coh_vote v ON v.mona_cd = f.mona_cd
  CROSS JOIN stat s
