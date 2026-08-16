/* 인스타 카드 "그날의 숫자" 장 — 비교 기준선
   $1: 카드 날짜 (YYYY-MM-DD)

   표지에 이미 29 / 20 / 341 이 있는데 2번 장이 같은 숫자를 다시 크게 쓰기만 해서
   "새로 얻는 게 없다" 는 지적을 받았다 → 2번 장은 **비교가 있는 숫자**로 바꾼다.
   비교값도 AI 가 아니라 SQL 산출이어야 한다 (이 배치의 원칙).

   기준 구간: 카드 날짜 −3일 이전의 **최근 30 평일**.
     ⚠️ −3 인 이유 — 원천이 1~2일 늦게 들어온다 (INGEST_LAG_DAYS 와 같은 판단).
        최근 며칠을 분모에 넣으면 아직 안 들어온 날이 0 으로 잡혀 평균을 끌어내린다.
     ⚠️ 주말 제외 — 주말은 예외 없이 0건이라 (실측 34/34) 넣으면 평균이 절반이 된다.
        발의 0건인 평일은 그대로 0 으로 센다 (generate_series 로 채운다) — 진짜 신호다.

   반환 한 행:
     base_days   기준 구간 평일 수 (30 미만이면 서비스 시작 직후 — 화면은 10일 미만이면 비교를 안 낸다)
     base_avg    평일 평균 발의 건수
     days_above  기준 구간에서 이날보다 발의가 많았던 날 수 → 순위 = days_above + 1 */
WITH days AS (
    SELECT d::date AS d
      FROM generate_series($1::date - 60, $1::date - 3, '1 day') d
     WHERE EXTRACT(ISODOW FROM d) < 6
     ORDER BY d DESC
     LIMIT 30
), cnt AS (
    SELECT days.d, COUNT(b.bill_id)::int AS cnt
      FROM days LEFT JOIN bills b ON b.propose_dt = days.d
     GROUP BY days.d
), today AS (
    SELECT COUNT(*)::int AS cnt FROM bills WHERE propose_dt = $1::date
)
SELECT COUNT(*)::int                                   AS base_days
     , ROUND(AVG(cnt.cnt)::numeric, 1)                 AS base_avg
     , COUNT(*) FILTER (WHERE cnt.cnt > today.cnt)::int AS days_above
  FROM cnt, today
 GROUP BY today.cnt
