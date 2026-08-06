# 정치 바로미터 — 작업 이력
> 시간 역순 (최신이 위). 의미 있는 리팩토링·기능 추가만 기록.
> 현재 상태: [CLAUDE.md](./CLAUDE.md)
> 앞으로 계획: [ROADMAP.md](./ROADMAP.md)

---

## 2026-08-06 — DB 기본 타임존 KST + 타임존 규칙 단순화

SQL 에디터에서 `timestamptz` 가 `+00` 으로 보여 읽기 어렵다는 문제에서 출발. 저장된 값은 원래 정확하므로(절대 시각) **표시 기본값만** 바꿨다.

### DB 기본 타임존
- `ALTER DATABASE postgres SET timezone TO 'Asia/Seoul'` (`ddl/migrations/2026-08-06-db-timezone-kst.sql`, 프로덕션 적용)
- ⚠️ `pg_db_role_setting` 에만 남는 **데이터베이스 속성**이라 프로젝트를 새로 만들면 사라진다. Supabase 리전 이전 시 재실행 필요 — 빠뜨려도 에러가 없고 모든 시각이 조용히 9시간 밀린다. [ROADMAP.md](./ROADMAP.md) 해당 항목에 경고 등재

### 규칙 단순화 — "저장만 명시, 조회는 그냥"
2026-08-04 에 조회·저장 양쪽 모두 명시 변환을 넣었으나, DB 설정이 생기면서 조회는 불필요해져 걷어냈다.
- **조회 16곳 제거** — `daos/queries/` 의 `TO_CHAR(... AT TIME ZONE 'Asia/Seoul', ...)` 6곳, `(NOW() AT TIME ZONE 'Asia/Seoul')::date` 10곳 → 평범한 `TO_CHAR` / `CURRENT_DATE` 로 복귀
- **저장 5곳 유지** — `batch/syncPoliticians.js` 의 정당 이력 `start_date`/`end_date`
- 근거: 실패 방식이 다르다. 조회가 틀리면 화면에 보이고 설정 한 줄로 복구되지만, 저장이 틀리면 **하루 어긋난 날짜가 영구 저장**되고 나중엔 틀린 줄도 알 수 없다
- 검증: 세션 tz 를 UTC/KST 로 바꿔가며 비교 → 게시글 시각·의원 연령대 분포 동일. 수정한 조회 쿼리 11개 EXPLAIN 통과, `/community`·`/politician`·`/xray` 200

### 유지되는 것
- Node 쪽 `utils/datetime.js`(`Intl` + `timeZone` 명시)와 `PB.timeAgo`(`+09:00` 부착)는 그대로 — DB 타임존과 무관하게 **실행 환경 타임존**을 타는 문제라 계층이 다르다
- `TZ=Asia/Seoul` 환경변수도 유지 (안전망)

---

## 2026-08-05 — 의원 교차 표결 성향 (당을 보고 투표하나, 법안을 보고 투표하나)

의원 상세 "표결 성향" 카드의 `찬성 95.7%` 가 정보량이 거의 없다는 문제에서 출발. 본회의에 올라오는 법안은 이미 위원회를 통과해 대부분 압도적으로 가결되므로, **비교 기준 없는 찬성률은 높은지 낮은지 판단이 안 된다.**

### 지표
**자당 발의 법안 찬성률 − 타당 발의 법안 찬성률 = 격차(%p)**

구현 전 데이터로 변별력을 먼저 검증했고, 실측 분포가 최소 -1.2 / 중앙값 3.4 / 최대 30.9 %p (표준편차 4.81) 로 충분히 갈렸다.
- 강선영(국힘) 97.0 vs 66.1 → 격차 **30.9%p**
- 안도걸(민주) 98.8 vs 100.0 → 격차 **-1.2%p** (타당 법안에 오히려 더 찬성)
- 윤준병(민주) 99.7 vs 91.0 → 격차 8.7%p, 266명 중 42위. **반대·기권 25건 중 24건(96%)이 타당 발의** — 기존 "반대 0.5%" 로는 안 보이던 사실

### 설계 판단
- **불참 제외** — 모수에 넣으면 출석률 낮은 의원의 찬성률이 같이 깎여 "당 성향" 과 "성실성" 이 섞인다
- **백분위 동반** — 격차 숫자 단독으로는 크기를 못 가늠한다. 중앙값 + 순위를 같이 노출
- **정당색 미사용** — 자당 골드 / 타당 회색, 명도로만 구분. 무소속·소수정당도 같은 UI 로 처리 (브랜드 중립성 원칙)
- **단정 회피** — 정당별 평균 격차가 민주 2.5 / 국힘 7.4 로 갈리는데 다수당 의사일정 구조 차이가 섞여 있다. 해석 주의 문구를 UI 에 명시 (ANALYSIS/BALANCEGAME 의 "객관 아닌 투명" 기조)
- **폴백** — 자당/타당 표결이 하나라도 0이면 블록 미렌더(무소속 등), 50건 미달이면 순위만 숨김

### 의원 목록 필터·정렬 (같은 날 추가)
일치도 필터와 같은 패턴으로 목록에서 바로 찾을 수 있게 확장. **"정말 법안 보고 투표하는 의원 찾기"** 가 목록 단계에서 가능해짐.
- `#pol-gap-filter` 5옵션 (`법안 중심 2%p 미만` ~ `매우 뚜렷 10%p 이상`) + 정렬 `gap-desc`/`gap-asc`, URL 키 `gap` 영속화
- 일치도 필터와 달리 **성향 진단 없이도 사용 가능** — 객관 데이터라 로그인·게임 완료 조건이 없다
- 검증: `?gap=gte10&sort=gap-desc` → 27명(강선영 30.9 ~), `?gap=lt2&sort=gap-asc` → 95명(안도걸 -1.2 ~). 값 없는 43명은 정렬 시 최후미

### 성능 — materialized view 로 사전 계산
목록에 붙이려면 299명 전원의 격차가 필요한데, 매 요청 집계하면 목록 쿼리가 **88ms → 180ms**. `bill_votes`(177,260행)가 계속 늘어 시간이 갈수록 나빠지는 구조라 MV 로 분리했다.
- `politician_cross_party_vote` MV 신규 (`ddl/migrations/2026-08-05-cross-party-vote-mv.sql`, 프로덕션 적용 완료)
- `batch/refreshCrossPartyVote.js` — `REFRESH ... CONCURRENTLY` 0.4초. `batch:daily` 체인의 syncVotes 다음에 삽입
- 결과: 목록 쿼리 **92ms** (변경 전 88ms 수준으로 복귀). 상세 쿼리는 MV 를 읽어 중앙값·순위만 얹음
- 별도 배치 스크립트 대신 MV 를 택한 이유 — 순수 집계라 `REFRESH` 한 줄이면 끝나고, 값이 하루 1회만 바뀐다

### X레이 ③ 「당을 보나, 법안을 보나」 (같은 날 추가)
개인 순위("266명 중 42위")가 **어떤 분포 위에서 나온 등수인지** 보여주는 배경. 상세 카드 → 목록 필터 → 전체 분포로 이어지는 3단 구성이 완성됐다.
- `getCrossPartyGapDist.sql` (2%p 폭 17구간 히스토그램) + `getCrossPartyGapStats.sql` (사분위·정당별 평균) 신규. 둘 다 MV 를 읽어 300행 스캔
- `XrayService.buildGapDist()` — 빈 버킷 채우기(안 채우면 분포 모양이 왜곡됨) + 요약 통계 가공
- 히스토그램에 **중앙값 점선** 오버레이, 10%p 이상 구간만 진하게 (①합의 분포의 90% 강조와 같은 패턴)
- 노출 수치: 중앙값 3.4%p · 2%p 미만 100명(37.6%) · 10%p 이상 29명(10.9%) · 범위 -1.2~30.9
- **정당별 평균(국힘 7.4 / 민주 2.5)에 해석 주의 문구 병기** — 다수당은 자기 법안이 무난히 통과되는 의사일정 구조라 격차가 낮게 나온다. 이 문구 없이 숫자만 두면 중립성 원칙에 어긋난다
- 섹션이 하나 늘어 기존 03~10 → 04~11 재번호 (`SECTIONS` 배열 + `.xr-no` 라벨)

### 변경
- `daos/queries/politician/getCrossPartyVoteByMonaCd.sql` 신규
- `PoliticianDao` / `PoliticianService` / `PoliticianController` 배선
- `views/politician/politician_detail.ejs` — `.cpv-*` 블록 + 스타일 (이 페이지는 CSS 가 EJS 인라인)
- `views/politician/politician.ejs` — 목록 격차 필터·정렬, 카드 `data-gap`
- `daos/queries/politician/getListWithStats.sql` — MV LEFT JOIN, `cpv_gap` 노출
- `batch/refreshCrossPartyVote.js` 신규 · `package.json` `batch:daily` 체인에 삽입
- `daos/queries/xray/getCrossPartyGapDist.sql` · `getCrossPartyGapStats.sql` 신규 · `XrayDao`/`XrayService`/`views/xray/xray.ejs`
- `.claude/launch.json` 신규 — 미리보기용 (`npm start` + `autoPort`, 포트 3000 점유 회피)

`/xray` 의 당론 이탈·초당 협력과 축이 달라 중복 아님 — 상세는 [CLAUDE.md](./CLAUDE.md) 참조.

---

## 2026-08-04 — 배치 증분화 + 실행 기록 (크론 등록 준비)

수동 실행 실측: syncPoliticians 24.8초 / syncBills 82.6초 / syncVotes 76.1초 = 약 3분 5초, 일 API 호출 약 5,900건. 크론 등록 전에 호출 낭비와 테이블 churn 을 정리.

### 1. syncVotes 전건 재스캔 → 증분 (`batch/syncVotes.js`)
- 이전: `proc_result_name IS NOT NULL` 법안 4,541건을 매 실행마다 API 호출. 실제 표결이 있는 건 **598건뿐 — 호출의 87%가 빈 응답**
- 이후: `AND (vote_synced_at IS NULL OR updated_at > vote_synced_at)` — 미스캔 + 마지막 스캔 이후 변경분만
- 조회 성공한 법안만 `bills.vote_synced_at = NOW()` 기록 → API 실패분은 다음 실행에서 자동 재시도
- `--full` 플래그로 전건 재스캔 유지 (드리프트 보정, 주 1회 권장)
- 마이그레이션 직후 첫 실행은 `vote_synced_at` 이 전부 NULL 이라 기존과 동일한 전건 스캔 → baseline 확보 후 다음 실행부터 감소

### 2. bills 전건 UPDATE 제거 (`batch/syncBills.js`)
- `ON CONFLICT DO UPDATE` 에 `IS DISTINCT FROM` 가드(`BILL_CHANGED_GUARD`) 추가 — 이전엔 변경 여부와 무관하게 18,558행 재기록, **dead tuple 하루 18k**
- `DO UPDATE SET` 이 건드리는 4개 컬럼(`bill_name`/`proc_result_name`/`committee`/`committee_id`)만 비교
- 부수효과: `bills.updated_at` 의 의미가 "배치 실행 시각" → "법안 실제 변경 시각" 으로 바뀜. **이게 1번 증분 조회의 신호**가 되므로 두 변경은 한 쌍

### 3. batch_runs 테이블 + nav 배지 소스 이관
- `utils/batchRun.js` — `startBatchRun` / `finishBatchRun`. 기록 실패가 본작업을 막지 않도록 예외를 삼킴
- sync 배치 3종에 배선. `status`(running/success/failed) + `stats` JSONB + `duration_ms` + `error`
- `utils/dataFreshness.js` — `MAX(bills.updated_at)` → `MAX(batch_runs.finished_at)` (syncBills 성공분). 2번 때문에 `bills.updated_at` 이 배치 실행 시각을 더 이상 보장하지 않음. `batch_runs` 가 비면 기존 쿼리로 COALESCE fallback
- 부수 효과: 배치가 최상위 catch 에서 로그만 남기고 exit 0 으로 끝나 cron 이 실패를 못 잡던 문제를 DB 쪽에서 추적 가능

### 문서 수치 갱신
의원 295→299명, 법안 16,817→18,558건, 발의자 217,568→238,895건, 표결 144,943→177,260건

### 4. 크론 배포 준비
- `package.json` 에 `batch:daily` / `batch:full` 스크립트 추가 — 실행 순서(의원→법안→표결→축계산→그룹평균)를 저장소에 고정. Railway Start Command 는 이걸 부르기만 함
- Railway Cron 서비스 **1개**로 배포 (웹과 분리, GitHub repo 연결). UTC 기준이라 `0 19 * * *` = 04:00 KST
- **표결 페이지 누락 자동 복구**: `fetchAllVotesForBill` 이 `{items, complete}` 를 반환하도록 변경. 페이지 일부를 못 받으면 `vote_synced_at` 을 찍지 않아 다음 실행에 재시도된다 (표결 1건 = 평균 3페이지, 한 페이지 누락 = 의원 100명 표결 통째 누락). 이 덕분에 주간 전건 재스캔 크론 서비스가 불필요해져 **서비스 2개 → 1개**
- ⚠️ `railway.json` 을 repo 루트에 두지 말 것 — 웹 서비스가 같은 루트를 읽어 `cronSchedule` 을 물려받으면 사이트가 크론 잡으로 바뀜

### 5. 배치 멈춤 방어 (`utils/watchdog.js`)
- Railway 크론은 멈춘 배포를 자동으로 죽이지 않는다 → 배치가 매달리면 이후 실행이 영구 스킵되고 컨테이너가 24시간 과금된다. 크론 환경에서 유일한 실질 비용 리스크
- sync 배치 3종에 타임아웃 워치독 (bills·politicians 15분 / votes 20분, 측정치 30~90초 대비 10배 이상 여유). `unref()` 로 정상 완료는 방해하지 않음 — 증분 실행 1.6초 종료 확인
- `syncPoliticians.js` axios 호출에 누락돼 있던 `timeout: 15000` 보강 (bills·votes 는 원래 있었음). 체인 첫 배치라 여기서 매달리면 전체가 막힘

### 6. 정적 자산 캐시 헤더 (`app.js`)
- `express.static('public')` 에 옵션이 없어 serve-static 이 `Cache-Control: public, max-age=0` 을 보내고 있었다 → Railway CDN 이 이 헤더를 존중해 매 요청 origin 재검증, 브라우저도 페이지 이동마다 정적 파일 전부를 304 왕복
- `{ maxAge: '1h' }` 추가 → `public, max-age=3600` 확인. Railway CDN Caching 을 켠 효과가 실제로 나게 됨
- 자산 파일명에 해시가 없어(`main.css`/`interactions.js`) 1시간으로 제한. 더 늘리려면 `layout.ejs` 링크에 `?v=` 버전 쿼리 선행 필요
- Railway CDN 설정: **HTML Caching = Never 필수** — nav 에 로그인 상태·닉네임이 SSR 로 박히므로 HTML 을 엣지에 캐시하면 다른 사용자 화면이 노출된다

### 7. 타임존 전면 정리 (크론 등록 중 발견)
`batch_runs` 시각이 UTC 로 보이는 걸 확인하다가, DB 세션(UTC)과 Railway 컨테이너(UTC) 양쪽에서 한국시간이 어긋나고 있던 걸 발견. **로컬 개발이 윈도우 KST 라 로컬에서는 절대 재현되지 않던 버그.**

- **저장** — `syncPoliticians.js` 의 `CURRENT_DATE` 5곳 → `(NOW() AT TIME ZONE 'Asia/Seoul')::date`
  - 크론이 04:00 KST(=19:00 UTC 전날)에 돌아 **정당 이동 이력 날짜가 항상 하루 이르게** 기록되던 상태. 크론 등록으로 상시화될 뻔함
- **조회 — `TO_CHAR` 가 UTC 세션 기준이라 9시간 어긋남** (4파일 6곳): 댓글 `created_at`/`updated_at`, 게시글 목록·상세, 내 분석요청
- **조회 — `CURRENT_DATE` 8곳**: 법안 경과일, 월별 추이 2, 의원 나이 3, 의원별 법안·월별 2
- **표시** — `utils/datetime.js` 신규 (`fmtDate`/`fmtDateTime`/`timeAgo`, `Intl` + `timeZone` 명시). `app.js` 에서 `app.locals` 전역 등록
  - `profile.ejs` 가 `Date.getFullYear()/getHours()` 로 직접 조립하고 있었음 → 서버 TZ(UTC)를 타서 새벽 가입자의 가입일이 하루 전으로 표시
  - 커뮤니티 목록·상세는 **상대시간**으로 전환 (원본 시각은 `title` 툴팁). `PB.timeAgo` 와 동일한 7일 컷오프
  - `PB.timeAgo` — 오프셋 없는 KST 문자열에 `+09:00` 을 붙여 파싱하도록 수정 (해외 접속자 대응)
- **검증**: `TZ=UTC` 로 실행해 Railway 환경 재현 → `fmtDate(2026-08-04T16:00Z)` = `2026.08.05` (기존 방식은 `2026.08.04`). 수정한 SQL 11개 파일 EXPLAIN 통과, `/community` 렌더 확인
- 규칙은 [CLAUDE.md](./CLAUDE.md) "날짜·시간 처리 규칙" 에 정리 — `timestamptz`+`NOW()` 는 조치 불필요, 달력 날짜만 명시 필요

### 8. 누락 환경변수 발견 (Railway 웹 서비스)
- `BASE_URL` 미설정 → `og:url`/`og:image` 가 `http://localhost:3000` 으로 폴백. **SNS 공유 썸네일이 깨진 상태**. `passport.js` 의 OAuth `callbackURL` 도 상대경로
- `NODE_ENV` 미설정 → 세션 쿠키 `secure` 플래그 미적용
- 둘 다 [ROADMAP.md](./ROADMAP.md) "오픈 당일 인프라 체크리스트" 에 등재

### DDL
`ddl/migrations/2026-08-04-batch-incremental.sql` — **2026-08-04 프로덕션 적용 완료**. 적용 후 3배치 실행 검증: syncBills 변경 0건(이전 18,558행 전건 UPDATE), syncVotes baseline 4,541건 마킹 후 재실행 시 조회 생략(77초→0.1초, 4,541콜→0콜)

---

## 2026-07-29 — 개인정보처리방침·이용약관 + footer 링크 정리 (AdSense 준비 1단계)

