/* 의원 연령대 분포 (20대 / 30대 / 40대 / 50대 / 60대 / 70대 이상)
   나이 계산: 현재연도 - 출생연도, 생일 아직 안 지났으면 -1
   → getListWithStats.sql 의 age_bucket 계산과 동일한 공식 사용
*/
WITH ages AS (
  SELECT (
          EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'Asia/Seoul')::date)::int
        - EXTRACT(YEAR FROM birthday)::int
        - CASE WHEN TO_CHAR((NOW() AT TIME ZONE 'Asia/Seoul')::date, 'MMDD') < TO_CHAR(birthday, 'MMDD') THEN 1 ELSE 0 END
       ) AS age
    FROM politicians
   WHERE active_yn = TRUE
     AND birthday IS NOT NULL
)
SELECT COUNT(*) FILTER (WHERE age BETWEEN 20 AND 29) AS age_20s
     , COUNT(*) FILTER (WHERE age BETWEEN 30 AND 39) AS age_30s
     , COUNT(*) FILTER (WHERE age BETWEEN 40 AND 49) AS age_40s
     , COUNT(*) FILTER (WHERE age BETWEEN 50 AND 59) AS age_50s
     , COUNT(*) FILTER (WHERE age BETWEEN 60 AND 69) AS age_60s
     , COUNT(*) FILTER (WHERE age >= 70)             AS age_70plus
     , COUNT(*) FILTER (WHERE age >= 20)             AS total_cnt
  FROM ages
