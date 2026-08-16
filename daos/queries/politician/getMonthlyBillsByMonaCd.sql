/* 정치인 상세 - 월별 대표발의 건수 (2026-08-16 재작성)

   🔴 **최근 12개월 롤링 창을 되돌리지 말 것.** 구 버전은 `generate_series(11, 0, -1)` 로
      최근 12개월만 냈는데, 실측 그 창이 보여주는 건 대표발의 전체의 **38.5%** 뿐이다
      (18,741건 중 7,209건). 나머지 61.5%가 화면에서 아예 사라져 있었다.
      22대 임기는 2024-05~2028-05 라 임기 말에는 창이 전체의 1/4 만 덮게 된다.

   → 전 기간을 월 단위로 내고, **뷰가 연도 탭으로 끊는다** (`월별 표결 참여` 와 같은 방식).
      한 페이지 안에서 두 시계열의 시간 축이 다르면 비교가 안 된다.

   ⚠️ 발의가 **없는 달은 행을 내지 않는다.** 0 으로 채우지 않는 이유는 뷰 주석 참조 —
      "0건 발의" 와 "그 달엔 활동 자체가 없었다" 는 다르게 그려야 한다.
      연도 탭이 1~12월 슬롯을 고정하므로 빈 달은 뷰에서 자연히 빈 칸이 된다.
   ⚠️ 실측 연도 분포: 2024년 6,525건 / 2025년 7,891건 / 2026년 4,325건 (각각 294~301명 발의).

   인자: $1 mona_cd
*/
SELECT TO_CHAR(DATE_TRUNC('month', b.propose_dt), 'YYYY-MM') AS ym
     , TO_CHAR(DATE_TRUNC('month', b.propose_dt), 'MM')      AS mm
     , COUNT(*)::int                                         AS cnt
  FROM bills b
 WHERE b.mona_cd = $1
   AND b.propose_dt IS NOT NULL
 GROUP BY DATE_TRUNC('month', b.propose_dt)
 ORDER BY DATE_TRUNC('month', b.propose_dt)
