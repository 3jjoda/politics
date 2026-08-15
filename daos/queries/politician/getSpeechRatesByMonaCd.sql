/* 의원 상임위 발언 참여율 (politician_committee_speech MV)
   $1: mona_cd

   집계 본체는 MV 에 사전 계산돼 있다 (ddl/migrations/2026-08-15-committee-speech-mv.sql —
   왜 이 형태여야 하는지, 어떤 대안을 실측으로 걸러냈는지 전부 거기 적혀 있다).
   여기서는 그 의원의 행을 읽고 **코호트 평균만 얹는다** (164행 스캔이라 비용이 없다).

   🔴 순위를 내지 않는다. "N명 중 M위" 를 붙이지 않는 이유는 쌍마다 분모가 다르기 때문이다
      (실측 3개 ~ 103개). 표본 크기가 제각각인 값을 한 줄로 세우면 순위가 표본을 재게 된다.
      대신 **코호트 평균 대비 위치**만 준다.

   ⚠️ `denom < 11` 인 행도 내려보낸다 — 화면에서 건수는 보여주되 **비율만 감춘다**.
      아예 빼면 "이 위원회는 왜 안 보이지" 가 되고, 비율을 보여주면 100% 인플레이션이 나간다
      (근사 소속기간 2개월 미만 구간 중앙값이 100%다). */
SELECT cs.dept_nm
     , cs.job_res_nm
     , cs.spoke
     , cs.denom
     , cs.chair_meetings
     , cs.rate
     , cs.in_cohort
     , TO_CHAR(cs.proxy_start, 'YYYY-MM-DD')                    AS proxy_start
       /* 🔴 코호트에서 왜 빠졌는지. MV 의 `in_cohort` 는 4개 조건을 뭉친 불리언이라
          "분모가 얇아서" 와 "장관이라서" 를 구분하지 못한다. 그런데 화면 처리가 정반대다 —
          얇은 건 **비율을 감추고**, 장관은 **비율은 보여주되 평균과 겨루지 않는다**.
          실측 (분모 11+ 인데 코호트 밖 10쌍): 위원장 6쌍 평균 53.7% / 장관·의장단 4쌍 평균 37.2%.
          장관 쪽만 눈에 띄게 낮은데, 상임위 활동이 줄어드는 게 당연한 자리라 그대로 두면
          "게으르다" 로 읽힌다. */
     , CASE
         WHEN NOT p.active_yn                                  THEN 'retired'
         WHEN EXISTS (SELECT 1 FROM politician_titles t
                       WHERE t.mona_cd = cs.mona_cd
                         AND t.category IN ('국무위원', '의장단')) THEN 'office'
         WHEN cs.job_res_nm = '위원장'                          THEN 'chair'
       END                                                      AS excluded_reason
       /* 화면 문구에 쓸 실제 직위 (예: '국무위원' / '의장단') */
     , (SELECT STRING_AGG(t.title, ' · ' ORDER BY t.title)
          FROM politician_titles t
         WHERE t.mona_cd = cs.mona_cd
           AND t.category IN ('국무위원', '의장단'))              AS office_title
       /* 코호트 통계 — 매 행에 같은 값이 실린다. 행이 1~3개뿐이라 별도 왕복보다 싸다. */
     , (SELECT ROUND(AVG(rate), 0) FROM politician_committee_speech WHERE in_cohort)::int
                                                                AS cohort_avg
     , (SELECT COUNT(*) FROM politician_committee_speech WHERE in_cohort)::int
                                                                AS cohort_size
       /* 상임위 여부 — 특위는 한시 조직이라 회의 리듬이 다르다. 화면에서 톤을 낮춘다 */
     , (cs.dept_nm LIKE '%특별위원회%')                          AS is_special
  FROM politician_committee_speech cs
  JOIN politicians p ON p.mona_cd = cs.mona_cd
 WHERE cs.mona_cd = $1
 ORDER BY (cs.dept_nm LIKE '%특별위원회%')
        , cs.denom DESC
        , cs.dept_nm
