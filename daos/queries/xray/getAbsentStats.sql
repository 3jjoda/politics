/* X레이 — 표결 불참률 요약 (TOP 15 목록 위에 얹는 결론)
 *
 * 순위표만 있으면 "1위가 83%" 를 보고 국회 전체가 그런 줄 알게 된다.
 * 🔴 결론은 **대부분은 잘 참여하고, 상위 몇 명이 유독 높다**는 것이다.
 * ⚠️ 조건(현직·100회 이상)은 getAbsentRank.sql 과 **같아야** 한다. 어긋나면 순위표와 분모가 갈린다.
 * ⚠️ 불참 사유는 원천이 주지 않는다 (공무 출장·사보임·청가 등). 높은 값 = 태만이 아니다 —
 *    화면 각주가 이걸 반드시 말해야 한다.
 */
WITH per AS (
    SELECT COUNT(*)::float                                              AS total_cnt
         , COUNT(*) FILTER (WHERE bv.vote_result = '불참')::float       AS absent_cnt
      FROM bill_votes bv
      JOIN politicians p ON p.mona_cd = bv.mona_cd
     WHERE p.active_yn = TRUE
     GROUP BY p.mona_cd
    HAVING COUNT(*) >= 100
)
SELECT COUNT(*)::int                                                                            AS total
     , ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY absent_cnt / total_cnt) * 100)::numeric, 1) AS median_pct
     , ROUND((MAX(absent_cnt / total_cnt) * 100)::numeric, 1)                                   AS max_pct
     -- 참여율이 높은 쪽(불참 10% 미만)이 얼마나 되는지 — "대부분은 나온다" 의 근거
     , COUNT(*) FILTER (WHERE absent_cnt / total_cnt < 0.10)::int                               AS low_cnt
     -- 상위 이상치 — 불참 40% 이상
     , COUNT(*) FILTER (WHERE absent_cnt / total_cnt >= 0.40)::int                              AS high_cnt
  FROM per