### 1. 법적 페이지 2종 (ROADMAP 베타 필수 6번 해소)
- `/privacy` (`views/privacy.ejs`) — 실제 데이터 흐름 기준 작성: OAuth 항목·닉네임/성별/연령대, 세션 쿠키, 탈퇴 시 익명화(성별·연령대 통계 보존), 위탁 인프라(Supabase·Railway·OAuth), Claude API 는 법안 원문만 전송(개인정보 X), 광고 쿠키 조항(AdSense 대비 선반영)
- `/terms` (`views/terms.ejs`) — AI 분석·성향 진단 면책(참고 자료, 법적 효력 없음), 게시물 책임·금지행위, 공공데이터 출처, 광고의 정치적 중립 무관 조항
- 시행일 2026-07-29. 문의처 3jjoda@gmail.com

### 2. footer `#` 링크 전부 해소 (`layout.ejs`)
- 데이터 출처 → 열린국회정보포털(새 창) / 피드백 → `/community` / 개인정보처리방침 → `/privacy` / **이용약관 추가** → `/terms`

### 남은 AdSense 절차 (운영자 액션)
1. 자체 도메인 구입 + Railway 커스텀 도메인 연결 (호스팅 서브도메인은 애드센스 등록 불가)
2. 애드센스 계정 신청 → layout.ejs head 에 코드 삽입 + `public/ads.txt`
3. 승인 후 광고 차단 설정에서 정치·선거 카테고리 차단 (중립성 보호)

---

## 2026-07-29 — 국회 X레이 메뉴 (시각화 10종 1차)

전부 넣고 눈으로 확인 → 불필요한 것 제거 + 아이디어 확장하는 방식으로 시작. ROADMAP 16번(시각화 5종)을 10종으로 확대 구현.

### 구성 (`/xray`, nav "X레이")
1. **국회는 얼마나 싸우는가** — 법안별 찬성률 20구간 히스토그램 + 합의(90%+)/대치(70%미만) 비율 스탯
2. **소신 표결** — 소속당 다수와 다르게 투표한 비율 TOP 15 ("이탈≠나쁨" 카피 명시)
3. **발의왕 vs 입법왕** — 대표발의 건수 × 가결률 산점도 (중앙값 십자선, 상위 라벨)
4. **법안 생존율** — 발의→처리→가결 깔때기 + 위원회 처리율 TOP/BOTTOM 5
5. **초당적 협력** — 다정당 공동발의 비율 스탯 + 타당 서명 비율 TOP 10
6. **주도자 vs 서명러** — 공동발의 × 대표발의 산점도
7. **표결 불참률** — TOP 15 (사유 미구분 디스클레이머)
8. **시민 vs 국회** — 시민 찬반 vs 본회의 찬성률 격차 TOP (자체 데이터, empty state 완비)
9. **같은 당, 다른 생각** — 4축 좌표 정당별 도트 스트립, 축 선택 칩 (클라이언트 렌더)
10. **국회의 관심사** — AI 카테고리 16종 가로 막대 (커버리지 편향 명시)

### 구현
- `daos/queries/xray/` 12개 집계 SQL (FILTER·width_bucket·LAG 등 PostgreSQL 순정) + `XrayDao`/`XrayService`/`XrayController`
- 차트는 라이브러리 없이 서버 EJS 인라인 SVG/CSS (index.ejs 월별 추이와 동일 패턴). ⑨만 JSON 주입 + 클라이언트 렌더
- 색: 골드 단일 + 차콜 + 그레이 (정당색·political 색 미사용). 모든 섹션에 집계 방식·한계 각주
- 모든 랭킹 행은 의원 상세로, 시민 괴리는 법안 상세로 링크
- nav "법안"과 "성향 진단" 사이 "X레이" 추가 (데스크톱 + 모바일 패널)

### 알려진 한계 (각주로 명시)
- 당적은 현재 기준 (표결 당시 당적 미반영 — 이력 테이블로 개선 여지)
- 불참 사유 미구분 / ⑨ 매핑 48건 표본 / ⑩ 분석 커버리지 편향

---

## 2026-07-29 — 홈 "최근 정당 이동" 섹션

### 1. 데이터
- `daos/queries/politician/getRecentPartyMoves.sql` 신규 — `politician_party_memberships` 에 LAG 윈도우로 이전 정당을 붙여 "언제 A당 → B당" 형태로 조회 (같은 정당 재기록은 제외)
- `PoliticianDao.getRecentPartyMoves(limit)` / `PoliticianService` / `InitController.getHomePage` Promise.all 에 추가 (기본 10건)

### 2. UI (`views/index.ejs`) — 카드 캐러셀 (2차: 리스트 → 카드 전환, 3차: 히어로 직하로 이동)
- 위치: **히어로(KPI) 바로 아래** 독립 `pb-section.pm-section` (패딩 36px 컴팩트) — 첫 화면에서 바로 보이는 티커 역할
- 카드(168px, 모바일 140px): **상단 정사각 사진**(aspect-ratio 1/1, 상단 기준 크롭, 사진 없으면 이니셜) + 하단 텍스트 블록(이름 · `A당 → B당` · 감지일) — 의원 상세로 링크
- **자동 슬라이드**: 카드가 한 화면을 넘칠 때만 원본 한 벌 복제(aria-hidden) 후 CSS 무한 marquee (~35px/s). hover/focus 시 정지, `prefers-reduced-motion` 시 애니메이션 없이 가로 스크롤
- ⚠️ `avatarHtml` 의 img 는 `width:100%;height:100%` 라 **래퍼에 고정 크기 필수** (`.pm-avatar 48px`) — 1차 구현에서 크기 미지정으로 사진 거대화 버그
- **정치색 회피**: 정당색 미사용, 강조는 골드 화살표만. 이동 0건이면 섹션 자체 미노출
- 하단 주석: "수집 시점 기준 · 이동 사유는 공공 API 미제공" 디스클레이머

### 한계 (알고 있는 것)
- `start_date` 는 배치 실행일 기준이라 실제 이동일과 다를 수 있음 (배치를 오래 안 돌리면 몰아서 같은 날짜로 기록)
- 이동 사유(탈당·합당·제명)는 저장 구조 없음 — 필요 시 `politician_status_history` 설계 검토

---

## 2026-07-29 — 문서·배치 정리

### 1. README.md 전면 갱신
- 구버전 스택 표기(AWS RDS MySQL·EC2·Bootstrap) → 실제 상태(Supabase PostgreSQL·Railway·Passport·Claude API)로 교체
- 주요 기능(AI 법안 분석 5-Zone·밸런스 게임·국민 참여), 현재 디렉토리 구조, md 문서 9종 안내 표 추가
- 환경 변수를 현행 `.env` 키 기준 플레이스홀더로 정리 (구 RDS 엔드포인트 제거)

### 2. 폐기 배치 파일 삭제
- `batch/topicUpdate.js`, `batch/updateByCommittee.js` (폐기 기록됨) + `_syncBills.js`, `_topicUpdate.js` (백업본) 4개 저장소에서 제거
- `batch/` 에는 실사용 11개만 유지

### 3. 배치 실행 순서 문서화 (CLAUDE.md)
- 정기 갱신 순서(의원 → 법안 → 표결 → 그룹 평균) + 조건부·일회성 배치 트리거 표 추가
- Node 22 필수 명시 — Node 18 실행 시 undici 7 이 전역 `File` 부재로 `ReferenceError: File is not defined` (실제 발생 사례)

---

## 2026-04-27 — 법안 상세 정리·버그 수정 (Zone 6/7/Jumpbar)

### 1. 우측 sticky 인덱스
- **활성 표시 안 됨 → 수정**: IntersectionObserver(`-100/-50%` 좁은 활성 띠) 가 짧은 마지막 섹션을 못 잡던 문제 → **스크롤 기반 트리거**로 교체. DOM 순회로 `top <= triggerLine` 인 마지막 섹션을 active 로 표시 + 페이지 끝 도달 시 마지막 섹션 강제 활성화
- **위치 너무 우측 → 수정**: `right: 32px` → `left: min(calc(50% + 480px), calc(100% - 232px))` 로 콘텐츠 우측에 밀착, 좁은 화면 클램프
- **5-Zone 동적 주입 대기**: 인덱스 setup 이 `mountBillAnalysis` 의 동적 DOM 주입을 기다리도록 retry (최대 3초)
- **그룹별 좌측 가이드 1px 라인** 부활 + 도트 라인 위로 올라타게 (`left: -5px` + 점 안쪽 `--bg` 채움)
- **도트 좌측 잘림 → 수정**: `overflow-y: auto` 가 x 도 clip 하는 브라우저 동작 회피용 `padding-left: 8px`

### 2. 클릭 스크롤 오프셋 동적화
- 고정 80px → `getScrollOffset()` = `--nav-h + 20` (데스크톱 120 / 모바일 80)
- 5-Zone 섹션 헤드라인이 nav 뒤로 가리던 문제 해결. 트리거 라인도 동일 값 사용으로 일관성

### 3. Zone 7 챕터 디바이더 정리
- 좌우 캡션 (`02 정독 끝` / `03 당신의 차례 →`) **제거** — 페이지에 01 마커가 없어 출처 불명. 헤딩 + 서브텍스트만 남김

### 4. 모바일 floating jump bar 가시성 변경
- **항상 표시** (스크롤 방향 감지 로직 폐기)
- 키보드 올라올 때만 숨김: `focusin`/`focusout` 이벤트 위임으로 input/textarea/contenteditable 포커스 시 `data-visible="false"` (visualViewport 휴리스틱은 모바일 URL bar 자동 토글에 오작동해서 폐기)
- focusout 시 `setTimeout(0)` 으로 activeElement 재확인 — 입력 간 전환 깜빡임 방지
- iOS 홈 인디케이터 보호: `bottom: max(16px, env(safe-area-inset-bottom, 16px))`

### 5. Jumpbar footer 흡수 버그 수정
- 원인: `.pb-main { position: relative; z-index: 1 }` 가 자체 stacking context 생성 → jumpbar 의 z-index 60 이 main 내부에서만 의미. body 레벨에서 footer (z-index 1) 가 DOM 후순위라 위로 그려져 흡수
- 수정: 페이지 로드 직후 `document.body.appendChild(jumpbar)` 로 body 직속 이동 → main stacking context 탈출

### 6. Jumpbar 노출 범위 확장
- `max-width: 767px` → `max-width: 1239px` — Fold 펼친 상태(~800px), 작은 노트북, 태블릿까지 커버
- `.bd-wrap padding-bottom: 84px` 도 같은 범위에 적용 (jumpbar 가 콘텐츠 가리지 않게)
- 결과: ≥1240 sticky 인덱스 / 768~1239 jumpbar / <768 jumpbar — 모든 폭에서 nav 보장

### 7. 발의자 스택 접기 버그 수정
- 원인: `.ba-proposers-grid { display: grid }` 가 브라우저 기본 `[hidden] { display: none }` 을 덮어씀 → JS 가 `hidden` 추가해도 안 접힘
- 수정: `data-expanded` 한 곳에서만 제어. `[data-expanded="true"] .ba-proposers-grid { display: grid }` 로 부모 attribute 기반 표시. JS 도 `data-expanded` 만 토글, `hidden` 조작 제거

---

## 2026-04-27 — 발의자 → Zone 1 헤더 컴팩트 스택 통합

발의자는 법안 메타데이터의 일부 → 참여 섹션에서 분리해서 헤더 메타라인 직하로 옮김.

### 1. 위치 이동
- 참여 영역의 `<section id="part-proposers">` 전체 제거
- 우측 sticky 인덱스에서 "발의자" 항목 제거
- Zone 1 메타라인의 "공동발의 N인" 텍스트 제거 (아바타 개수가 그 정보 대체)
- 새 위치: 메타1줄 → 메타2줄(발의일) → **`.ba-proposers` 컴팩트 스택** → `<h1>` 법안명 → `<h2>` 한 줄 요약

### 2. 컴팩트 스택 (`.ba-proposers-bar`)
- 좌측 가로 아바타 스택 (overlap, 대표+9명 까지)
  - 대표 32px, 1.5px 골드 외곽선 + 2px `#F3F1EA` outer glow, z-index 2
  - 그 외 24px, 1.5px `#F3F1EA` 외곽선, marginLeft -6 (겹침)
  - 사진 없으면 이름 첫 글자 (`Pretendard 600 #6B7280`)
  - 호버 시 이름·정당 툴팁
- 가운데 라벨 (`13px / 1.5`):
  - `{대표명} 외 {N}인 · {정당분포}` 포맷
  - 대표명 `--ba-ink + 700` (링크), 외 N인 `#8B8578`, 정당분포 `--ba-meta`
  - 정당분포: 1개 정당이면 "모두 X", 여러 개면 "X 7, Y 3" (count desc)
- 우측 "전체 보기 ▾" 토글 (mono 11px, 0.08em, 골드, dashed underline `#C8A24A`)

### 3. 펼친 카드 그리드 (`.ba-proposers-grid`)
- `display:none → grid` 토글, 5열 grid + dashed bg 컨테이너 (`rgba(255,255,255,0.5)` + `#D9D3C3` dashed)
- 카드: 흰 배경 / 1px `#E8E5DC` / radius 8 / padding 10·12 / 24px 아바타
- **대표만 1.5px 골드 외곽선** + 이름 옆 `대표` 라벨 (mono 9px, 0.1em, 골드 700)
- 정당명 텍스트만 (10px `#8B8578`) — 정당색 배경/보더 절대 안 씀

### 4. 정치색 회피 원칙 유지
- 헤더 스택, 펼친 카드 모두 정당색 배경/외곽선 사용 금지
- 강조는 `--ba-gold` 한 가지 (대표발의자 표시용)

### 5. 모바일 (≤768)
- 아바타 축소: 대표 28 / 그 외 22, marginLeft -5
- 라벨·"전체 보기" `flex-basis: 100% + order` 로 다음 줄로 떨어뜨림
- 펼친 그리드 5열 → 2열

### 6. 데이터 흐름
- `window.__BILL_PROPOSERS__` JSON 주입 → `mountBillAnalysis(opts.proposers)` 로 전달
- `coProposers` 서버 객체 그대로 매핑: `{mona_cd, name, party_name, photo, is_rep}`

---

## 2026-04-27 — 법안 상세 참여 섹션 디자인 시스템 통합 (Zone 6~11)

