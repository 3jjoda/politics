/* X레이 ② 소신 표결 (당론 이탈) — 소속당 다수 입장과 다르게 투표한 비율 TOP 15.

   집계 본체는 materialized view `politician_dissent` 에 있다.
   매 요청 계산하면 bill_votes(177,260행)를 두 번 훑느라 1,410ms 가 걸렸고,
   X레이 14개 쿼리가 병렬이라 이 하나가 TTFB 2.3초를 지배했다.
   → ddl/migrations/2026-08-10-dissent-mv.sql 참조. 갱신은 batch/refreshDissent.js.

   이름·정당·사진은 MV 에 굽지 않고 여기서 JOIN 한다 (299행이라 비용 없음).
   지표 정의(당론 판정·50회 이상 등)는 MV 정의를 볼 것. */
SELECT d.mona_cd
     , p.name
     , p.party_name
     , p.photo_url
     , d.votes_cnt
     , d.dissent_cnt
  FROM politician_dissent d
  JOIN politicians p ON p.mona_cd = d.mona_cd
 ORDER BY d.dissent_rate DESC
 LIMIT 15
