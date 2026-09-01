/* 지표별 건수 — 탭 숫자. 0건인 지표도 탭에 보여야 하므로 화면이 빈 값을 0 으로 채운다 */
SELECT metric, COUNT(*)::int AS n FROM anomaly_cards GROUP BY metric