### 1. 페이지 레벨 섹션 인덱스 (Zone 6)
- 5-Zone 안에 있던 `.ba-index` 를 페이지 레벨 `.pb-section-index` 로 끌어올림 (`position: fixed; top: nav-h+32; right: 32; width: 200`)
- **두 그룹** 분리 — `AI 분석` (요약/핵심 변화/분석/함께 생각) + `참여` (국민 찬반/본회의 표결/발의자/의견)
- 그룹 라벨: mono 10px / letter-spacing 0.22em / `#A8A095` uppercase
- 항목: Pretendard 12px / 7px 패딩 / 8px 도트 (외곽선 #C8C0AA → 활성 채움 #8F5800 + 4px 글로우)
- 데이터 카운트(찬반·발의자·의견) 우측 정렬, 10px `#A8A095` — 페이지 로드 후 PB.fetch 로 동적 채움
- IntersectionObserver 자동 활성, 클릭 smooth scroll (offset 80)
- 1240px 미만 자동 숨김

### 2. Zone 7 챕터 디바이더 (정독 → 참여)
- `.ba-chapter` — bd-wrap 폭에서 `margin: 120px -40px 48px` 로 살짝 확장
- 상단 1px 보더 + 좌우 캡션 (`02 정독 끝` / `03 당신의 차례 →`, mono 11px)
- 메인 헤딩 Noto Serif 900 / 36px / "이제 당신이 답할 차례입니다"
- 서브 15px `#6B7280` / "법안에 찬반을 표시하고, 다른 시민들의 의견을 읽어보세요"

### 3. 공용 `.pb-part` 컨테이너 (Zone 8~11)
- 배경 `#FAFAF7` / 1px `#E8E5DC` / radius 16 / padding 32
- 헤드: 세리프 700 / 22px (`.pb-part-h`) + 보조설명 13px `#6B7280` (`.pb-part-sub`)

### 4. Zone 8 — 국민 찬반 (정치색 회피)
- `cv-bar` 36 → 12px / radius 6 / 색상 정치 파랑·갈색 → **차콜 #0F1B1F + 골드 #8F5800**
- 막대 안 % 텍스트 제거 → 범례에서 양 끝 정렬로 `찬성 N · X%` / `반대 N · Y%`
- CTA 두 버튼 동일 무게 — 흰 배경 / 1px `#D9D3C3` / radius 10. 활성만 차콜 채움 + 흰 글자
- **이모지 (👍 👎) 제거**, 위치(좌/우) 로만 입장 구분

### 5. Zone 9 — 본회의 표결
- 데이터 없을 때: `.pb-part-empty` italic `#9B9486` "본회의 표결 데이터가 아직 수집되지 않았습니다"
- 데이터 있을 때: 기존 vote-dashboard 4박스. 박스 톤만 흰 배경 + `#E8E5DC` 보더로 통일 (정당색 자체는 객관 데이터라 그대로 유지)

### 6. Zone 10 — 발의자 5열 그리드
- `.pb-proposers-grid` `repeat(5, 1fr)`, gap 8 / 카드 padding 12 / 32px 아바타
- **대표만 1.5px 골드 외곽선** = 대표발의자 시각 표시. **"(대표)" 텍스트 제거**
- 1024px 4열 / 768px 2열

### 7. Zone 11 — 댓글
- 정렬 토글 알약(보더+패딩) → **텍스트 underline 버튼** (활성 골드 underline, 비활성 `#8B8578`)
- 카드 흰 배경 / 1px `#E8E5DC` / radius 10 / padding 16
- 닉네임 700, 시각 12px `#8B8578`, 본문 14px / line-height 1.7
- 좋아요 활성: 골드 `#8F5800`

### 8. 모바일 floating jump bar
- 하단 fixed (`bottom: 16, left/right 16, height 52, radius 26`) + `rgba(15,27,31,0.92)` + backdrop-blur
- 4 핵심 탭 (요약·분석·찬반·의견) + 우측 36px 골드 ↑ 버튼 (페이지 맨 위로)
- 스크롤 다운 시 등장(translateY 0), 업/맨위/풋터 근처에서 숨김
- 1240px 이상 (데스크톱) 숨김

### 9. 제거된 것
- `?` 도움말 아이콘 (제목 옆, 정보가 본문에 충분)
- 찬반 버튼 이모지 👍/👎
- 분석 요청 위젯 헤더/CTA 이모지 🤔 💡 🎉
- "(대표)" 텍스트 라벨 (골드 외곽선으로 대체)

---

## 2026-04-27 — 5-Zone AI 분석 UI 전면 리디자인

### 1. 디자인 토큰 분리
- `.bill-ai-analysis` 스코프에 `--ba-*` 토큰 4계층 (ink/sub/meta/gold) — 정치색(빨강·파랑·초록) 배제, **머스타드 골드 #8F5800 단일 강조색**
- 폰트: Pretendard Variable 추가 (jsdelivr dynamic-subset, layout.ejs preconnect 포함)
- 본문 18px / weight 450 / line-height 1.75 (롱폼 정독)

### 2. 레이아웃 break-out
- bd-wrap(960px) 제약을 깨고 100vw `.ba-shell` (1240px = 180 좌마진노트 + 880 콘텐츠 + 180 우인덱스 거터)
- 콘텐츠 영역 `.ba-content` max-width 880px

### 3. Zone 별 변경
- **Zone 1**: 한 줄 요약 28→**44px**, 박스 제거 → 좌측 4px 골드바 only. 카테고리/읽기/결과 알약 배지 → 텍스트 메타라인 (14px). 이모지 제거
- **Zone 2**: 균등 grid(1·1·1) → **비대칭 8 / 4 / 4**. 좌측 4px 컬러바로 카드 구분 (골드/차콜/그레이). "여기까지 30%" 프로그레스 제거
- **Zone 3**: 토글 아코디언 폐기 → H3 + 본문(펼침 기본). pro/con/gap 배지 제거, 좌측 외부 **마진노트** (mono 12px) 로 카테고리 표시
- **Zone 4** (신규): 우측 sticky 인덱스 (요약/핵심 변화/분석/질문) — IntersectionObserver 활성 강조
- **Zone 5** (옛 Zone 4): 골드톤 박스 제거 → 본문 통합. 번호 배지 채움 → **외곽선만**

### 4. 정치색 배제 원칙
- 빨강/파랑/초록을 입장 라벨에 안 씀
- 위계는 타이포그래피·여백·위치로만 구분
- 강조색은 머스타드 골드 한 가지

### 5. 사용된 옛 CSS
- `.analysis-zone-*`, `.analysis-card`, `.issue-*`, `.judgment-*` 등 옛 클래스는 분석 없는 분기(`.bill-basic-header`)와 공유되는 일부만 유지 — 미사용 dead CSS 는 차후 정리

---

## 2026-04-27 — 마이페이지 (`/my`) v1

### 1. 통합 마이페이지 신설
- 기존: `/my/analysis-requests` 단독 페이지만 존재
- 신규: `/my` 랜딩 페이지 — 4섹션 한 화면
  1. **프로필** — 닉네임 인라인 편집 (PUT `/api/auth/nickname`, 중복체크), provider/이메일/성별/연령대/가입일 read-only
  2. **내 성향 카드** — 4축 좌표 다이아몬드 (220px 정적 SVG, reveal 패턴 축소), 축별 막대그래프, mapping 버전·`computed_at`·총 응답 수 메타. 미완료 시 진단 시작 CTA
  3. **풀이 이력** — 활성 게임팩 전체에 대해 응답 수 `<현재>/<목표문항수>`, 마지막 응답일, 상태 pill (완료/부분/미시작) — 종합팩 우선 정렬
  4. **분석 요청 요약** — 총/완료/대기 카운터 + 최근 3건 링크 + 전체 보기 → `/my/analysis-requests`

### 2. 닉네임 변경 API
- `PUT /api/auth/nickname` — `requireLogin`, body `{ nickname }`
- 검증: 기존 `validateNickname` (2~20자, 한/영/숫/_) + 자기 자신은 no-op 허용 + UNIQUE 충돌 시 409
- DAO 쿼리: `daos/queries/user/updateNickname.sql` — 자기 행만, NOT EXISTS 로 다른 사용자 점유 닉네임 차단

### 3. 풀이 이력 집계 DAO
- `BalanceGameDao.listUserPackHistory(userId, mappingVersion)` 추가
- LEFT JOIN 으로 모든 활성 팩에 응답 수·`MAX(created_at)`·distinct 질문 카운트 집계
- 종합팩 우선 정렬 후 `display_order` 순

### 4. 진입 동선
- 데스크톱 user dropdown 최상단에 "마이페이지" + "내가 요청한 분석" 두 항목
- 모바일 햄버거 패널 `pb-mobile-auth` 영역에도 동일 추가
- 햄버거 버튼은 항상 표시 → 모바일에서 dropdown 자체가 없어졌어도 패널로 진입 가능

---

## 2026-04-26 — "당신과의 비교" 펼침 바디 가운데 정렬 + 중복 제거

### 1. 전체 일치도 박스 제거
- 이전: 바디 하단에 `전체 일치도 53%` 박스
- 이유: 헤더에 이미 "나의 성향 진단과 53% 일치" 큰 골드 수치가 있어 **중복**. 사용자가 "왜 두 번 표시?" 의문
- 처리: `bg-vs-overall` 요소 + CSS 모두 제거. 거리 정보(호버 툴팁)는 헤더 title 에서 표시

### 2. 레이아웃: grid 2열 → flex column 가운데 정렬
- 이전: `grid-template-columns: 320px 1fr` (좌 다이아몬드, 우 축별 해석) — 우측 텍스트가 폭 넓어 시야 분산. "기준 없어 보임"
- 이후: `flex-direction: column; align-items: center` 세로 흐름 + 가운데 정렬
  ```
       [Diamond]
       help text
       [Legend]
   ─────────────────  ← border-top
   [경제]    같은 방향 (둘 다 개입 쪽), 약간 차이
   [사회·문화] ...
   [안보·외교] ...
   [정치제도] ...
  ```
- 다이아몬드 320px 가운데. 축별 해석 max-width 520px 가운데 (좁고 깊게 읽기 쉬움)
- 다이아몬드와 축별 해석 사이 `border-top: 1px var(--border)` 로 시각 분할
- 모바일: gap 14px, 축별 해석 13px 폰트로 컴팩트

### 시각 위계
1. (헤더 — 일치도 % 한 줄, 골드 톤)
2. 다이아몬드 — 시각화로 직관 잡기
3. 축별 해석 — 텍스트로 분해
4. (전체 일치도 박스 제거)

원칙: "헤더 = 결론, 바디 = 분해, 결론 반복 X"

---

## 2026-04-26 — "당신과의 비교" 위치 이동 + 펼침 컴포넌트로 통합

이전 라운드의 "일치도 한 줄 (KPI 행 아래)" + "비교 섹션 (분석 탭 끝)" 분리 구조를 → KPI 행 바로 아래 **단일 펼침 컴포넌트**로 통합. 사용자가 카드의 일치도 보고 진입하면 분해된 상세가 첫 인상이 되도록.

### 위치 변경
- 이전: `[KPI] [일치도 한 줄] [활동 카드] ... [당신과의 비교 섹션 — 끝]`
- 이후: `[KPI] [당신과의 비교 펼침 — 헤더+바디] [활동 카드] [발의 등]`

### 펼침 컴포넌트 (`bg-vs-collapsible`)
**헤더** (항상 노출, 골드 톤 그라디언트):
```
나의 성향 진단과 53% 일치    매핑 v1 →    ▼
```
- 좌측: 일치도 % (큰 골드 22px JetBrains Mono)
- 중앙: 매핑 v1 → 링크 (`stopPropagation` 으로 토글과 분리)
- 우측: ▼ 토글 인디케이터 (펼침 상태에 따라 90도 회전)
- 헤더 호버 시 그라디언트 미세 진해짐. 골드 톤 = "전체 일치도 박스" 디자인 재활용

**바디** (펼친 상태):
- 4축 비교 다이아몬드 (사용자 골드 + 의원 회색 점선)
- 우측 축별 해석 4줄
- 하단 "전체 일치도 N%" 박스
- 라벨 "중심은 중도, 가장자리는 뚜렷한 입장"

### 첫 진입 자동 펼침
- `data-open="true"` 서버 렌더 디폴트
- 사용자가 카드 일치도 보고 클릭해 진입 → 펼침이 자연 첫 인상
- 헤더 클릭 시 토글, max-height 0.3s ease + ▼ 회전 애니메이션
- aria-expanded 동기화 (접근성)

### Fallback (펼침 없음, 헤더만)
- **미완료 유저**: `is-pending` 회색 헤더 → 클릭 시 `/balance-game?next=` 의원 페이지 복귀
  - 텍스트: "성향 진단 후 표시됩니다 / 진단하러 가기 →"
- **미산출 의원** (1명): `is-missing` 회색 헤더 (클릭 비활성)
  - 텍스트: "⚠️ 분석 데이터 부족 / 표결 참여 부족"

### 정리된 컴포넌트
- 폐기: `profile-match-row` (이전 라운드의 일치도 한 줄) + `bg-vs-section` (이전 라운드의 분리 섹션)
- 통합: 두 요소를 흡수한 `bg-vs-collapsible`. 카드 일치도 한 줄과 분해 영역이 하나의 시각 단위
- 본문 컨텐츠 (`bg-vs-body` / `bg-vs-diamond` / `bg-vs-axes` / `bg-vs-overall`) 는 그대로 재사용

---

## 2026-04-26 — "당신과의 비교" 검증 후 보강: 일치도 공식 + 다이아몬드 겹침 + 레이아웃

### 1. 일치도 % 변환 공식 수정 (분모 2 → 1.5)
**문제**: 다이아몬드 거의 안 겹치는 의원도 65% 표시 → 사용자 직관과 어긋남.
**원인**: 옛 공식 `(1 - d/2) × 100` 은 4축 이론 최대 거리 2 기준이지만 실측 분포 [0.61, 1.49]는 최대값 도달 불가 → 모든 일치도가 [25%, 70%] 좁은 범위에 압축.
**해결**: 분모를 1.5 로 → `similarity = max(0, (1 - d/1.5) × 100)`
- d=0.0 → 100% / d=0.61 → 59% / d=1.40 → 7% / d≥1.5 → 0%
- 적용 3곳: `politician.ejs` (카드 배지), `politician_detail.ejs` `profile-match-row` + `bg-vs-overall`

**검증** (안정 유저 기준):
| | 옛 공식 (/2) | 새 공식 (/1.5) |
|---|---|---|
| min~max | 25%~69% | 1%~59% |
| TOP 1 | 권성동 69% | 권성동 **59%** |
| BOTTOM 1 | 김병주 25% | 김병주 **1%** |
| median | 38% | 17% |

→ 정반대 의원이 1~6% 로 정직하게 표시. 가장 비슷한 의원도 절제된 59%. "겹치는 정도 = % 일치도" 사용자 직관 정합.

### 2. 다이아몬드 정치제도 라벨/수치 겹침
**문제**: `dominant-baseline: hanging` 라벨(y=326) 아래 텍스트 높이 11px → 337 까지 차지. 의원 수치(y=342, baseline=alphabetic) 의 텍스트 top 이 331 → **6px 겹침**.
**해결**: 시각 노출 좌표 수치 4개 모두 제거. SVG `<title>` 으로 hover 툴팁 이전:
- 사용자 dot: `<title>나 정치제도 -1.00</title>`
- 의원 dot: `<title>의원 정치제도 -0.57</title>`
- 다이아몬드엔 라벨 4개만 (`안보·외교 / 경제 / 정치제도 / 사회·문화`) — 정확 수치는 점에 마우스 올리면 표시
- 라벨 y 위치도 좀 더 가깝게 (R-30 → R-14, R+32 → R+14) — 마진 정리

### 3. 레이아웃 공백 정리
- `bg-vs-body` gap 32px → 20px
- `bg-vs-axes > div` line-height 1.6 → 1.4, padding 12px → 8px, 첫 줄 padding-top 0, 마지막 줄 padding-bottom 0
- `bg-vs-overall` margin-top 18 → 12, padding 14 → 12
- 다이아몬드 컨테이너 360 → 320px (더 컴팩트, viewBox 360x360 비율 유지)

→ 우측 텍스트와 다이아몬드 사이 가운데 공백 줄어듦. 줄 간격 타이트해서 4축 한눈에 읽힘.

---

## 2026-04-26 — 의원 상세 "당신과의 비교" 섹션 (객관 착시 방지·D 레이어 본체)

의원 카드의 "N% 일치"가 어떻게 나왔는지 4축 분해. BALANCEGAME §1 "객관이 아니라 투명" 정신 적용. 사용자가 일치도 % 를 사실로 받아들이지 않고 매핑 기반 추정치임을 명시.

### 신규 섹션 — 의원 상세 분석 탭 (`#tab-overview` 끝)
1. **헤더**: "당신과의 비교" 제목 + 우측 메타 라벨 `📊 매핑 v1 기준 · 매핑 보기 →` (클릭 시 `/balance-game/mapping`)
   - 호버 툴팁: "매핑이 갱신되면 분석 결과가 달라질 수 있어요"
2. **4축 비교 다이아몬드** (reveal/compare 패턴 재사용):
   - 사용자 좌표: 골드 (`rgba(184,116,12,0.22)` + 골드 보더)
   - 의원 좌표: 회색 (`rgba(122,128,144,0.18)` + 점선 회색 보더, 아래 깔림)
   - 두 polygon + 두 dot 세트 + 의원 좌표 수치 노출 (각 축에 `+0.72` 형태)
   - viewBox 360×360, R=130, 절대값 기반 (강도 시각화)
   - 범례: "나의 좌표 (골드)" / "{name} 의원 (회색 점선)"
3. **축별 해석 4줄** (Noto Serif KR):
   - 강도: `<0.25 거의 같음 / 0.25~0.75 약간 차이 / 0.75~1.25 뚜렷한 차이 / >=1.25 정반대 또는 큰 차이`
   - 방향: 부호 같으면 "같은 방향 (둘 다 {SIDE} 쪽)", 다르면 "반대 방향". 한쪽이 |v|<0.1 이면 "한쪽 중도 근처"
   - SIDE 라벨: economy 시장/개입 · social 전통/자율 · security 동맹/자주 · institution 안정/개혁
   - 예: "같은 방향 (둘 다 안정 쪽), 거의 같음" / "반대 방향, 정반대 입장"
4. **전체 일치도** 한 줄: `전체 일치도 N%` (큰 골드 수치, 호버 툴팁 "4축 거리 N.NN. 매핑 v1 기준.")

### Fallback
- **미완료 유저**: 회색 박스 + "📊 성향 진단 후 표시됩니다" + "진단하러 가기 →" CTA (`/balance-game?next=` 으로 의원 페이지 복귀)
- **미산출 의원** (현재 1명): "⚠️ 좌표 데이터 부족 (표결 참여 부족)" 안내, 다이아몬드 비표시

### 검증
- 안정 유저 (eco 0.20 / soc -1.00 / sec 0.00 / ins -1.00) vs **김미애 (국힘, ins -1.00)**:
  - economy: 같은 방향 (둘 다 개입 쪽), 약간 차이
  - social: 반대 방향, 정반대 입장
  - security: 한쪽 중도 근처, 뚜렷한 차이
  - **institution: 같은 방향 (둘 다 안정 쪽), 거의 같음** ✓ 부호 약속 정확
  - 전체 51% (거리 0.97)
- 같은 유저 vs **강경숙 (조국혁신, ins +0.81)**: 4축 모두 "반대/정반대" → 전체 40% (거리 1.20)

### 반응형
- 데스크톱: 다이아몬드 360px + 축별 해석 1fr 그리드 (좌우 분할)
- 모바일 ≤768px: 1열 (다이아몬드 위, 해석 아래), 다이아몬드 320px

---

## 2026-04-26 — 의원 페이지 일치도 필터·정렬 + URL 영속화 (D 레이어 본체)

배지가 "N% 일치" 한 줄로 정리되면서 진짜 의미 있는 D 레이어 인터랙션은 **필터·정렬**임이 명확해짐. 결 비슷한 의원 발견·정반대 의원 발견 양쪽 다 가능.

### 일치도 필터 드롭다운 (`#pol-match-filter`)
정렬 드롭다운 옆에 신설. 5개 옵션:
- 전체 (기본)
- 70% 이상 / 60% 이상 / 50% 이상 / 50% 미만

### 정렬 옵션 추가 (`#pol-sort`)
기존 `발의/이름/정당`에 추가:
- 일치도 높은 순 (`match-desc`) — 결 비슷한 의원
- 일치도 낮은 순 (`match-asc`) — 정반대 의원 (가치 큼)

### 미완료 유저 처리
- 일치도 필터 select: `disabled` + tooltip "성향 진단 후 활성됩니다"
- 일치도 정렬 옵션: `<option disabled>` (선택 불가)
- URL `?match=` / `?sort=match-*` 파라미터 들어와도 무시 (JS init 단계에서 fallback)

### 좌표 미산출 의원 (1명) 처리
- `data-match-pct=""` (빈 문자열)
- 일치도 필터 적용 시: 모든 모드에서 제외 (필터값 70/60/50/lt50 어느 쪽도 매칭 X)
- 일치도 정렬 시: null 처리 — 항상 마지막 (높은 순/낮은 순 무관)

### URL 영속화 — 모든 state 반영
`loadFromUrl()` / `saveToUrl()` (history.replaceState 클라이언트 사이드, 페이지 reload 없음)
- 키: `party`, `committee`, `elect`, `sex`, `age`, `q`, `sort`, `match`
- 배열은 쉼표 구분, `sort=propose` (기본값) 는 URL 에서 생략
- 새로고침 / 결과 공유 / 뒤로 가기에 필터 상태 유지

### 적용 위치
1. 그리드 뷰 — `data-match-pct` 속성 + JS filter/sort
2. 리스트 뷰 — 동일 패턴
3. 모바일 — 선택 dropdown 은 `.filter-right` 내 항상 노출 (사이드바 시트와 별개)

### 검증 — 안정 쪽 테스트 유저 (Q1 1.03, 일치도 분포 25~70%)
- 필터별 매칭 의원 수:
  - 70% 이상: **0명** (본인 좌표가 외곽이라 정확 일치 의원 없음 — 자연스러움)
  - 60% 이상: **9명** (모두 국힘 추정)
  - 50% 이상: 63명
  - 50% 미만: 231명
- 일치도 높은 순 TOP 5: 권성동·김석기·김성원·이양수·엄태영 (모두 국힘, 65~69%)
- 일치도 낮은 순 BOTTOM 5: 김병주·이언주·황희·허성무·주철현 (모두 더민주, 25~29%)
- → "결 비슷한 의원 발견" + "정반대 의원 발견" 양 방향 모두 의미 있는 결과

---

## 2026-04-26 — 거리 배지 최종 정리: "N% 일치" 한 줄 + 시각 차등 완전 제거

이전 라운드의 2-tier(골드 vs 회색)도 사용자 인지 부담이 있었음. 두 라운드 연속 "차등 잘 안 보임" 피드백 → 시각 차등 자체가 정보 전달 못 한다고 결론. 모든 의원 동일톤 + 텍스트(%) 자체로 강도 명확하게.

### 텍스트 통일 — "나의 성향 진단과 N% 일치"
- **퍼센트 변환**: `similarity = max(0, (1 - 거리/2) × 100)` — 4축 최대 거리 2.0 기준
  - 실측 분포 [0.61, 1.49] → [25%, 70%]
- 이모지(🎯) / tier 라벨("결 비슷") / 거리값(0.94) / v1 메타 — 모두 제거 (배지 텍스트에서)
- 위 4개 정보는 **호버/탭 툴팁**으로 이동: `"당신 좌표와 4축 거리 N.NN. 매핑 v1 기준."`
- 미완료/비로그인: `"진단 후 일치도 표시"` (회색·이탤릭, 클릭 시 `/balance-game`)

### 시각 차등 완전 제거
- 골드/회색 차등, font-weight 차등, 그림자, opacity 0.45 차등 — 모두 제거
- 모든 의원 동일톤 (그리드는 사진 위 흰 텍스트, 리스트는 회색 sub 톤)
- "% 숫자 자체로 강도 명확" 원칙 — "53% 일치" vs "30% 일치" 텍스트 비교가 시각 차등보다 직관적
- 분위수(`userDistanceQuartiles`) 미들웨어 인프라는 유지 — 향후 단계 5 "비슷한 의원 TOP 3" 등 다른 D 레이어에서 재사용

### 위치 변경 — 정체 → 활동 → 분석
- **그리드 카드**: `pol-badges` (사진 위 좌측 상단) → `pol-overlay > pol-stats-line` 다음 줄. 발의·공동 카운트 바로 아래
- **리스트 카드**: 마지막 컬럼 (이미 "분석" 자리) — 위치 그대로
- **상세 페이지**: `profile-top` (이름·정당) → KPI 행 다음 (`profile-match-row` 새 컴포넌트). 카드형 박스 + 우측에 `매핑 v1 →` 링크 (= `/balance-game/mapping`)
- **단계 5 connect 미리보기 (`bg-d-card-preview`)**: `pv-distance` 제거, `pv-match` 추가 — "나의 성향 진단과 62% 일치"
- 안내 문구도 "🎯 거리 배지" → "발의·공동 카운트 아래에 N% 일치 한 줄" 로 갱신

### CSS 정리
- `.bg-distance-badge` / `.bg-distance-num` / `.bg-distance-version` / `.is-similar` 모두 제거
- 페이지별 컴포넌트 신설:
  - `.pol-match-line` (그리드 + 리스트, 기본/`is-pending` 두 상태)
  - `.profile-match-row` + `.profile-match-text` + `.profile-match-mapping` (상세 페이지 카드형)
  - `.bg-d-card-preview .pv-match` (connect 미리보기)

### Phase 1 출시 안내 메모 정리
connect 카드 desc 의 "※ 의원 거리 계산은 Phase 1 출시 시점에 활성화" 안내 제거 — 이미 활성화됨.

---

## 2026-04-26 — 거리 배지 4-tier → 2-tier 단순화 + v1 매핑 링크

직전 라운드의 4-tier(결 비슷/비슷/다소 다름/다름) 가 시각 차등 미세하고 "결 비슷"과 "비슷"의 용어 구분이 모호했음. 사용자 인지 부담 최소화 방향으로 단순화.

### 변경
- **2-tier**: `is-similar` (Q1 이하, 상위 25%) vs 일반 (나머지 75%)
- 라벨 형식:
  - is-similar: `🎯 결 비슷 (0.85) · v1` 골드 강조 (font-weight 800·그림자)
  - 일반: `🎯 0.85 · v1` 회색 (라벨 없이 거리값만)
- "비슷" / "다소 다름" / "다름" 라벨 폐기 — 용어 모호 + 4단계 시각 차등 한눈에 안 읽힘
- opacity 0.45 차등 제거 — 일반 의원 모두 동등 가시성 (거리값으로 정밀 비교 가능)
- 분위수 기반 동적 임계값은 그대로 유지 (`userDistanceQuartiles.q1` 만 사용)

### v1 매핑 링크 (상세 페이지 한정)
- 거리 배지의 `v1` 부분이 `<a href="/balance-game/mapping">` 으로 클릭 가능 (`.bg-distance-version` · `pointer-events: auto` · dotted underline)
- 단계 5 연결 화면 (`connect.ejs` 출구 1번 "🗺 매핑 보기") 와 정합
- 목록 카드는 카드 전체가 `<a>` 로 감싸여 nested anchor 불가 → 거리 배지 자체는 `pointer-events: none` 유지. v1 링크는 상세 페이지 진입 후 활성화

### 검증 — 안정 쪽 테스트 유저 (eco 0.20 / soc -1.00 / sec 0.00 / ins -1.00)
- Q1 임계값 1.032 (사용자 좌표 기준 동적)
- 분포: is-similar 74명 (~25%) · 일반 220명 (~75%) · 미산출 1명
- 정당별 is-similar (부호 약속 검증):
  - **국민의힘 (안정)**: 106명 중 **72명** 골드 강조 (68%) ✓
  - **더불어민주당 (개혁)**: 160명 중 **1명**만 골드 → 159명 회색 일반 표시
  - 조국혁신당·진보당·기본소득당 등 개혁/소수 정당: 모두 회색 일반
- → 목록 화면 진입 시 "결 비슷한 의원 74명" 골드로 즉시 식별. 정확히 의도한 UX

---

## 2026-04-26 — 의원 카드 거리 배지 자기 설명 + 시각 강도 차등

`🎯 1.25 · 📊 vv1` 처럼 단위·범위·방향성 모호하고 295명 카드가 모두 같은 강도로 노출되던 시각 노이즈 해결.

### 변경
- **자기 설명적 라벨**: `🎯 결 비슷 (0.85)` 형태. 의미 있는 단어 + 수치는 보조 정보(괄호·작은 폰트)
- **분위수(quartile) 기반 4-tier 분류** — 사용자 좌표마다 동적 임계값:
  - tier 1 "결 비슷" (Q1 이하, ~25%): 진한 골드, font-weight 800, 그림자
  - tier 2 "비슷" (Q1~Q2, ~25%): 골드 (이전 distance badge 톤)
  - tier 3 "다소 다름" (Q2~Q3, ~25%): 회색 (pending 배지와 동일 톤)
  - tier 4 "다름" (Q3 초과, ~25%): opacity 0.45 (배지는 유지하되 시야에서 흐려짐)
- **vv1 오타 수정**: `📊 v<%= p.axis_version %>` → `📊 <%= p.axis_version %>` (axis_version 컬럼이 이미 'v1' 포함)
- **호버 툴팁 보강**: "4축 좌표 거리 N.NN · 0에 가까울수록 결이 비슷합니다 · 매핑 v1"

### 분위수 산출 — middleware
`injectBalanceGameStatus` 가 게임 완료 유저 한정으로 단일 `PERCENTILE_CONT` 쿼리 실행 (~수ms):
```sql
WITH dists AS (
  SELECT SQRT(($1-economy)^2+($2-social)^2+($3-security)^2+($4-institution)^2)/2 AS d
    FROM politician_axis_score WHERE mapping_version='v1'
)
SELECT PERCENTILE_CONT(0.25/0.50/0.75) WITHIN GROUP (ORDER BY d) FROM dists
```
→ `res.locals.userDistanceQuartiles = { q1, q2, q3 }`

### 검증 — 테스트 유저 (eco 0.20 / soc -1.00 / sec 0.00 / ins -1.00, 안정 쪽)
- 임계값: Q1 **1.03** · Q2 **1.24** · Q3 **1.31** (의원 295명 좌표 기준 동적 계산)
- tier 분포: 1=74명 · 2=73명 · 3=73명 · 4=74명 · 미산출=1명 (거의 균등 4분할)
- **정당별** (부호 약속 검증):
  - 국민의힘 (안정): tier1 72 · tier2 34 · tier3 0 · tier4 0 → 전부 "결 비슷~비슷" ✓
  - 더불어민주당 (개혁): tier1 1 · tier2 25 · tier3 65 · tier4 69 → 전부 "다소 다름~다름" ✓
  - 조국혁신당: tier2 7 · tier3 4 · tier4 1 (개혁 진영 분포)

사용자 좌표마다 임계값이 다름 — 안정 유저는 [0.6, 1.49] / 개혁 유저는 [0.12, 1.11] / 중도는 [0.27, 0.93] 범위. 분위수 기반이 절대값 임계값보다 적절한 이유.

---

## 2026-04-26 — 의원 4축 좌표 산출 + D 레이어 거리 배지 활성

`bill_axis_mapping` v1 (48건) + `bill_votes` (144,943건) → 의원 좌표를 산출. 게임 완료 유저에게 의원 카드/상세 페이지에 거리 배지 (🎯 0.74 · 📊 v1) 노출.

### `batch/calcPoliticianAxis.js`
- 알고리즘: 각 (의원, 축) 에 대해 `Σ (찬성→agree_score / 반대→disagree_score) × weight / Σ weight` (찬성/반대만, 기권/불참 제외) → -1.00 ~ +1.00
- 인자: `--version v1` (기본) · `--min-votes 1` (기본)
- CTE 한 방으로 UPSERT. politician_axis_score (mona_cd, mapping_version) PRIMARY KEY.
- 출력: 매핑 통계 → vote_count_used 분포 → 4축 히스토그램 → 정당별 평균 → 누락 검증

### 결과 (294명 / 295명, 1명 표결 1건 미만으로 제외)
- vote_count_used: min/median/avg/max = 1 / 39 / 36.74 / 48 · ≥30 234명
- **institution 축 변별력 큼** (std 0.621): 더민주 +0.83 · 조국혁신 +0.82 · 진보 +0.61 vs 국민의힘 -0.40 → 부호 약속(+1=개혁) 정확
- **economy 축**: 더민주 +0.72 vs 국민의힘 +0.44 → 양당 모두 +쪽이지만 방향 약속 일치
- **social 축**: 정당 변별력 약함 (모두 0.34~0.53)
- **security 축**: 5건뿐 + 84%가 +0.8~+1.0 → 노이즈 큼 (예상대로)

### D 레이어 활성
- `middlewares/balanceGame.js` → `res.locals.userAxis` 추가 (게임 완료 유저의 4축 좌표)
- 의원 목록 SQL `LEFT JOIN politician_axis_score` → `axis_economy/social/security/institution/version/vote_count` 노출
- 거리 공식: `Math.sqrt(Σ(u.axis - p.axis)²) / 2` → 실측 [0.74, 1.42] 범위
- 미완료/비로그인 → 회색 `📊 진단 후 표시`. 완료 유저 + 좌표 있음 → 골드 `🎯 0.74 · 📊 v1`
- 의원 상세 페이지의 미완료 배지는 `<a href="/balance-game">` 으로 클릭 가능 (목록은 카드 전체 링크라 pointer-events:none 유지)

### 한계 / 다음 라운드
- security 5건 → 거의 만장일치라 변별력 0. v2 매핑 시 보강 필요
- economy/social 양쪽 다 +쪽으로 쏠림 → 매핑된 가결 법안 위주라서. 변별력 큰 부결/일부 반대 법안 추가 매핑 검토
- 누락 1명 미세 케이스 — 표결 데이터 없는 의원

---

## 2026-04-26 — 법안-축 매핑 v1 사용자 1라운드 검토 반영 (50 → 48건)

`BILL_AXIS_MAPPING_v1_REVIEW.md` 둘러본 후 4건 재검토 반영. SQL 파일은 `DELETE WHERE mapping_version='v1'` + INSERT 48건 형태로 갱신.

| 줄 | 처리 | 사유 |
|---|---|---|
| #15 공교육 정상화 | **axis 변경** social/전통(1.0) → **economy/개입(1.0)** | 사교육 규제는 전통 가치보다 정부의 시장 개입 영역이 더 정확 |
| #18 양성평등기본법 | **제외** | 표결 98% 만장일치 — 의원 변별력 0, 좌표 영향 없음 |
| #28 영화·비디오물 진흥 | **weight 0.5 → 1.0** (axis social 유지) | 변별력 87% 활용. 표현·등급 영역 정치적 갈림 |
| #34 군인복지기본법 | **제외** | security 정의("동맹·강경 ↔ 자주·대화") 와 안 맞음. 군인 개인 처우 = 4축 밖 |

#30 국제질병퇴치기금 폐지·#49 국가유공자 단체는 사용자 판단 위임 — 그대로 유지 (#49는 만장일치라 좌표 영향 0이라 노이즈 위험 없음).

### 새 분포
- **축**: economy 15 / social 13 / security 5 / institution 15 (총 48)
- **weight**: 1.0 = 20건, 0.5 = 28건 (약한 매핑 비율 60% → 58.3%)
- security 5건은 한국 국회 22대 데이터 한계로 자연스러운 결과

---

## 2026-04-26 — 법안-축 매핑 v1 (`bill_axis_mapping` 50건 시드)

[BILL_AXIS_MAPPING_GUIDE.md](./BILL_AXIS_MAPPING_GUIDE.md) 따라 의원 4축 좌표 계산용 1차 매핑. 비공개 (UI 노출 X). `batch/calcPoliticianAxis.js` 입력 데이터.

### 작업 순서
1. 가이드 §2 SQL 을 우리 스키마에 맞게 보정 — `bills.committee_name` → `committee`, `votes` → `bill_votes`, `result_vote_mod` → `vote_result`, `proc_result_cd` → `proc_result_name`
2. 변별력 5~95% 조건으로 19건만 추출됨 — 한국 국회 22대 만장일치 가결 구조 (반대 표결 1,116건뿐) 한계. 조건 완화하고 변별력 순 정렬로 200건 풀
3. 200건에서 `bill_name + committee + (있으면) AI 분석` 기준 50건 매핑 결정
4. SQL + 검토 MD + 통계 + 자체 검증 일괄 생성

### 결과 — `etc/ddl/seeds/bill_axis_mapping_v1.sql` + `BILL_AXIS_MAPPING_v1_REVIEW.md`
- 총 50건 매핑, mapping_version='v1', mapped_by='ai_v1'
- ON CONFLICT 처리 (재실행 안전)

### 자체 검증 — 가이드 §8 체크리스트

| 항목 | 결과 |
|---|---|
| 50건 매핑 완료 | ✓ |
| 4축 분포 | economy 14 / social 15 / security **6** / institution 15 — security 부족 (한국 국회 22대 외교·안보 변별 표결 매우 적음) |
| 약한 매핑 30% 이하 | ⚠ 60% (30/50건). 만장일치 가결 다수라 weight=0.5 처리 — 변별력 자체가 부족한 데이터 한계 |
| 위원회 한쪽 쏠림 | ✓ 최대 12건(24%, 법사위 — 22대 특검 다수 반영). 50% 미만 |
| 부호 약속 종합팩 일치 | ✓ economy(-1=시장/+1=개입)·social(-1=전통/+1=자율)·security(-1=동맹강경/+1=자주대화)·institution(-1=안정/+1=개혁) |
| notes 진영 어휘 | ✓ "보수/진보/좌파/우파/여야/민주당/국민의힘" 0건 |
| AI 분석 비율 50%+ | ⚠ 6%(3/50). v4.1 분석된 가결 법안이 17건뿐이라 풀 자체가 작음 |

3개 ⚠ 모두 한국 국회 22대 데이터의 구조적 한계 — 사용자 검토 + Phase 2 확장 분석 후 v2 갱신 시 자연 개선 예상.

### 다음
- 사용자가 `BILL_AXIS_MAPPING_v1_REVIEW.md` 50줄 표 둘러보고 위화감 표시
- 위화감 있는 줄 재검토
- 그 후 `batch/calcPoliticianAxis.js` 작성 → 의원 좌표 산출 → D 레이어 활성

---

## 2026-04-26 — 다이아몬드 자기 설명 + 라벨/수치 분리 + 마진 확보

펼침 시각화 검증 후 자기 설명성·정치제도 겹침 보강 (이슈 3 "0.00 점 가독성"은 디자인 판단으로 그대로 유지).

### 1. 🟡 자기 설명성 — 다이아몬드 읽는 법 한 줄
카드는 결과 공유·갤러리 재방문 등에서 단독 노출되는 객체. 비교 화면 설명에 의존하지 말고 카드 자체가 자기 설명적이어야 함.
- 다이아몬드 SVG 바로 아래에 회색 톤 한 줄: **"중심은 중도, 가장자리는 뚜렷한 입장"**
- 비교 화면에도 동일 카피로 일관성 (시각 객체에 대한 설명은 어디서 봐도 같아야)
- 스타일: 12px / `var(--sub2)` / `text-align: center` / `letter-spacing: 0.02em`

### 2. 🟢 정치제도 라벨/수치 겹침 + 모든 축 간격 통일
이전 viewBox 320×320 에서 정치제도 라벨(y=306)·수치(y=322)가 16px 간격 + viewBox 끝(320)에 가까워 겹쳐 보임.
- **viewBox 360×360, cx/cy 180/180** — 외곽 마진 50px 확보 (R=130 그대로). wrap 320→360px (모바일 240→280)
- **모든 축 라벨↔수치 간격 16 → 20px 통일**:
  - security (위): 라벨 y=cy-R-32 / 수치 y=cy-R-12
  - economy / social: 라벨 y=cy-10 / 수치 y=cy+10
  - institution (아래): 라벨 y=cy+R+16 / 수치 y=cy+R+36
- 검증: 정치제도 라벨 y=326 / 수치 y=346 (20px 간격)

### 3. 🟢 0.00 점 가독성 — 그대로 유지
사용자 노트 "그대로 두는 게 의도일 수도" 채택. 0인 축의 점이 중심에 묻히는 건 "이 축은 응답 없음" 의 자연스러운 시각 신호. 무관심(C 응답) 카운트와 결합한 정밀 처리는 별도 단계에서.

### 비교 화면 일관 적용
- compare.ejs 의 다이아몬드도 절대값 매핑 + 자기 설명 한 줄 (펼침과 동일 카피) 적용. viewBox 360×360·R=140 그대로 (이미 마진 충분).
- 비교 다이아몬드엔 수치 텍스트 없음(라벨만) 라 라벨/수치 분리 이슈 없음.

---

## 2026-04-26 — 다이아몬드 좌표 절대값 기반 (강도 시각화)

검증에서 발견된 결정적 시각 이슈. **음수 점수가 점을 반대 축 꼭지로 이동시켜** 강한 입장(-1.00)이 약하게, 약한 입장(0.00)이 멀게 표현되던 문제. 사용자 직관과 정반대로 작동.

### 원인
이전 좌표 계산 `R * score` 가 점수의 부호를 그대로 반영 → `score=-1.00` 일 때 점이 **반대 방향**(security 음수면 아래로, institution 음수면 위로)으로 이동. 4축 다이아몬드가 변형되거나 뒤집힘.

### 해결 — 절대값 기반
`R * score` → **`R * Math.abs(score)`**. 강한 입장(`|점수|=1`)이 외곽, 약한 입장(`|점수|≈0`)이 중심 근처. 부호(방향) 정보는 **점수 텍스트(-1.00 등)와 축 라벨 ("시장 자율 ↔ 정부 개입")** 가 보존.

### 디자인 결정 — 점 색·모양 분기는 안 함
사용자가 옵션으로 제안한 "양수=진한 골드 / 음수=옅은 골드" 는 채택 안 함. 한쪽이 진하면 무의식적으로 "그쪽이 더 분명한 입장" 이라는 비대칭 무게가 만들어짐 — BALANCEGAME §1 "1축 환원 거부" + ANALYSIS.md "크다=좋다 프레임 차단" 정신과 어긋남. 모든 점 같은 골드.

### 적용 범위 (2개 파일, 일관 처리)
- `views/balance/reveal.ejs` — `points[]` 배열의 4축 좌표 + polygon points (자동 반영)
- `views/balance/compare.ejs` — `cmp-fill-mine` polygon, `cmp-dot-mine` 4개, JS 의 `setComparison()` 비교 면적 좌표

### 검증 (sec=-0.40, econ=0.20, inst=-1.00, soci=0.80)
| 축 | 점수 | 중심에서 거리 (R=130) | 외곽 % |
|---|---|---|---|
| security | -0.40 | 52.0 | 40% |
| economy | +0.20 | 26.0 | 20% |
| institution | **-1.00** | **130.0 (꼭지)** | 100% |
| social | +0.80 | 104.0 | 80% |

이전이라면 institution -1.00 점이 위쪽 꼭지(y=30) 로 이동했을 것. 지금은 아래쪽 꼭지(y=290) 로 정상 — 강도(절대값)가 시각 거리, 방향은 라벨과 점수가 표시.

---

## 2026-04-26 — 펼침·비교·연결 6개 보강

펼침/비교/연결 검증에서 발견된 UI 이슈 6개. 3개 파일에 반영.

### 1. 🔴 펼침 — 정치제도 라벨/수치 위치 swap (`reveal.ejs`)
다른 축은 라벨이 위·수치가 아래인데 정치제도(아래쪽 축)만 수치 위·라벨 아래로 반대 패턴. 4축 일관성 깨짐.
- 변경: `institution` 라벨 y=306 (점 가까이) + 수치 y=322 (외곽). 모든 축에서 화면 위→아래 순서로 라벨 → 수치 통일

### 2. 🟡 비교 — "내 좌표만" 토글 제거 (`compare.ejs`)
응답자 1명 (베타 초기) 일 때 "내 좌표만" 과 "전체 평균(1명)" 이 동일한 뷰 → 토글 두 개가 같은 결과.
- 토글 4개 → 3개: [전체 평균] [당신과 같은 그룹 평균] [비슷한 의원]
- 디폴트 active = 첫 활성 토글 (서버에서 결정 — overall 우선, 미달 시 group). DEFAULT_CMP 로 클라이언트에 주입
- 응답자 임계값 50명 미만이면 "전체 평균" 비활성 + "데이터가 충분하지 않습니다 (현재 N명 — 50명+ 부터 활성)" 안내

### 3. 🟡 비교 — 성별·나이대 라벨 추상화 (개인정보 노출 회피)
이전: "같은 20대 남성 평균" — 화면 노출 시 옆 사람에게 인구 정보 보임
- 토글 라벨: **"당신과 같은 그룹 평균"** 으로 추상화
- 토글 active 시에만 다이아몬드 하단에 작게 메타 노출: "같은 그룹 = 30대 남성 응답자 (N명)" — 클릭한 본인만 보는 단계
- group inactive 시엔 메타 hidden

### 4. 🟢 비교 — 해석 카드 강도 4단계 (`axisLine` 헬퍼)
이전: |점수| 0.6+ → "뚜렷하게" / 0.3+ → "약간" / 그 외 → "미세하게". 0.85 든 1.00 이든 같은 "뚜렷하게" 반복.
- 새 4단계:
  - `|점수| < 0.25` → 중도
  - `0.25 ≤ |점수| < 0.5`  → 미세하게
  - `0.5  ≤ |점수| < 0.75` → 약간 뚜렷하게
  - `0.75 ≤ |점수|`        → 뚜렷하게
- 검증: 0.85 → 뚜렷, 0.55 → 약간 뚜렷, 0.30 → 미세, 0.10 → 중도 (예상대로 4단계 분기)

### 5. 🟢 연결 — "Phase 3+" → "준비 중" (`connect.ejs`)
유저에게 노출되는 sub 텍스트에서 개발자 노트 제거.
- 카드 갤러리 카드: `Phase 3+` → `준비 중`
- title 도 `Phase 3+ 카드 갤러리` → `카드 갤러리 — 준비 중`

### 6. 🟢 연결 — 의원 카드 미리보기 "예시" 명시 (`connect.ejs`)
○○ 의원 카드가 진짜 의원 카드처럼 보이는 우려.
- `.bg-d-card-preview::before { content: '예시' }` — 카드 좌상단에 "예시" 라벨 칩
- `border: 1.5px dashed var(--border2)` 점선 테두리로 placeholder 명시
- 의원명·거리 배지 채도 낮춤 (`var(--sub)`, `border: 1px dashed`)
- `opacity: 0.85` + 흰 배경 → 베이지 배경 으로 차분화

---

## 2026-04-26 — 펼침 화면 UI 4개 보강 (`views/balance/reveal.ejs`)

검증에서 발견된 UI 이슈 4개를 한 파일에서 해결.

### 1. "좌·우" 단어 제거 — 사이트 미션 정합 (BALANCEGAME §3)
응답 분포 텍스트가 "좌(시장·전통·동맹·안정) 13 / 우(개입·자율·자주·개혁) 5 / 무관심 2" 였음. BALANCEGAME §3 "축 이름 원칙: 좌·우 단어 금지" 와 정면 충돌 — "'좌/우'는 사람마다 정의 달라 같은 단어로 다른 걸 측정하게 됨"
- 변경: **`−1 응답 13 · +1 응답 5 · 무관심 2`** (부호 표기로 가장 건조하게)
- 사이트 어디에서도 "좌·우" 단어를 쓰지 않는다는 원칙 일관 유지

### 2. 다이아몬드 라벨/수치 위치 일관화
이전: 축마다 라벨/수치 offset 이 제각각이라 정치제도(아래쪽) 의 라벨과 수치가 14px 간격으로 겹쳐 보임
- 변경: **모든 축에서 라벨이 외곽(멀리, 식별용), 수치가 점 가까이(좌표 읽기용)** — 위·아래 축은 한 줄 위/아래, 좌·우 축은 외곽 자리에서 라벨 위 / 수치 아래로 두 줄
- 좌표: 안보(위) y=2/18, 경제(오른) y=154/172, 정치제도(아래) y=322/306, 사회(왼) y=154/172. 16~18px 명확 간격

### 3. mapping v1 · 날짜 중복 제거
`reveal-card-sub` (위) 와 `reveal-meta` (아래) 둘 다 "📊 mapping v1 · 2026.04.26" 표시 → 동일 정보 두 번
- 변경: 위쪽 `reveal-card-sub` 유지 (헤더 메타로 적합), 아래 `reveal-meta` 는 **"응답 N"** 만

### 4. "분포 안에서 내 위치 확인하세요" 안내 제거
"비교 단계로 →" 버튼이 이미 명확한 액션이라 위 안내 중복. 제거 후 버튼만 단독 노출.
사용 안 하는 `.reveal-next-text` CSS 도 같이 정리.

---

## 2026-04-26 — 밸런스 게임 누적 모델 + 가입 온보딩 + 5단계 완성

이번 라운드 핵심 변화: **1회성 카드 → 누적 좌표 모델**, 게임팩 컬렉션, 가입 직후 환영 페이지, 인구통계 비교. UI_BALANCEGAME 5단계 모두 구현 (단계 3·4·5 신규).

### DB — 누적 모델 + 게임팩 컬렉션
`etc/ddl/migrations/2026-04-26-balance-game-cumulative.sql`:
- `balance_game_packs` (신규) — 입문 'general' + 주제팩 비정기 추가 자리. `is_general` / `display_order` / `question_count`
- `balance_game_questions` 재설계 — `pack_id` / `display_order` 추가
- `balance_game_responses` 재설계 — **응답 단위 1문항** (`question_id`, `answer`, `score`, `axis` 비정규화). UNIQUE `(user_id, question_id, mapping_version)` — 같은 매핑 안 한 문항당 1행
- `user_axis_score` (신규) — 4축 좌표 캐시 (응답 추가마다 갱신). `economy/social/security/institution` 평균 + count + `total_responses` + `packs_completed` (콤마)
- `group_axis_avg` (신규) — 인구 그룹별 평균 (Phase 2 비교)
- `bill_axis_mapping.mapped_by` 타입 변경 — INT FK → `VARCHAR(20)` ('ai_v1' / 'human:user_id')
- `users.welcomed_at TIMESTAMPTZ` 추가 — 가입 직후 환영 페이지 1회 노출 추적
- 종합팩 `'general'` + **20문항 시드** (BALANCEGAME §9 그대로 INSERT)

### API + 좌표 누적 계산 (`BalanceGameDao.js` / `BalanceGameService.js` 신규)
- `POST /api/balance-game/respond` — 1문항 저장 + UPSERT `user_axis_score`. 같은 문항 재응답 시 UPDATE (UNIQUE ON CONFLICT). C(잘 모르겠다) score=0 으로 평균에서 제외, axis_count 만 따로 추적
- `GET /api/balance-game/score` — 현재 좌표 + `packs_completed` 반환
- 좌표 갱신 SQL — 4축 평균을 한 INSERT 안에서 계산 + `packs_completed` 도 게임팩 question_count 와 응답 수 비교로 자동 산출. 응답 1건 추가에 쿼리 1번 (UPSERT)
- 응답 평균 계산은 `score <> 0` 만 (무관심 빠짐) — count 와 평균 둘 다 무관심 제외

### 가입 흐름 확장 (`/auth/welcome`)
- OAuth → 닉네임·성별·나이대 입력 → **환영 페이지 1회**
- 환영 페이지 카피에 닉네임·성별·나이대 동적 반영 (예: "같은 20대 여성 응답자 평균과 비교해 볼 수 있어요" — 막 입력한 정보 즉시 활용)
- [지금 풀기] → `/balance-game/respond?pack=general` / [둘러보기 먼저] → `/`. 둘 다 `welcomed_at = NOW()` 박고 redirect (1회 노출 보장)
- 환영 페이지에서 `users.welcomed_at IS NOT NULL` 이면 자동 홈으로 redirect

### 게임팩 컬렉션 (`/balance-game` 갱신)
- 헤더 + "내 카드" 요약 행 (완료 유저)
- **입문 게임팩 카드** (큰 카드, 골드 보더, "🎯 여기서 시작하세요" 배지) — 미완료 시. 완료 시 "✓ 완료" 배지 + [카드 보기] / [다시 풀기]
- **주제 게임팩** 영역 — Phase 2 placeholder ("곧 추가됩니다")

### 단계 2 응답 화면 갱신
- `?pack=general` URL 쿼리. 서버에서 `getPackProgress` 호출 → `questions[]` + 기존 `answers{}` + `next_index`
- 클라이언트가 1문항씩 즉시 `POST /api/balance-game/respond`. 401 시 `/auth/login?next=` 자동 redirect
- **이어하기**: 이미 답한 문항은 자동 skip, `next_index` 부터 시작
- 종합팩 20문항 다 풀면 `/balance-game/reveal` 자동 redirect
- 옵티미스틱 갱신: 저장 중 옵션 disable, 실패 시 에러 배너 + 다시 활성화

### 단계 3 펼침 — 13초 클라이맥스 (`/balance-game/reveal`)
- Phase A 로딩 3초: 검은 영역 + "당신의 좌표를 그리는 중…" + 4축 typewriter (각 0.6초)
- Phase B 다이아몬드 5초: 4축 점이 하나씩 (3.6 / 4.0 / 4.4 / 4.8초) → 각 점 옆 점수 페이드인 → 면적 골드 채움 (5.4초)
- Phase C 카드 형성 5초: 메타(검사일·`mapping v1`)·응답 분포·"비교 단계로 →" CTA 페이드인
- 인라인 SVG 다이아몬드 (320×320 PC / 240×240 모바일) — 0.25/0.50/0.75/1.00 그리드 + 4축 좌표
- 새로고침 시 sessionStorage(`pb.balanceGame.revealed.<v>`) 체크해서 애니메이션 스킵 (UI_BALANCEGAME §단계 3 "한 번만")

### 단계 4 비교 (`/balance-game/compare`)
- 분포 다이아몬드 + 비교 토글 4개:
  - **내 좌표만** (default)
  - **전체 평균** — `group_axis_avg` 의 'all' 키 (활성)
  - **같은 [성별·나이대] 평균** — 가입 시 정보 자동 매칭. 임계값 50명 미달 시 비활성 + "현재 N명" 안내
  - **비슷한 의원** — Phase 2 (비활성)
- 임계값 처리: `< 50명` → `absent` 비활성, `50~200명` → `low` 활성 + "정밀도 낮음", `200명+` → `normal`
- 토글 변경 시 SVG 비교 면적이 점선 회색 폴리곤으로 모핑 (transition 0.4s)
- 축별 한 줄 해석 (서버 `axisLine()` 헬퍼 — 점수 절대값에 따라 "뚜렷하게/약간/미세하게 X 쪽")

### 단계 5 연결 (`/balance-game/connect`)
- D 레이어 안내 카드 — 의원 카드 미니 미리보기 (🎯 0.7 + mapping v1) + "사이트 둘러보기"
- 출구 5종 (모두 같은 크기, UI_BALANCEGAME 명시): 매핑 보기 / 결과 공유(URL 클립보드) / 다시 풀기 / 메인으로 / 카드 갤러리(Phase 3+ disabled)
- "내 결과는 비공개입니다" 푸터 안내

### 그룹 평균 일배치 (`batch/calcGroupAxisAvg.js` 신규)
매일 새벽 인구 그룹별 평균 산출. 1쿼리에 'all' + (gender × age_group) 한 번에 UPSERT.
- 'all' 키 — 임계값 무시, 응답자 1명도 평균 채움 (베타 초기 표시 가치)
- 인구 그룹 — 50명 미달 시 평균 NULL, `user_count` 만 기록 (단계 4 토글 비활성에 사용)

### 미들웨어 — `balanceGameCompleted` 정의 변경
이전: 응답 1건+ → true. 이번: `user_axis_score.packs_completed` 에 `'general'` 포함 → true. 종합팩 20문항 다 풀어야 D 레이어 활성 (1·2·3·4·5문항 부분 풀이는 미완료로 간주 — D 레이어 의미 미달).

### 매핑 미리보기 (`/balance-game/mapping`) 갱신
mock 모듈 의존 제거 → DB `balance_game_questions` 직접 조회. 게임팩 추가 시 자동 섹션 등장. 옵션 점수 색은 `--vote-pro/--vote-con` 토큰 재활용 (디자인 시스템 일관성).

### 미해결 (다음 라운드)
- 법안 매핑 50건 (Claude AI 1차 매핑 후 `bill_axis_mapping` 시드)
- `batch/calcPoliticianAxis.js` (의원 4축 좌표 계산)
- D 레이어 활성: 의원 카드 `🎯 0.7  📊 v1` 거리 배지, 홈 "결 비슷한 의원의 법안" 탭, 법안 상세 Zone 4 1줄
- 단계 5 "비슷한 의원 TOP 3" — 의원 좌표 계산 의존
- 주제 게임팩 추가 (환경·사법 등 AI 1차 매핑)
- 카드 갤러리 (Phase 3 — 시간순 카드 보존, 두 카드 겹쳐 보기)

---

## 2026-04-26 — 정치 성향 밸런스 게임 골격 (단계 1·2 + DB)

데이터 의존성 없는 화면·구조·DB 부분만. 단계 3·4·5 (펼침·비교·연결) / 의원 거리 계산 / D 레이어 활성 / 문항 시드는 다음 라운드.

### DB 마이그레이션 — 4개 테이블 (BALANCEGAME §11)
`etc/ddl/migrations/2026-04-26-balance-game.sql`:
- `balance_game_responses` — append-only 응답 카드 (재검사해도 덮어쓰지 않고 `is_archived=TRUE`로 숨김). `user_id` NULL 허용 (비로그인 응답)
- `balance_game_questions` — 문항 마스터, `mapping_version` 추적
- `bill_axis_mapping` — 법안-축 매핑 (사람이 결정, 의원 좌표 계산 입력)
- `politician_axis_score` — 의원 4축 좌표 (PK: `mona_cd`+`mapping_version`). 향후 D 레이어에서 거리 계산
- 모든 테이블이 `mapping_version` 으로 추적 — ANALYSIS.md `prompt_version` 패턴과 동일

### 라우트·컨트롤러·mock 문항
- `controllers/BalanceGameController.js` 신규 — `getInvitePage` / `getRespondPage` / `getMappingPreviewPage`
- `routes/PageRoutes.js` 에 `/balance-game`, `/balance-game/respond`, `/balance-game/mapping` 등록
- `data/balanceGameMockQuestions.js` 신규 — BALANCEGAME §9 의 20개 문항을 모듈로 박아둠. DB 시드 전 화면 골격 검증용. 확정 후 `balance_game_questions` 로 이전

### nav 메뉴 + 미들웨어
- `views/layout.ejs` PC nav 와 모바일 패널에 "성향 진단" 항목 추가 (의원·법안 다음, 커뮤니티 앞)
- `middlewares/balanceGame.js` 신규 — `injectBalanceGameStatus` 가 `res.locals.balanceGameCompleted` 주입. 비로그인·응답 0건 → false, 응답 1건+ → true. `app.js` 의 `injectUser` 다음 단계에 등록

### 단계 1 — 초대 (`views/balance/invite.ejs`)
UI_BALANCEGAME §단계1 그대로:
- Hero (Bebas Neue 52px) + 부제(Noto Serif KR) + 시간 약속 칩 (`📊 mapping v1 · 20문항 · 약 7~10분`)
- **3가지 약속 카드** 가로 배열 (모바일 세로 스택): 라벨링 X / 정당 매칭 X / 매핑 공개 — 정치人과의 차별점을 첫 화면부터 노출
- 시작 버튼 + 보조 링크 (매핑 미리 보기 / Phase 3+ 카드 보기 안내)

### 단계 2 — 응답 (`views/balance/respond.ejs`)
한 화면 한 문항 + 진행도 + A/B/C + 키보드:
- sticky 진행도 바 (`3/20 — 경제`) + 진행 트랙 (응답한 만큼 채움)
- 양측 맥락 한 단락 (Noto Serif KR 17px, 2~3줄)
- A/B/C 버튼 세로 스택. C("잘 모르겠다") 는 회색 톤이지만 흐릿하지 않게 (UI_BALANCEGAME 명시)
- 키보드 지원: `1·2·3` / `A·B·C` / `←` 이전 문항
- localStorage 저장 (`pb.balanceGame.draft.<mappingVersion>`) — 중간 이탈 시 이어하기. 응답 완료 후 자동 정리
- 응답 완료 화면 — 단계 3·4·5 미구현 안내 + 클라이언트에서 즉석 계산한 4축 점수 디버그 출력 (`<pre>` 박스)
- 페이드 전환 0.3초 (자동 응답 모드 회피 + 답답하지 않은 속도)
- 모바일에선 키보드 힌트 숨김, 버튼 최소 56px 터치 타겟

### 매핑 미리 보기 (`views/balance/mapping_preview.ejs`)
단계 1 의 보조 링크 도달지. 4축별로 5문항씩 그룹화, 각 옵션의 매핑 점수(+1 / -1 / ±0)를 칩으로 시각화. 점수 색은 시민 찬반과 같은 `--vote-pro` / `--vote-con` 톤 사용 (디자인 토큰 재활용, "정당색·강조색 X" 정신 유지). 매핑 버전 라벨 노출 + 피드백 메일 안내. 본격 매핑 변경 추적은 Phase 1 출시 직전 정밀화

### 의원 카드 — 미완료 유저 회색 배지
`public/styles/main.css` 에 `.bg-pending-badge` 컴포넌트 신규 (회색 톤 pill). `views/politician/politician.ejs` 의 그리드 카드 + 리스트 카드 양쪽에 `<% if (locals.balanceGameCompleted === false) { %>📊 진단 후 표시<% } %>` 조건부 렌더. 카드 전체가 `<a>` 라 배지엔 `pointer-events: none` — 시각 신호만, 클릭 시엔 의원 상세로 자연스럽게 이동. 의원 상세에 큰 D 레이어 배지·홈 탭 비활성·1회 풀스크린 안내·마이페이지 카드는 다음 라운드.

### 미해결 (다음 라운드)
- 단계 3 펼침 (다이아몬드 클라이맥스 애니메이션)
- 단계 4 비교 (분포 다이아몬드 + 인구통계 토글)
- 단계 5 연결 (비슷한 의원 TOP 3 + 출구 5종)
- 응답 저장 API (`POST /api/balance-game/responses`)
- 의원 4축 좌표 배치 (`batch/calcPoliticianAxis.js`) + 사람이 매핑하는 50~100건의 `bill_axis_mapping` 시드
- D 레이어 활성 표시 — 의원 카드 `🎯 0.7  📊 v1` / 홈 탭 / 법안 상세 Zone 4 끝
- 문항 시드 (`balance_game_questions` 행 채움 — 매핑 확정 후)
- 1회 풀스크린 안내 + 마이페이지 카드

---

## 2026-04-26 — 국민 찬반 위젯 색 중립화 (`public/styles/main.css`)

[ANALYSIS.md](./ANALYSIS.md) §7-장치1 "크다=좋다 프레임 차단" + 정당색 회피 원칙 동시 적용.

### 결정 — 찬성/반대 색은 등명도 저채도 두 hue
기존 `--green` / `--red` 는 본회의 표결(가결/부결) 같은 **객관 데이터**엔 자연스럽지만, 시민 찬반은 의견이 갈리는 영역이라 한쪽 명도·채도가 더 세면 무의식적으로 "찬성=좋음" 프레임이 생긴다. 다음 안 검토:
- 골드 채도 단계 / 골드 vs 차콜 / 골드 vs 보라(--purple) — 골드는 별점·좋아요·`comment.liked` 가 이미 점령. 한쪽 편으로 쓰면 의미 충돌 ❌
- `--purple` 채도 92% 라 자극 강함 ❌
- 차콜 vs 베이지 — 명도차 너무 커서 "찬성=무거움" 프레임 ❌
- **선택**: cool slate vs warm mocha 등명도 저채도 — hue 만 cool/warm 으로 갈라 무게 동등 + 시각 구분 가능 + 골드 채도 영역과 분리 → 별점·좋아요와 톤 충돌 0

### 적용
- 신규 토큰 2종 (`public/styles/main.css :root`):
  - `--vote-pro: #7499B4` (HSL 205, 30%, 58% — cool slate)
  - `--vote-con: #B48E74` (HSL  24, 30%, 58% — warm mocha)
  - 명도(L) / 채도(S) 동일, hue 만 cool/warm 보색 방향. 정당 대표색 어디에도 안 걸림
  - 4단계 조정으로 최종값 도달: L=36%/S=14% → L=45%/S=20% → L=58%/S=22% → **L=58%/S=30%**. 어두움·hue 약함 피드백을 명도와 채도로 단계 보강. 명도 올리는 시점에 글자색을 흰색에서 차콜로 동시 전환 — 차콜 글자 + 밝은 배경 대비 ~7:1 (WCAG AAA)
- 위젯 클래스 색 교체 (`.cv-*`): `cv-agree/cv-disagree` 막대, `cv-dot-agree/disagree` 도트, `cv-btn-*-active` 버튼. `--green/--red` 4곳 → 각각 `--vote-pro/--vote-con` 로
- `cv-seg` 글자색 `#fff` → `var(--text)` + `font-weight: 600` → `700` (밝아진 배경에 차콜 글자 + 굵기 ↑로 가독성)
- `cv-btn-*-active` 글자색 `#fff` → `var(--text)`
- `cv-seg` 안의 % 숫자 + `cv-legend` 의 "찬성/반대 N명" 라벨이 색맹 접근성 보강

### 미변경 — 본회의 표결 시각화는 그대로
본회의 가결/부결은 객관 데이터라 정당색 회피 대상이 아님. `--green/--red` 유지:
- `views/index.ejs` 홈 vote 카드, KPI 카드
- `views/bill/bill.ejs` 카드 우측 vote-mini 막대
- `views/bill/bill_detail.ejs` 본회의 표결 4박스
- `views/politician/politician_detail.ejs` v-for/v-against 칩, 표결 성향 바, 타임라인 dot

---

## 2026-04-26 — AI 분석·요청 필터 카드 통합 + 카테고리 v4.1 도입

### AI 법안 분석 카테고리 2-tier 분류 (v4.1)
자유 형식 카테고리("교육·환경", "조세·재정·금융" 등)가 분석이 늘어나면 표현 분기로 카테고리가 폭발하는 문제 해결.
- `bill_ai_analysis` 에 `category_main VARCHAR(50)` + `category_sub VARCHAR(50)` 컬럼 추가 (기존 `category` 는 deprecate, 안정화 후 DROP 예정)
- `category_main` = 16종 고정 set: `정치·행정 / 외교·통일 / 국방·안보 / 사법·치안 / 산업·R&D / 조세·재정 / 노동·고용 / 교육·인재 / 환경·에너지 / 보건·의료 / 복지·돌봄 / 주거·국토 / 농어촌·수산 / 문화·예술 / 안전·재난 / 유통·소비자`
- `category_sub` = 자유 형식 10자 이내 (예: "양자기술", "환경교육", "소상공인")
- 카드 표시: "환경·에너지 · 환경교육" 형태 (sub 는 회색 톤)
- 16종 + 정의 + 모호 케이스 결정 가이드를 v4.1 SYSTEM_PROMPT 에 주입 ([ANALYSIS.md](./ANALYSIS.md))
- `batch/billCategories.js` 신규 — `CATEGORIES` / `CATEGORY_DEFINITIONS` / `CATEGORY_TIE_BREAKER` 모듈로 분석 배치·재분류 배치 공유
- `batch/reclassifyCategories.js` 신규 — 한 번의 Haiku 호출로 N건 일괄 재분류 (12건 $0.0068, 1건당 $0.0006)
- `syncBillAiAnalysis.js` v4.1 변경: SYSTEM_PROMPT 에 16종 정의·tie-breaker 포함, JSON 스키마 `category_main`/`category_sub` 분리, INSERT 컬럼 변경, 검증 로직(`validateCategoryMain`)으로 16종 외 라벨이면 `needs_review=true` 강제. PROMPT_VERSION='v4.1'
- 비용: input ~5,170 tok, 1건당 **~$0.0172** (v4 의 $0.014 대비 +20%, 카테고리 정의 추가로 system prompt 가 길어짐)
- 검증: 기존 12건 재분류 + 신규 5건 분석 모두 16종 외 0건. 분포 12개 카테고리 균형 사용 (모호 케이스 "환경교육법 → 환경·에너지", "양자과학기술법 → 산업·R&D" 가이드 그대로 동작)
- 마이그레이션 SQL: `etc/ddl/migrations/2026-04-26-bill-category-tier.sql`

### AI 분석 + 분석 요청 필터 카드 통합 (`views/bill/bill.ejs`)
처음엔 별도 카드 두 개 (AI 분석 / 분석 요청) 로 출시 후 통합 결정.
- 5항목 단일 라디오: `전체 / 🤖 있음 / 없음 / 💡 요청 있음 / 🔥 우선 분석 대기 (5명+)`
- 각 항목이 (`has_analysis`, `request_status`) 페어를 동시에 설정 — `data-analysis-ha` + `data-analysis-rs` 두 속성에 박아둠
- "💡 요청 있음" 카운트는 **미분석 한정**으로 (`getRequestStats.sql` 에 `LEFT JOIN bill_ai_analysis WHERE a.bill_id IS NULL` 추가) — 카드 카운트 ↔ 클릭 후 결과 항상 일치
- JS: 한 클릭에 `pendingHasAnalysis` + `pendingRequestStatus` 동시 토글, 같은 항목 재클릭 시 둘 다 비움(전체 복귀)

### stats 캐시 stale 수정
4개 카운트(total / analyzed / request_any / request_priority)가 한 5분 캐시에 묶여 있어, 분석 요청 새로 누른 직후 사이드바 카운트가 stale 되는 문제.
- `getAnalysisStats.sql` — total/analyzed 만 (16k+ row COUNT 가 무거우므로 5분 캐시 가치 큼)
- `getRequestStats.sql` 신규 — any/priority 만 (view 인덱스 스캔이라 가벼움 + 캐시 X, 매 요청 fresh)
- Service 에서 두 메서드 분리, controller 가 `Promise.all` 후 한 객체로 병합해 view 전달
- 검증: DB INSERT 직후 페이지 새로고침 → 카운트 즉시 갱신, total_bills 는 5분 캐시 그대로

### 법안 상세에 AI 분석 라벨 + 디스클레이머
[ANALYSIS.md](./ANALYSIS.md) §7-장치4 "AI 가 생성한 분석으로 사실이 아닐 수 있습니다" 가 미적용 상태였음. 분석 분기 위 공통 라벨 한 줄로 통합.
- 분석 있음: `🤖 AI 분석   AI가 생성한 분석으로 사실과 다를 수 있습니다   v4.1` (골드 배경)
- 분석 없음: `🤖 AI 분석   아직 분석되지 않은 법안입니다` (회색 배경)
- `prompt_version` 도 라벨 우측 메타로 표기

### 법안 카드 "💡 N명 요청" → "💡 AI 분석 N명 요청"
무엇을 요청한다는 건지 모호하다는 피드백 — 리스트 카드 + 마이페이지 카드 두 군데 일관되게 변경.

---

## 2026-04-25 (오후) — AI 분석 표시 시스템 + 분석 요청 시스템

### 분석 요청 1인 1요청 시스템 (DDL 신규)
미분석 법안에 사용자가 "분석 요청"을 누르면 1행 적재. 운영자는 요청 카운트 기반 우선순위로 다음 분석 큐 결정.
- 신규 테이블 `bill_analysis_requests`(`bill_id` × `user_id` UNIQUE)
- 카운트 view `bill_analysis_request_counts` (성능 최적화 — 리스트 LEFT JOIN 시 사용)
- 임계값(기본 5명) 환경변수 `ANALYSIS_REQUEST_THRESHOLD`
- DDL: `etc/ddl/bill_analysis_requests.sql`

### 라우트 신규 3종
- `POST /bill/:id/request-analysis` — `requireLogin`, 이미 분석된 법안엔 `ALREADY_ANALYZED` 400, 멱등 처리(중복 요청은 count 만 반환)
- `GET /api/bill/:id/analysis-status` — `{ count, hasRequested, threshold }` JSON
- `GET /my/analysis-requests` — 마이페이지 "내가 요청한 분석" (로그인 필수)

### 법안 리스트 페이지 확장 (`views/bill/bill.ejs`)
- **AI 분석 진행률 배너** — 상단에 "🤖 법안 16,889건 중 AI 분석 완료 N건 (X%)" + 가로 막대
- **사이드바 AI 분석 필터 카드** (이후 04-26 에 분석 요청 카드와 통합)
- **사이드바 "주제별" 카드** — `bill_ai_analysis.category_main` distinct 옵션
- **정렬 드롭다운** — `최신순(default) / 분석 있음 우선 / 요청 많은 순`
- **카드 강조** — 분석 있는 법안은 `border-left: 3px solid var(--accent)` + `🤖 AI 분석` 배지 + 한 줄 요약(세리프 14px, 2줄 클램프)
- **카드 메타** — AI 분류 (main · sub) + 미분석에 요청 1명+ 시 "💡 AI 분석 N명 요청"
- **🔥 우선 분석 대기 배지** — 미분석 + 요청 임계값 도달 시 카드에 표시
- **모바일 사이드바 시트** — 기존 카테고리·정당 카드의 pending state 패턴(적용 버튼 누르기 전엔 navigation 안 함)에 AI 분석 / AI 카테고리 추가, JS `loadFromUrl/apply/reset` 확장

### 법안 상세 분석 요청 위젯 (`views/bill/bill_detail.ejs`)
미분석 법안에서 5-Zone UI 자리에 노출.
- 큰 숫자 카운터(세리프 32px) `<count> / <threshold>명` + 골드 그라디언트 진행 바
- 5명 도달 시 "🎉 충분한 요청이 모였어요. 곧 분석됩니다." 초록 박스
- 비로그인: "로그인하고 분석 요청하기" → `/auth/login?next=...` 리다이렉트
- 로그인 + 요청 안 함: "💡 이 법안 분석 요청하기" 버튼
- 로그인 + 이미 요청: "✓ 요청했어요" 비활성 버튼
- AJAX 성공 시 카운트·진행 바 즉시 갱신 + 버튼 교체 (페이지 새로고침 없이)
- `PB.mountAnalysisRequest({ containerId })` 헬퍼 신규 (`public/scripts/interactions.js`)

### 마이페이지 신규 (`views/my/analysis_requests.ejs`)
- 요약 라인: "총 N건 요청 / ✓ 완료 X / ⏳ 대기 Y / 임계값 5명"
- 카드 리스트: 완료(초록 좌측 보더) / 대기(골드 좌측 보더), 분석 완료된 카드엔 한 줄 요약·AI 카테고리 노출
- nav 드롭다운 "내 활동(준비중)" → "내가 요청한 분석" 링크 교체

### 운영자용 분석 우선순위 쿼리
다음 분석 대상 골라 `node batch/syncBillAiAnalysis.js --bill-id <id>` 로 처리.
```sql
SELECT b.bill_id, b.bill_no, b.bill_name, b.proc_result_name,
       rc.request_count, rc.last_requested_at
  FROM bills b
  JOIN bill_analysis_request_counts rc ON rc.bill_id = b.bill_id
  LEFT JOIN bill_ai_analysis a         ON a.bill_id = b.bill_id
 WHERE a.bill_id IS NULL
 ORDER BY rc.request_count DESC, rc.last_requested_at DESC
 LIMIT 50;
```

또는 UI 로: `/bill?has_analysis=N&request_status=any&sort=requested`

---

## 2026-04-25 — AI 법안 분석 배치 v4 (`batch/syncBillAiAnalysis.js`)

### 새 배치 스크립트 — Claude Haiku 4.5 + v4 프롬프트
[ANALYSIS.md](./ANALYSIS.md) §3 의 17개 분석 원칙 + 5-Zone JSON 스키마 그대로 출력. 가결 법안 우선 + on-demand 분석 모두 대응.
- **본문 수집**: `pal.assembly.go.kr/napal/lgsltpa/lgsltpaDone/view.do?lgsltPaId=<bill_id>` 의 "제안이유 및 주요내용" 박스를 cheerio 로 파싱 (5/5 샘플 모두 안정 추출)
- **모델**: `claude-haiku-4-5-20251001` (분석 품질이 Sonnet 권고 대비 충분, $30/M 차이 유의미)
- **출력**: JSON 스키마 강제 (`summary, category, reading_time_min, changes, affected, issues[3], context[2-3], limitations[2-3], judgment_questions[3]`)
- **인자**: `--limit N` (기본 3) / `--bill-id ID...` 직접 지정. Phase 1 가결 법안 우선 자동 선별
- **요청 간 sleep 1500ms** + 429 retry-after 대응 (490건 배치 안정성)
- **오타 후처리** — `TYPO_MAP` 으로 알려진 깨짐 자동 치환
- **`needs_review` 자동 판정** — 연도(`\d{4}년`) 3개 이상 / 구체적 기관·법명 5개 이상 / `limitations` 3개 이상이면 `true`
- **Prompt Caching 적용** — `system` 을 `cache_control: ephemeral` 로 감쌈. 단 Haiku 4.5 의 캐시 최소 토큰(추정 ~4,096) 미달로 현재 system prompt(~3,100 tok)에선 활성화 안 됨 (cache_w/cache_r=0). 코드 자체는 준비, 향후 system prompt 가 4,500+ 으로 늘면 자동 활성
- **비용 (Haiku 4.5 가격, v4)**: input $1.0 / output $5.0 / cache write $1.25 / cache read $0.10 per MTok. 1건당 평균 ~$0.014 (v4) / $0.017 (v4.1, 04-26 갱신)
- 5건 dry-run 실행 후 18초/건, JSON 파싱 실패 0건, 17개 원칙 준수(정당 언급 없음, 발의자 인용, pro/con/gap 3쟁점) 확인

### 시드 행과의 차이
- 기존 v4-sample 1건은 수동 시드 + cost_usd 잘못 계산 (`$0.000413`). 정식 v4 는 정확 가격 산출
- 04-26 v4.1 도입 후 12 시드 + 5 신규 = 17건 모두 `category_main` 16종 set 안에 분류 완료

### 라우트
- `routes/PageRoutes.js` 에 `requireLogin` import + 신규 라우트 등록
- `routes/ApiRoutes.js` 에 `GET /api/bill/:id/analysis-status` 추가

### URL 컨벤션
| 경로 | 의미 |
|---|---|
| `/bill?has_analysis=Y` | 분석 있는 것만 |
| `/bill?has_analysis=N` | 분석 없는 것만 |
| `/bill?ai_category_main=조세·재정` | AI main 카테고리 (쉼표 분리 복수 지원) |
| `/bill?request_status=any` | 미분석 + 요청 1명+ |
| `/bill?request_status=priority` | 미분석 + 임계값 도달 |
| `/bill?sort=ai_priority` | 분석 있음 우선 |
| `/bill?sort=requested` | 요청 많은 순 |
| `/bill?ai_category=...` | (구버전 호환 — 자동으로 `ai_category_main` 으로 매핑) |

---

## 2026-04-25 — 의원 상세 구조 재편 + 모바일 UX 개선

### 의원 상세 페이지 정보 구조 단순화 (`views/politician/politician_detail.ejs`)
분석 정보가 **히어로 레이더 / 사이드바 카드 3개 / 개요 탭** 3곳에 중복 흩어져 있던 문제 해결. 하나의 "분석" 탭으로 응집.
- 탭 순서 재배치 + 이름 변경: `[개요 분석, 법안 활동, 표결 내역, 국민 평가]` → `[분석, 법안 활동, 표결 내역, 국민 평가]`, **분석이 기본 오픈 탭** (기존 기본은 법안 활동)
- **히어로 레이더(4축 다이아몬드) 제거** — 분석 탭에 동일 레이더 있음
- **사이드바 전체 제거** (`<aside class="sidebar">`) — 3개 카드 모두 중복:
  - `표결 요약` 도넛 차트 → 분석 탭 "표결 성향" 바 차트
  - `관심 분야 Top 5` → 분석 탭 "대표발의 관심분야 TOP 5"
  - `기본 정보` → **별도 카드 없이 아바타 오른쪽 컬럼에 통합**. `.profile-subinfo` 라는 `<dl>` 로 meta 행 아래에 이어지도록 배치 (border-top 구분선). 중복 제거: 지역구·선출방식·재선·위원회는 meta 행에 이미 있어서 subinfo 에서 뺌. 남는 항목은 생년월일·성별·이메일·홈페이지·국회 프로필 5가지
    - 레이아웃: `display: flex; flex-wrap: wrap; gap: 10px 28px` — 자연스럽게 흘러가는 배치
    - 이메일만 `.full { flex-basis: 100% }` 으로 단독 행 → 시각적 흐름이 `생년월일·성별 / 이메일 / 홈페이지·국회프로필` 3줄
    - `dt` 의 `min-width` 미설정 — 라벨 글자 폭만 차지해서 "성별 남성" 같은 짧은 항목도 라벨·값이 10px 간격으로 붙음
    - 모바일(≤1024px): 각 항목 `flex-basis: 100%` 로 수직 스택, identity 블록 전체 중앙 정렬
    - 외부 링크 카피 통일: 홈페이지·국회 프로필 모두 "바로가기 →"
- `content-wrap` CSS: `grid-template-columns: 1fr 300px` → 단일 컬럼, 반응형 `.content-wrap { grid-template-columns: 1fr }` 삭제
- 사용 안 하게 된 CSS 삭제: `.sidebar`, `.profile-radar-wrap`, `.profile-radar-label`
- **히어로 KPI 행(발의·표결 참여율·가결율)을 분석 탭 최상단으로 이동** — 모바일 세로 스택 시 `아바타+이름 → 기본정보` 가 바로 이어져 한 눈에 들어오도록. 분석 탭은 "숫자 요약 → 시각화" 흐름(KPI 행 → 레이더/표결성향/관심분야 그리드)
- `.profile-identity { margin-bottom: 24px }` 제거 — KPI 행이 빠져서 뒤에 뭔가 이어지지 않으므로
- 법안 활동 탭 카드 링크: `b.link_url` (국회 원안) → `/bill/<%= b.bill_id %>` (내부 법안 상세)

### 모바일 반응형 개선
- **헤더 wordmark 모바일에서도 노출** — 원래 `display: none` 이었던 걸 높이 `28px → 22px` 로 축소 + 표시 (`main.css:130`)
- **법안 데이터 갱신 시각을 햄버거 패널 상단에 추가** (`.pb-mobile-freshness`) — nav 배지는 공간 제약으로 모바일에서 숨긴 대신 메뉴 열면 최상단에서 바로 보이도록
- **의원 리스트 그리드/리스트 토글 모바일에서 자동 리스트 강제** — `#grid-view { display: none !important }` / `#list-view { display: block !important }`, 토글 버튼 자체도 숨김 (`views/politician/politician.ejs`)
- **의원 리스트 사이드바 필터를 모바일 바텀시트로** — `.filter-sheet-btn` 추가, `body.filter-sheet-open` 으로 슬라이드업, 백드롭·× 버튼·ESC 닫기, 활성 필터 개수 배지(sex/ageBucket/cmit/elect 합산, party 는 히스토그램 UI 라 제외)

### ROADMAP 갱신
- 2순위 17번 "의원 상세 개요 분석 탭 오픈" 항목 완료 처리 (분석 탭 오픈 + 재편으로 대체) — 라인 제거, 이후 번호 재매핑

### 공용 `.pb-page-header` 패턴 (`public/styles/main.css`)
섹션별 페이지 타이틀 UI 가 `bill/politician` (hero 그라디언트), `glossary/community/about` (평범한 wrapper) 로 일관성 없이 나뉘어 있던 것을 하나로 통일.
- `main.css` 에 `.pb-page-header / .pb-page-header-inner / .pb-page-title / .pb-page-desc` 추가
  - `margin-top: calc(-1 * var(--nav-h))` + `border-top: var(--nav-h) solid transparent` 트릭으로 그라디언트가 고정 nav 뒤까지 깔림
  - `padding: 72px 24px 32px` — breadcrumb 제거한 뒤 타이틀(Bebas Neue 44px) 이 nav 에 가려지던 문제 해결 (기존 40px → 72px)
  - `.pb-page-header-inner` 는 `flex + justify-content: space-between` 이라 우측에 액션 버튼(예: 커뮤니티 글쓰기) 배치 가능
- 적용: `bill.ejs` / `politician.ejs` / `glossary.ejs` / `community/list.ejs` / `about.ejs` — 페이지 자체 CSS 제거 + HTML 만 공용 클래스로 교체
- Breadcrumb 정책 확정: **목록/랜딩 페이지는 제거**(bill, politician, glossary), 상세/sub 페이지는 유지(bill_detail, politician_detail, community/detail, community/write)
- Wrapper 계열 padding 통일: 이전엔 28/36/64px 섞여 있던 걸 `calc(var(--nav-h) + 36px)` 한 벌로 (`bill_detail` 28→36, `about-main-container` 64→calc, 글로벌 `.pb-page-header` 는 자체적으로 nav 처리하므로 그 하위 wrapper 는 `36px` 만)

### 의원 분석 탭 월별 발의 막대 그래프 개선 (`views/politician/politician_detail.ejs`)
- **버그 수정**: `.month-bar.highlight { background: var(--cyan) }` 에서 `--cyan` 이 어디에도 정의돼있지 않아 transparent 로 떨어져 max 대비 80% 이상인 월이 안 보이던 문제 — `var(--accent2)` (브랜드 골드 호버톤) 로 교체
- 0건 월 차트 렌더 생략 (`<% if (cnt > 0) %>`) + 기존 `min-height: 2px → 6px` 로 1건도 확실히 보이게
- 값 레이블 (`.month-val`) 호버에서만 노출 → **항상 노출**로 변경. `.month-bar` 내부로 이동해서 막대 높이에 따라 레이블 위치가 따라오도록 (이전엔 wrapper 최상단에 고정되어 짧은 막대와 시각적 단절)
- 차트 높이 `120px → 140px`, `padding: 0 0 24px → 18px 0 24px` — 상단 값 레이블 공간 확보

### 표결 성향 바 차트 수치 보강 (`views/politician/politician_detail.ejs`)
- 기존 "찬성 비율 45.2%" → "찬성 비율 45.2% (1,234건)" — 퍼센트 옆에 실제 건수 괄호로 병기. 찬성/반대/기권/불참 4개 항목 모두

### 법안 페이지 사이드바 위원회 이름 축약 (`views/bill/bill.ejs`)
긴 위원회 이름이 우측 카운트 영역을 침범하던 문제. 데스크톱만 축약, 모바일 바텀시트는 여유가 있으니 줄바꿈으로 전체 노출.
- 데스크톱: `.side-item-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis }` — CSS 말줄임 (처음엔 서버사이드 `slice(0, 8) + '…'` 로 구현했다가 모바일/데스크톱 분기를 CSS 로 단순화). `title` 속성은 호버 툴팁으로 전체 이름 노출
- 모바일(바텀시트): `white-space: normal; word-break: keep-all` — 폭 여유로 줄바꿈

### 필터 시트 UX 전면 개편 (의원 + 법안 공통)
선택 즉시 검색이 아니라 **여러 항목 선택 후 적용**으로 변경. PC 사이드바도 동일 패턴.
- 사이드바 상단에 `.filter-sheet-header` 상시 노출 (sticky) — `[필터] [초기화] [적용] [×(모바일 only)]`
- 클릭 시 `.active` / `.sheet-pending` 만 토글, `applyFilter()` / navigation 은 **적용 버튼에서만** 커밋
- 취소(×·백드롭·ESC): 시트 열기 전 상태로 복원 (politician 은 state 스냅샷, bill 은 URL 재로드)
- **복수선택 지원**:
  - `politician.ejs` — `state.sex/ageBucket/cmit/elect` 를 배열로 전환, 카테고리 내 OR · 카테고리 간 AND 매칭. 배지는 선택 항목 총 개수
  - `bill.ejs` — `pendingCmt` / `pendingParty` Set 관리, 적용 시 `?committee=A,B&party=X,Y` URL 로 navigation. "기타/특별위원회" 는 minor 이름들의 쉼표 연결 value 로 atomic 토글 (그룹 내 모든 이름이 pending 에 있을 때만 active)
- `.sheet-pending` CSS 전역화 — 서버렌더 `.active` 는 JS init 에서 제거 후 `.sheet-pending` 으로 교체하여 이후 인터랙션은 pending 만 관리

### 법안 페이지 정당 필터 (복수선택)
서버사이드 party 필터 신규 추가.
- `daos/queries/bill/getList.sql` — `$6 party` 파라미터 + `LEFT JOIN politicians p ON p.mona_cd = b.mona_cd` + `COALESCE(p.party_name, '기타/무소속') = ANY(string_to_array($6, ','))`
- `getStatusCounts.sql` — committee 와 동일하게 party 필터도 반영하여 상태 탭 숫자 일관성 유지 (`$2 party`)
- `BillDao` / `BillService` / `BillController` 시그니처에 party 전파
- `views/bill/bill.ejs` — 정당별 사이드바 `<div class="side-item">` → `<a class="side-item" data-party-value="X" href="…">` 로 전환, "전체" 항목 추가. 각 링크 `href` 에 현재 query.committee/search/status 보존. 폼 hidden input · 상태탭 링크 · 페이징 hrefBuilder 전부 `query.party` 포함

### 법안·의원 필터바 모바일 구조 통일
- 모바일에서 **필터 버튼이 검색 바 위**로 올라가도록 `filter-sheet-btn { flex-basis: 100%; justify-content: center }`
- 의원 페이지: 총원 count 를 `filter-right` 안으로 이동 → 바 우측에 검색 입력과 함께 정렬. 모바일에선 `.filter-right { width: 100% }` + `.filter-count { margin-left: auto }`

### 모바일 의원 리스트 (`views/politician/politician.ejs`)
그리드 토글 숨김 후 리스트 전용으로 전환한 뒤, 리스트 아이템 정보 밀도 개선.
- 기존 열 구조 `[avatar, 의원, 정당(text), 발의, 공동, 상세]` 6열 → `[avatar, 이름+정당배지, 발의, 공동, 상세]` 5열
- 정당 텍스트 컬럼 제거 + 이름 옆에 `.pol-party-badge` 컬러 배지 inline (PC 그리드 카드와 동일 색상)
- 모바일(≤768px): 공동·상세 컬럼 숨김, 발의 숫자 옆에 "발의" 라벨 노출 (`.pol-list-num-label { display: none }` 기본 + 모바일에서 `display: inline-block`)

### 홈 모바일 가로 오버플로우 수정 (`views/index.ejs`)
주목할 법안 카드가 좁은 viewport(~500px 이하)에서 우측이 잘리는 문제.
- **원인**: 그리드 트랙 `grid-template-columns: 1fr` 의 default `min-width: auto` 때문에 카드의 intrinsic min-content (긴 위원회명 배지 등)가 트랙을 컨테이너 밖으로 밀어냄
- **해결**: `minmax(0, 1fr)` 로 트랙이 content min-content 와 무관하게 0 까지 축소되도록 함 (`.trending-grid`, `.home-kpi` 모두 적용)
- 부가: 모바일 padding 축소 (`.pb-section` 24→12, 카드 24→18/14), 긴 토큰 안전 분리 (`overflow-wrap: anywhere` 를 `.bill-name` · `.pb-badge` 에), `.kpi-card.large` 세로 스택
- 정리: 처음엔 `.pb-main { overflow-x: clip }`, `.pb-section { overflow-x: hidden }`, 다중 `min-width: 0` 같은 방어 코드를 여럿 깔았으나 `minmax(0, ...)` 도입 후 모두 불필요해져 제거

### "시민" → "국민" 용어 통일
중립성 브랜드 톤 조정. 사용자 노출 전부 교체.
- UI: `layout.ejs` OG/meta × 3, `bill_detail.ejs` "국민 찬반"·"국민 의견"·"로그인한 국민들", `auth/setup.ejs` 닉네임 placeholder "현명한국민", `interactions.js` 에러 메시지
- 주석: bill_detail / main.css / interactions.js / getStats.sql 각종 주석
- 문서: CLAUDE.md (스키마 주석, 라우트·API 설명), ROADMAP.md, ANALYSIS.md, CHANGELOG 과거 항목
- 유지: DB 테이블 `bill_citizen_votes`, 폴더 `citizen_vote/`, 함수 `PB.mountCitizenVote()`, CSS 클래스 `.citizen-vote-section` 등 **기술 식별자는 그대로** — 내부 레이블만 바꾸면 대규모 리팩토링 유발

---

## 2026-04-24 (밤) — 데이터 갱신 시각 배지

### 의미 없던 `● LIVE` 정적 배지 → "● 법안 N시간 전 갱신" 으로 교체
nav 우측 배지가 실제 시그널을 전달하도록 수정. `syncBills.js` 가 `ON CONFLICT ... updated_at = NOW()` 로 시각을 찍어주고 있어서 스키마 변경 없이 `MAX(bills.updated_at)` 한 줄로 구현 가능했음. 크론 배치 도입 시 배지가 자연스럽게 살아있는 시그널이 됨.

### 구현
- `utils/dataFreshness.js` 신규
  - `getBillFreshness(db)` — `MAX(bills.updated_at)` 조회 + 10분 메모리 캐시
  - `formatRelativeKo(date)` — 분/시간/일/주/달 한국어 상대시간 (음수 방어 → "방금 전")
  - `dataFreshnessMiddleware(db)` — `res.locals.dataFreshness = { lastUpdated, relative, absolute }` 주입, 조회 실패 시 이전 캐시 유지·없으면 `null`
- `app.js` — `injectUser` 다음에 미들웨어 등록
- `views/layout.ejs` — `● LIVE` → `<% if (locals.dataFreshness) %>` 조건부 `● 법안 <%= relative %> 갱신` + `title` 속성에 절대시각 (Asia/Seoul 로케일)
- `public/styles/main.css` `.pb-nav-badge` — `JetBrains Mono` 제거(한글 대응) + `white-space: nowrap` + 모바일(≤768px) `display: none`

### 판단 배경
- **표결 갱신 시각은 의도적으로 제외** — `bill_votes` 엔 `updated_at` 컬럼이 없고, `MAX(vote_date)` 는 "국회가 마지막으로 표결한 날"이라 "데이터 신선도"와 의미가 다름. nav 배지엔 단일 시그널만 노출.
- 방문자 수·실시간 접속자는 초기엔 작은 숫자가 오히려 신뢰도를 깎고, 실시간 추적은 heartbeat 인프라가 별도로 필요해서 제외.

---

## 2026-04-24 (저녁) — 표결 명단 모달화 + 한글 초성 검색 + 카피 톤 조정

### 본회의 표결 결과 UI 개편 (`views/bill/bill_detail.ejs`)
기존 4박스 아래 2×2 `.vote-lists` 로 늘어뜨리던 명단을 전부 **모달**로 옮김 — 상세 페이지 스크롤 피로도 해소.
- 찬성/반대/기권/불참 박스를 `<button data-bucket="...">` 으로 전환, 숫자 아래 "명단 보기" 힌트
- 0표 버킷은 `data-empty` 로 클릭 비활성
- 모달 구성: 버킷 라벨(색상 점) + 정당별 필터 칩(카운트 포함, 인원 많은 순) + 이름 검색 + 5열 × 8줄 고정 그리드(`height: 456px`)
- 명단 chip 은 발의자 섹션의 `.proposer-chip` 재사용 → 시각 일관성
- 정당별 chip 배경 tint — `politician.ejs` 6색 팔레트 재사용 (민주당 청색 / 국민의힘 적색 / 조국혁신 자색 / 개혁신당 주황 / 진보당 적갈 / 기타 회색, bg 0.08 alpha / border 0.28 alpha)
- 퇴임 의원: 필터에 "퇴임 N명" 칩으로 집계 표시, 개별 chip 은 `.retired` 로 클릭 불가 회색 유지
- 모달 닫기: backdrop · × 버튼 · ESC · body 스크롤 잠금
- 폐기된 CSS: `.vote-lists / .vote-list-container / .voter-list / .retired-voter`
- 모바일(≤768px): 그리드 `auto-fill minmax(130px, 1fr)` 2열, 높이 `60vh`

### 한글 초성 검색 헬퍼 (`public/scripts/interactions.js`)
공용으로 쓸 수 있게 `PB` 네임스페이스에 추가.
- `PB.toChoseong('김철수') → 'ㄱㅊㅅ'` — U+AC00~D7A3 음절을 `(code-AC00)/588` 로 초성 인덱스 계산 후 compat-jamo 로 변환
- `PB.isChoseongOnly(q)` — 쿼리가 compat-jamo 자음(ㄱ-ㅎ)만인지 판별
- `PB.matchesQuery(target, query)` — 1) 직접 `includes` (영문은 `toLowerCase`) 2) 실패 & 쿼리가 초성만이면 `toChoseong(target).includes(q)` fallback
- 적용: 법안 상세 표결 모달 이름 검색, 의원 리스트(이름 + 지역구 — `ㅈㄹ` → "종로" 매칭)

