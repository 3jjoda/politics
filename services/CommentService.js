import CommentDao from '../daos/CommentDao.js';
import { linkify } from '../utils/linkify.js';

// ⚠️ DB 의 comments_type_check 제약과 **반드시 같은 집합**이어야 한다.
//    한쪽만 넓히면 조용히 400 이 난다 (실제로 'briefing' 추가 때 DB 만 넓혔다가 겪음).
const VALID_TYPES = new Set(['politician', 'bill', 'post', 'briefing']);

export default (db) => {
    const dao = CommentDao(db);
    return {
        /* 최근 대화 피드 — 타입 검증이 필요 없다 (전 종류를 그대로 낸다) */
        listRecent: (limit, offset) => dao.listRecent(limit, offset),

        /* 🔴 링크 처리를 **서버에서** 한다 (2026-08-27). 댓글 위젯은 클라이언트 렌더라
           같은 규칙을 JS 에 한 벌 더 두면 반드시 갈린다 — 이 프로젝트가 반복해서 겪은 문제다
           (`_activity_row.ejs` ↔ JS `row()`, 아바타 팔레트…). `content_html` 을 같이 내려
           **`utils/linkify.js` 한 곳만** 규칙을 갖는다.
           ⚠️ 원문(`content`)도 그대로 둔다 — 수정 시 textarea 에 들어가야 한다.
           ⚠️ 줄바꿈은 `<br>` 로 바꾸지 않는다. `.comment-body` 가 `white-space: pre-wrap` 이라
              `\n` 이 그대로 줄바꿈이 된다 (게시글 본문 `.post-body` 와 같은 처리).
           ⚠️ 목록에만 붙인다 — create/update/delete 뒤 위젯이 `load()` 로 다시 받아간다 */
        list: async (type, targetId) => {
            if (!VALID_TYPES.has(type)) throw new Error('INVALID_TYPE');
            if (!targetId) throw new Error('INVALID_TARGET');
            const rows = await dao.list(type, String(targetId));
            return rows.map((r) => (
                /* 🔴 삭제된 댓글의 **원문을 내보내지 않는다.**
                   본인 삭제(`comment/softDelete.sql`)는 DB 에서 `content=''` 로 지우지만,
                   **관리자 삭제(`admin/setCommentDeleted.sql`)는 `is_deleted` 만 바꾸고 본문을 남긴다** —
                   「되살리기」 를 하려면 본문이 있어야 하기 때문이다 (그건 의도된 설계다).
                   그래서 그 경로로 지워진 댓글은 API 응답에 본문이 실려 개발자도구로 읽힌다.
                   화면은 「삭제된 댓글입니다」 묘비만 그리므로 여기서 잘라낸다 */
                r.is_deleted
                    ? { ...r, content: '', content_html: '' }
                    : { ...r, content_html: linkify(r.content) }
            ));
        },
        create: ({ type, targetId, parentId, userId, content }) => {
            if (!VALID_TYPES.has(type)) throw new Error('INVALID_TYPE');
            if (!targetId) throw new Error('INVALID_TARGET');
            const trimmed = String(content || '').trim();
            if (!trimmed) throw new Error('EMPTY_CONTENT');
            if (trimmed.length > 2000) throw new Error('TOO_LONG');
            return dao.insert({
                type,
                targetId: String(targetId),
                parentId: parentId ? Number(parentId) : null,
                userId,
                content: trimmed
            });
        },
        update: async ({ id, userId, content }) => {
            const trimmed = String(content || '').trim();
            if (!trimmed) throw new Error('EMPTY_CONTENT');
            if (trimmed.length > 2000) throw new Error('TOO_LONG');
            return dao.update({ id, userId, content: trimmed });
        },
        softDelete: ({ id, userId }) => dao.softDelete({ id, userId })
    };
};
