-- SNS 성과표 — /admin/sns 의 기록 화면이 쓴다 (2026-08-27)
--
-- 왜 파일(SNS_LOG.md)이 아니라 테이블인가: 게시 직후 폰에서 바로 적어야 기록이 안 끊긴다 (사용자 결정).
-- 지표(저장·도달·답글)는 게시 당일엔 비워두고 금요일에 채운다 — 그래서 전부 NULL 허용.
-- 팔로워 수 컬럼은 일부러 없다 (SNS.md: 첫 달 지표는 저장·답글·진단 시작 셋뿐).
CREATE TABLE IF NOT EXISTS sns_log (
    id         BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    posted_on  DATE         NOT NULL,                         -- 게시일 (폼 입력값 그대로 — 서버 CURRENT_DATE 안 씀)
    slot       VARCHAR(10)  NOT NULL DEFAULT ''               -- 아침 | 점심 | 저녁 | '' (게시 시각대 — 시각 가설 검증용)
               CHECK (slot IN ('', '아침', '점심', '저녁')),
    channel    VARCHAR(20)  NOT NULL
               CHECK (channel IN ('인스타', '쓰레드', '유튜브', '기타')),
    axis       VARCHAR(10)  NOT NULL                          -- 콘텐츠 엔진 4축 (SNS.md 2장)
               CHECK (axis IN ('당신', '숫자', '오늘', '사람', '브랜드')),
    format     VARCHAR(100) NOT NULL,                         -- 예: '문안 8' · '브리핑 캐러셀' · '숫자 캐러셀(계류)'
    saves      INT,                                           -- 인스타 저장 수
    reach      INT,                                           -- 도달
    replies    INT,                                           -- 쓰레드 답글 수 (셀프 답글 제외)
    note       TEXT         NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ  DEFAULT NOW(),
    updated_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sns_log_posted ON sns_log (posted_on DESC);
DROP TRIGGER IF EXISTS trg_sns_log_updated_at ON sns_log;
CREATE TRIGGER trg_sns_log_updated_at BEFORE UPDATE ON sns_log
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