### 사용자 노출 카피 "추적" → "확인" 교체
감시·미행 뉘앙스가 중립성 브랜드와 어긋나 4곳 교체. 내부 기술 문맥(prompt_version 추적, 비용 추적, request trace ID, filter dataset 추적)은 의미가 달라 그대로 유지.
- `views/index.ejs` — "실시간 **추적** 중" / "모든 활동을 **추적**합니다"
- `views/politician/politician.ejs` — "의정 활동을 모두 **추적**합니다"
- `views/bill/bill.ejs` — "발의부터 처리까지 모두 **추적**합니다"

---

## 2026-04-24 — AI 법안 분석 기능 1차 구현

### 분석 원칙 수립 ([ANALYSIS.md](./ANALYSIS.md) 신규)
- 법안 분석 설계 원칙 14개 수립 (v1 → v4 진화)
- 4개 모델 × 4개 프롬프트 버전 × 4개 법안 유형 실증 테스트
- Haiku + v4 프롬프트를 메인 엔진으로 확정
- 예산 97% 절감: $252 가정 → $7.5 확정

### UI 표시 원칙 수립 (5-Zone 구조)
- Progressive Disclosure · Reading Rhythm · Time Promise 원리 기반
- Zone 1 훅 / Zone 2 빠른 이해 / Zone 3 쟁점 / Zone 4 판단 / Zone 5 전문 정보
- MVP는 Zone 1~4 (Zone 5 는 후속 작업)

