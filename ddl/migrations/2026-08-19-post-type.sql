-- 2026-08-19 커뮤니티 글 유형 + 공지 상단 고정
--
-- 왜: 커뮤니티에 공지사항을 같이 두려면 글에 유형이 있어야 하고, 공지는 관리자만 쓸 수 있어야 한다.
--     유형 목록·라벨·권한은 utils/postTypes.js 단일 소스 — 여기 CHECK 는 그 목록의 거울이다.
--     유형을 추가하면 두 곳을 같이 고칠 것 (CHECK 만 넓히면 서버가 400, 코드만 넓히면 DB 가 23514).
--
-- ⚠️ 기존 행은 전부 'free'(잡담) 가 된다. 이미 공지 성격의 글이 있으면 UPDATE 로 옮길 것.

ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS post_type VARCHAR(20) NOT NULL DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN     NOT NULL DEFAULT FALSE;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS chk_posts_post_type;
ALTER TABLE posts
    ADD CONSTRAINT chk_posts_post_type
    CHECK (post_type IN ('notice', 'free', 'bill', 'question', 'feedback'));

-- 목록 필터(유형 탭) + 고정 공지 우선 정렬용
CREATE INDEX IF NOT EXISTS idx_posts_type_id ON posts (post_type, id DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_posts_pinned  ON posts (id DESC)            WHERE is_deleted = FALSE AND is_pinned = TRUE;

COMMENT ON COLUMN posts.post_type IS '글 유형 (utils/postTypes.js): notice 공지(관리자만) · free 잡담 · bill 법안 이야기 · question 질문 · feedback 건의·피드백';
COMMENT ON COLUMN posts.is_pinned IS '목록 상단 고정 (관리자, 공지에 쓴다). 유형 필터와 무관하게 전체 탭 맨 위';

-- 확인
-- SELECT post_type, is_pinned, COUNT(*) FROM posts GROUP BY 1, 2;
