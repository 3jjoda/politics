/* 표결 내역 탭 머리 — **이 의원이 표결한 법안의 발의 정당 분포**.
   결과별(찬성·반대·기권·불참) 분포와 **그 의원 전체 표결의 분포**를 한 번에 낸다.

   🔴 이 쿼리가 있는 이유 (2026-09-01):
      표결 내역에 발의 정당이 없어서 사용자가 법안을 하나씩 열어봤고, **분모를 모르는 채**
      "불참한 게 다 국민의힘 법안" 이라는 인상을 얻었다. 실측은 다르다 —
      본회의 표결 법안 639건 중 국민의힘 발의가 **42.1%** 라 무작위로 열어도 10건 중 4건이고,
      불참이 가장 쏠린 의원조차 57.9%(기저율 대비 +15.8%p)다.
      → 비교 기준을 화면이 먼저 준다. 숫자 옆에 기준선을 두는 이 사이트의 규칙과 같다.

   🔴 분모는 **그 의원이 표결한 것 전체**다 (국회 전체가 아니라). 의원마다 재직 기간이 달라
      표결 모수가 다르므로, 같은 사람 안에서 비교해야 "쏠렸다" 가 성립한다.

   인자: $1 mona_cd
   ⚠️ 대표발의자가 없는 위원장 대안 등은 `party` 가 NULL 이다 — 화면이 `대표발의자 미상` 으로 묶는다.
*/
WITH base AS (
  SELECT bv.vote_result, bp.party_name AS party
    FROM bill_votes bv
    LEFT JOIN bills b        ON b.bill_id = bv.bill_id
    LEFT JOIN politicians bp ON bp.mona_cd = b.mona_cd
   WHERE bv.mona_cd = $1
)
SELECT COALESCE(party, '대표발의자 미상')                       AS party
     , COUNT(*)::int                                            AS total_n
     , SUM((vote_result = '찬성')::int)::int                     AS agree_n
     , SUM((vote_result = '반대')::int)::int                     AS oppose_n
     , SUM((vote_result = '기권')::int)::int                     AS abstain_n
     , SUM((vote_result = '불참')::int)::int                     AS absent_n
  FROM base
 GROUP BY 1
 ORDER BY total_n DESC