### DB 구조 (`etc/ddl/bill_ai_analysis.sql` 신규)
- `bill_ai_analysis` 테이블 신설 — JSONB 중심, 5-Zone 구조 직접 매핑
  - `summary / category / reading_time_min / changes / affected / issues / context / limitations / judgment_questions`
  - 메타: `model / prompt_version / tokens_input / tokens_output / cost_usd / needs_review / review_status`
- 인덱스: `prompt_version` / `needs_review (partial WHERE TRUE)` / `category`
- `update_updated_at()` 공용 트리거 적용
- 환경교육법(`bill_id=PRC_J2J6R0S4Q1R3P1P0O3K1K0J9J4I1I0`) 샘플 INSERT 포함 — `prompt_version='v4-sample'` 로 실제 분석과 구분, `ON CONFLICT DO UPDATE` 멱등

### 백엔드 구현
- `daos/queries/bill/getAiAnalysis.sql` 신규
- `BillDao.getAiAnalysis(billId)` — 없으면 null 반환
- `BillService.getAiAnalysis` 프록시 추가
- `BillController.getDetailPage` — 기존 `Promise.all` 에 병렬 조회 합류 + 실패 시 null fallback + `logger.warn`

### 프론트엔드 UI (`views/bill/bill_detail.ejs`)
- 법안 상세 페이지 5-Zone UI 구조 추가 (인라인 `<style>` 약 260줄)
- XSS-safe JSON 주입: `JSON.stringify(analysis).replace(/</g, '\\u003c')` — `</script>` 브레이크아웃 차단 (3곳 적용)
- 섹션 재배열: 메타 → AI 분석 → 원문 → 국민 찬반(`#citizen-vote-section`) → 본회의 → 발의자 → 댓글
- Noto Serif KR `wght@400;700;900` 폰트 로드 (`views/layout.ejs`)

