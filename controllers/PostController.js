import PostService from '../services/PostService.js';
import BillService from '../services/BillService.js';
import logger from '../utils/logger.js';
import { isAdminUser } from '../middlewares/auth.js';
import { POST_TYPES, allowedPostTypes, resolvePostType, postTypeOf } from '../utils/postTypes.js';

/* 무엇을 보나 — `posts` 는 **커뮤니티 글만**이다 (글에 달린 댓글은 `all` 에서 보인다).
   ⚠️ 키를 `post` 로 쓰지 말 것 — 댓글 종류(`comments.type='post'`)와 글자가 겹쳐 어느 쪽인지 안 보인다 */
const FEED_TABS = [
    { key: 'all',        label: '전체' },
    { key: 'bill',       label: '법안' },
    { key: 'politician', label: '의원' },
    { key: 'briefing',   label: '브리핑' },
    { key: 'posts',      label: '글' },
];
const FEED_FILTERS = FEED_TABS.map((t) => t.key);

export default (db) => {
    const postService = PostService(db);
    const billService = BillService(db);

    /* 링크된 법안 1건을 pending 폼 재렌더링용으로 준비 */
    const attachedBillFromId = async (billId) => {
        if (!billId) return null;
        const bills = await billService.search(billId);
        // search 가 bill_name LIKE 만 하니 여기선 단건 조회가 더 정확
        const detail = await billService.getDetail(billId);
        if (!detail || detail.length === 0) return null;
        const b = detail[0];
        return {
            bill_id: b.bill_id,
            bill_name: b.bill_name,
            proc_result_name: b.proc_result_name,
            committee: b.committee,
            propose_dt: b.propose_dt
        };
    };

    return {
        /* GET /community — 🔴 **통합 피드**가 기본이다 (2026-08-27, 4단계)
           글과 댓글이 한 줄기로 흐른다. 3단계까지는 둘이 탭으로 갈라져 있었는데, 그러면 댓글이
           여전히 탭 하나 뒤에 숨고 첫 화면은 계속 "대상 없는 글" 만 보여준다 — 고치려던 구조가 그대로 남는다.

           ?on=all|bill|politician|briefing|posts   무엇을 보나
           ?type=<글 유형>                          `on=posts` 일 때만 의미가 있다
           ⚠️ 모르는 값은 에러가 아니라 기본값으로 접는다 (/xray/chart 와 같은 판단) */
        listPage: async (req, res, next) => {
            try {
                const pageSize = 20;
                const page = Math.max(1, parseInt(req.query.page) || 1);
                const offset = (page - 1) * pageSize;

                const rawOn = String(req.query.on || '');
                const typeRaw = req.query.type ? String(req.query.type) : '';
                const postType = postTypeOf(typeRaw) ? typeRaw : null;
                /* 구 링크 호환: `?type=` 만 있으면 글 보기로 친다 (3단계까지의 주소) */
                const filter = FEED_FILTERS.includes(rawOn) ? rawOn : (postType ? 'posts' : 'all');
                /* 글 유형은 글 보기에서만 — 다른 보기에 걸리면 댓글이 통째로 빠진다 */
                const effType = filter === 'posts' ? postType : null;

                const [rows, counts] = await Promise.all([
                    postService.listFeed({ filter, postType: effType, limit: pageSize, offset }),
                    postService.countByType(),
                ]);
                const totalCount = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
                const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
                const countMap = Object.fromEntries(counts.map((r) => [r.post_type, Number(r.cnt)]));
                const allCount = counts.reduce((s, r) => s + Number(r.cnt), 0);

                const onLabel = (FEED_TABS.find((t) => t.key === filter) || {}).label || '전체';
                res.render('community/list', {
                    pageTitle: filter === 'all' ? '커뮤니티'
                        : (effType ? `${postTypeOf(effType).label} · 커뮤니티` : `${onLabel} · 커뮤니티`),
                    pageStyles: null,
                    currentUrl: '/community',
                    pageDesc: '당말사 커뮤니티. 법안·의원·브리핑에 달린 의견과 자유 게시글이 한자리에 모입니다',
                    rows, filter, feedTabs: FEED_TABS,
                    postTypes: POST_TYPES,
                    activeType: effType,
                    typeCounts: countMap,
                    allCount,
                    pagination: { page, pageSize, totalCount, totalPages }
                });
            } catch (err) { next(err); }
        },

        /* GET /community/write — 작성 페이지 */
        writePage: (req, res) => {
            const isAdmin = isAdminUser(req.user);
            /* ?type=bill 처럼 목록 탭에서 들어오면 그 유형을 미리 고른다 (권한 밖 값은 기본값) */
            const preset = resolvePostType(req.query.type, isAdmin) || 'free';
            res.render('community/write', {
                pageTitle: '글쓰기 · 커뮤니티',
                pageStyles: null,
                currentUrl: '/community/write',
                mode: 'create',
                post: { title: '', content: '', linked_bill_id: null, post_type: preset, is_pinned: false },
                attachedBill: null,
                postTypes: allowedPostTypes(isAdmin),   // 🔴 공지는 관리자에게만 보인다. 방어는 create 의 resolvePostType
                isAdmin,
                error: null
            });
        },

        /* GET /community/:id — 상세 */
        detailPage: async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                if (!Number.isInteger(id) || id <= 0) {
                    return res.status(404).render('error_pages/404', {
                        pageTitle: '게시글을 찾을 수 없음',
                        pageStyles: 'error',
                        message: '게시글 ID 가 올바르지 않습니다.'
                    });
                }
                const post = await postService.getById(id);
                if (!post || post.is_deleted) {
                    return res.status(404).render('error_pages/404', {
                        pageTitle: '게시글을 찾을 수 없음',
                        pageStyles: 'error',
                        message: '삭제되었거나 존재하지 않는 게시글입니다.'
                    });
                }
                // 조회수 증가 (본인 글도 카운트 — 스펙대로 단순하게)
                await postService.incrementViews(id);
                post.view_count = Number(post.view_count) + 1;

                res.render('community/detail', {
                    pageTitle: `${post.title} · 커뮤니티`,
                    pageStyles: null,
                    currentUrl: `/community/${id}`,
                    pageDesc: String(post.content || '').replace(/s+/g, ' ').slice(0, 140),
                    post,
                    postTypeMeta: postTypeOf(post.post_type)
                });
            } catch (err) { next(err); }
        },

        /* GET /community/:id/edit — 수정 페이지 */
        editPage: async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                const post = await postService.getById(id);
                if (!post || post.is_deleted) return res.redirect('/community');

                const userId = req.session.userId;
                if (post.user_id !== userId) {
                    return res.status(403).render('error_pages/404', {
                        pageTitle: '권한 없음',
                        pageStyles: 'error',
                        code: 403,
                        message: '본인 글만 수정할 수 있습니다.'
                    });
                }
                const attachedBill = await attachedBillFromId(post.linked_bill_id);
                const isAdmin = isAdminUser(req.user);
                res.render('community/write', {
                    pageTitle: '글 수정 · 커뮤니티',
                    pageStyles: null,
                    currentUrl: `/community/${id}/edit`,
                    mode: 'edit',
                    post,
                    attachedBill,
                    postTypes: allowedPostTypes(isAdmin),
                    isAdmin,
                    error: null
                });
            } catch (err) { next(err); }
        },

        /* POST /community — 작성 */
        create: async (req, res, next) => {
            try {
                const { title, content, linkedBillId, postType, isPinned } = req.body || {};
                const isAdmin = isAdminUser(req.user);
                /* 🔴 유형·권한 검증은 여기서 — 화면에서 공지를 숨기는 건 방어가 아니다 */
                const type = resolvePostType(postType, isAdmin);
                if (!type) return res.status(400).json({ error: '선택할 수 없는 글 유형입니다.' });
                const result = await postService.create({
                    userId: req.session.userId,
                    title,
                    content,
                    linkedBillId: linkedBillId || null,
                    postType: type,
                    isPinned: isAdmin && type === 'notice' && !!isPinned   // 고정은 관리자의 공지에만
                });
                res.status(201).json({ ok: true, id: result.id, redirectTo: `/community/${result.id}` });
            } catch (err) {
                if (err.code === 'VALIDATION') return res.status(400).json({ error: err.message });
                logger.error('게시글 작성 실패:', err.message);
                next(err);
            }
        },

        /* PUT /community/:id — 수정 */
        update: async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                const { title, content, linkedBillId, postType, isPinned } = req.body || {};
                const isAdmin = isAdminUser(req.user);
                const type = resolvePostType(postType, isAdmin);
                if (!type) return res.status(400).json({ error: '선택할 수 없는 글 유형입니다.' });
                const result = await postService.update({
                    id,
                    userId: req.session.userId,
                    title,
                    content,
                    linkedBillId: linkedBillId || null,
                    postType: type,
                    isPinned: isAdmin && type === 'notice' && !!isPinned
                });
                if (!result) return res.status(404).json({ error: 'NOT_FOUND_OR_FORBIDDEN' });
                res.json({ ok: true, id: result.id, redirectTo: `/community/${result.id}` });
            } catch (err) {
                if (err.code === 'VALIDATION') return res.status(400).json({ error: err.message });
                next(err);
            }
        },

        /* DELETE /community/:id — 삭제 */
        remove: async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                const result = await postService.softDelete({ id, userId: req.session.userId });
                if (!result) return res.status(404).json({ error: 'NOT_FOUND_OR_FORBIDDEN' });
                res.json({ ok: true, id: result.id, redirectTo: '/community' });
            } catch (err) { next(err); }
        }
    };
};