### 위젯 (`public/scripts/interactions.js`)
- `PB.mountBillAnalysis` 신규
- `renderRichText()` 헬퍼 — 전체 HTML 이스케이프 후 `<strong>` 페어만 복원하는 선별 이스케이프
- Zone 3 accordion — 첫 번째만 기본 펼침, 클릭 시 `max-height` 트랜지션, 아이콘 `↓ 펼치기 ↔ ↑ 접기`
- Zone 4 "찬반 투표하기" → `#citizen-vote-section` smooth scroll (기본 full-width 골드 버튼 1개)
- "더 알아보기" 버튼은 Zone 5 구현 전까지 렌더하지 않음
- `bill.link_url` falsy 시 국회 원문 링크 미렌더

### 법안 상세 헤더 리팩토링
- `.bd-header` 카드와 Zone 1의 정보 중복 제거 — 헤더 카드 완전 삭제
- 통합된 카드 구조:
  - 분석 있음: 메타 2줄(식별자 / 발의 정보) + 법안명(`<h1>`) + 한 줄 요약(`<h2>`, 세리프 28px/900) + 태그 3개
  - 분석 없음: `.bill-basic-header` — 메타 2줄 + 법안명. Zone 1과 동일한 카드 스타일(공용 셀렉터)
- 발의일 포맷 `YYYY-MM-DD → YYYY.MM.DD`
- 대표발의자 이름에 `/politician/:id` 링크 (`proposer_mona_cd` 있을 때)
- 국회 원문 버튼을 헤더 카드 우측 상단으로 이동(`.zone-1-top > .original-link`) — 이전엔 헤더와 국민찬반 사이에 단독으로 떠 있어 시각적으로 분리됨
- 폐기된 클래스: `.bd-header / .bd-title / .bd-meta / .bd-meta-row / .bd-external` (main.css 공유 shadow 셀렉터에서도 제거)

### 모바일 대응 (≤768px)
- Zone 2 카드: grid 3열 → 세로 스택 1열
- Zone 4 CTA: flex → 세로 스택
- Zone 1 한 줄 요약: 28px → 22px, 법안명: 22px → 19px
- 국회 원문 링크: 폰트 11px · padding 3px 8px 로 축소, `flex-wrap + margin-left:auto` 로 공간 부족 시 메타 아래 오른쪽 정렬

---

## 2026-04-23 (저녁) — login 로고도 분리 배치

nav 와 같은 이유(워드마크 텍스트 작음) 로 **login 카드 로고도 마크+워드마크 분리** 로 교체.
- 기존: `<img src="logo-primary.svg" class="auth-logo-img" height=44>`
- 변경: `mark-only.svg` 48×48 + `wordmark-nav.svg` h36px (gap 12px)
- CSS: `.auth-logo-img` → `.auth-logo-mark-img` + `.auth-logo-wordmark-img`
- `logo-primary.svg` 는 login 에서 빠짐 → 현재 전 페이지 미사용 (보존)

---

## 2026-04-23 (오후) — 브랜드 에셋 통합 & 메타태그

공식 로고/파비콘 세트 확정 → 프로젝트 전반에 배치.

### 에셋 구성 (`public/assets/imgs/`)
- **로고 풀셋**: `logo-primary.svg` (골드 #B8740C, 480×120), `logo-white.svg` (다크 배경용), `logo-mono.svg` (인쇄용)
- **분리 요소**: `mark-only.svg` (64×64 서클+체크마크), `wordmark-kr.svg` (정치 바로미터 + "내 한표의 바로미터" 2줄), `wordmark-en.svg` (영문 태그라인), `wordmark-nav.svg` (280×48 단일행, nav 전용)
- **파비콘**: `favicon.ico`, `favicon-16.svg`, `favicon-32.svg`, `apple-touch-180.png`
- **앱 아이콘**: `app-icon-192.png`, `app-icon-512.png`, `app-icon-1024.png` (스토어용)
- **OG**: `og-image.png` (1200×630)
- **로딩 연출(미배치, 대기)**: `splash.svg` (0.8s 원 → 0.3s 세로 → 0.25s 사선 한번 그리기), `spinner.svg` (2.5s 루프)

### layout.ejs `<head>`
- Primary: description/keywords/theme-color(#B8740C)
- Favicon 5종 링크 + `rel="manifest"` href="/manifest.json"
- OG 11개: type/title/description/url/image(+w:1200/h:630)/site_name/locale=ko_KR
  - url/image 모두 `process.env.BASE_URL` 기반 절대 URL (`BASE_URL + (locals.currentUrl || '/')`)
- Twitter: `summary_large_image` 카드 4종

### nav 로고 구조 (layout.ejs + main.css)
단일 `logo-primary.svg` 로는 워드마크 글자가 눌려서 작게 렌더링 → **마크+워드마크 분리**로 각각 독립 크기 제어.
```html
<a href="/" class="pb-logo" aria-label="정치 바로미터">
  <img src="/assets/imgs/mark-only.svg"    class="pb-logo-mark-img"     alt="" aria-hidden="true">
  <img src="/assets/imgs/wordmark-nav.svg" class="pb-logo-wordmark-img" alt="정치 바로미터">
</a>
```
- 데스크탑: 마크 36×36 + 워드마크 h28px (gap 10px)
- ≤768px: `.pb-logo-wordmark-img { display: none }`, 마크 32×32 로 축소
- `wordmark-nav.svg` 는 태그라인 제거한 단일행 전용 (`wordmark-kr.svg` 는 태그라인 포함 보존)

### login 카드 로고
- 기존 clip-path 다이아몬드 + Bebas Neue 텍스트 → `logo-primary.svg` h44px 로 교체
- `.auth-logo-mark`, `.auth-logo-text` CSS 제거

### PWA manifest (`public/manifest.json` 신규)
```json
{
  "name": "정치 바로미터", "short_name": "바로미터",
  "start_url": "/", "display": "standalone",
  "background_color": "#F7F6F1", "theme_color": "#B8740C",
  "icons": [{ src, sizes: "192x192"|"512x512", purpose: "any maskable" }]
}
```
- Android Chrome "홈 화면에 추가" 시 theme-color/icon 적용
- iOS 는 `apple-touch-icon` 링크로 별도 처리

### 구조 변경 요약
- 삭제: `.pb-logo-mark` (clip-path 다이아몬드), `.pb-logo-text`, `.auth-logo-mark`, `.auth-logo-text` (CSS + HTML 전 레포)
- 유지: `old_header.ejs` (참조 0건, 추후 정리), `_logo.png`/`_favicon.png` (언더스코어 백업)

---

## 2026-04-23 (오전) — 대형 리팩토링

### 분류 체계 전환: bill_topic_cd → committee
핵심 아키텍처 변경. `codes.BILL_TOPIC` (수동 16개 분류) 체계를 폐기하고 **위원회(committee)** 단일 기준으로 통합.

- `syncBills.js` 에 `committee`, `committee_id` 컬럼 저장 추가
- `updateCommittee.js` 신규 — 기존 레코드 일괄 보강
- SQL 8개 파일에서 `LEFT JOIN codes BILL_TOPIC` 제거, `committee AS bill_topic_nm` 로 단일 소스화
  - `getTopicCounts`, `getList`, `getStatusCounts`, `getTrending`, `getDetail`, `getListOne`, `getBillsByMonaCd`, `getVotesByMonaCd`
- `getList.sql` 필터 파라미터: `bill_topic_cd (int)` → `committee (text, 쉼표 분리 복수 지원)`
- URL 파라미터 전면 교체: `/bill?topic=1` → `/bill?committee=보건복지위원회`

### 홈페이지 개편
- **카테고리 탭 고정 9개** (전체/보건복지/조세재정/산업기술/노동환경/국토주택/과학ICT/교육/사법행정) — 위원회명 링크
- **주목할 법안 정렬 탭 신규** — 최근 가결 / 박빙 표결 / 많은 동참 / 여야 협력
  - `/api/bills/trending?sort=...` JSON 엔드포인트 + JS 동적 재렌더
  - SQL은 `CASE WHEN $1` 분기로 단일 쿼리 유지
- `getTrending.sql` — 가결(`원안가결/수정가결`)만 노출, `DISTINCT ON (bill_name)` dedupe
- 히어로 카드 중첩 `<a>` 파싱 버그 수정 — `<a class="pb-help">` 9곳 전부 `<span data-help-href>` 로 교체, `interactions.js` 에 클릭 위임 추가

### 의원 상세 레이더
- **6축 육각형 → 4축 다이아몬드** (법안발의 / 공동발의 / 표결참여 / 가결율)
  - 데이터 없던 3축(출석률·위원회·소통) 제거 → "일부 축 데이터 수집 후 반영" 안내 제거
  - 꼭짓점에 라벨 + 수치 함께 표시 ("법안발의 30건" 등)
- 스케일 기준 DB 실시간 집계 — `getRadarScale.sql` (p90 분위수)
- 프로필 사진 96px → 240px (레이더와 동급)
- 표결요약 도넛 확대 (90→120, 내부 % 수치 30px)
- 법안 탭 페이징 버그 수정 (필터/페이지 상태를 `dataset.filtered` 로 분리)
- 국회 공식프로필 URL 신규 포맷 (`/members/22nd/{ENG_NM}`)

### 필터 UX
- **카테고리 ↔ 상태 탭 연동** — `getStatusCounts` 에 committee 파라미터 추가. committee 선택 시 스테퍼 4단계·상태 탭 8개 숫자가 모두 해당 위원회 기준으로 재계산
- 사이드바 100건 미만 위원회 → "기타/특별위원회" 자동 묶음 (콤마 분리 URL 사용)
- 긴 위원회명 wrap (`word-break: keep-all`, `flex:1`, `min-width:0`)
- 사이드바 sticky + 내부 스크롤 + `flex-shrink:0` 패턴 (의원/법안 목록 공통)
- `body { overflow-x: hidden → clip }` — sticky 동작 정상화 root cause

### 커뮤니티 & 댓글
- 상세 페이지 3개 카드 → 1개 카드로 통합 (`.post-card` + section border-bottom)
- 목록 카드 이모지(👁👍💬) → SVG 아이콘, 패딩 업
- 글쓰기 "법안 검색" 버튼 제거, 검색창 항상 노출
- **댓글 대댓글 1단계 중첩** (`buildTree` root 플랫화, tombstone 처리, 답글 버튼 root 전용)

### 기타
- 홈 trending 쿼리/index.ejs 전반에 null 방어
- 법안 카드 미니바: `vote_for || vote_against` 체크로 기권만 있는 경우 skip
- 법안번호 뱃지 축소 (11px → 10px + opacity 0.7)

---

## 2026-04-22 — UI 개편·인증·상호작용·커뮤니티

### UI 전면 개편
1. **다크 → 라이트 테마 전환** (베이지 bg + 골드 --accent #B8740C, `--blue` 변수 제거·`--accent` 로 리네이밍)
2. **디자인 크리틱 반영**: 중립 컬러·이니셜 아바타·KPI 해석 문구·계류 경과일·법안 뱃지 `?` 용어 링크
3. **타이포/컴포넌트 업스케일** (14→15px, nav 56→60px, 카드 padding/radius 확대, JetBrains Mono 1px 업)
4. **페이지 시그니처 요소**: 홈 월별 추이 라인차트, 의원 목록 정당 히스토그램, 법안 목록 4단계 스테퍼, 의원 상세 레이더 260px 승격

### 인증 시스템 구축
5. **Passport + express-session + connect-pg-simple** 세팅
6. **구글·카카오 OAuth** (비즈 미승인 대응: email NULL 허용)
7. **신규 가입 `/auth/setup` 플로우**: 닉네임(필수, 2~20자 한/영/숫자/_) + 성별 + 연령대 **3개 모두 필수**
8. **회원 탈퇴**: 개인정보만 익명화, `gender/age_group` 은 통계용으로 보존

### 상호작용 기능
9. **댓글 API** (`type: politician | bill | post`, 소프트 삭제)
10. **의원 별점** (1~5, 평균·분포·나의 점수)
11. **법안 국민 찬반** (의원 본회의 표결과 분리, 1인 1표 변경 가능)
12. **좋아요 토글** (comment/post)
13. **용어 설명 페이지** (`/glossary`, 목차 + 4섹션, 뱃지 `?` 링크 연결)

### 커뮤니티
14. **게시판** (`/community` 목록/작성/수정/삭제/상세, 20개/페이지)
15. **법안 첨부 기능**: 작성 중 `/api/bills/search` 디바운스 검색 → 1건 첨부, 상세에서 카드로 링크

---

## 폐기된 배치 파일

| 파일 | 사유 | 폐기 시점 |
|------|------|-----------|
| `topicUpdate.js` | Claude API 기반 16종 분류 — **committee 단일 기준으로 대체** | 2026-04-23 |
| `updateByCommittee.js` | DB 직접 committee→topic_cd 매핑 — **committee 자체를 쓰므로 매핑 불필요** | 2026-04-23 |

> 두 파일은 현재 코드베이스에 남아있으나 호출부 없음. 베타 이후 `bill_topic_cd` 컬럼 DB 드롭 시점에 함께 삭제 예정.
