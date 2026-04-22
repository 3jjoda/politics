import PostDao from '../daos/PostDao.js';

const TITLE_MAX = 200;
const CONTENT_MAX = 5000;

const validate = ({ title, content }) => {
    const t = String(title || '').trim();
    const c = String(content || '').trim();
    if (!t) return { ok: false, reason: '제목을 입력해주세요.' };
    if (t.length > TITLE_MAX) return { ok: false, reason: `제목은 ${TITLE_MAX}자 이내로 입력해주세요.` };
    if (!c) return { ok: false, reason: '내용을 입력해주세요.' };
    if (c.length > CONTENT_MAX) return { ok: false, reason: `내용은 ${CONTENT_MAX}자 이내로 입력해주세요.` };
    return { ok: true, title: t, content: c };
};

export default (db) => {
    const dao = PostDao(db);
    return {
        list: (params) => dao.list(params),

        getById: (id) => dao.getById(id),

        incrementViews: (id) => dao.incrementViews(id),

        create: async ({ userId, title, content, linkedBillId }) => {
            const v = validate({ title, content });
            if (!v.ok) { const e = new Error(v.reason); e.code = 'VALIDATION'; throw e; }
            const billId = linkedBillId ? String(linkedBillId).trim() : null;
            return dao.insert({ userId, title: v.title, content: v.content, linkedBillId: billId || null });
        },

        update: async ({ id, userId, title, content, linkedBillId }) => {
            const v = validate({ title, content });
            if (!v.ok) { const e = new Error(v.reason); e.code = 'VALIDATION'; throw e; }
            const billId = linkedBillId ? String(linkedBillId).trim() : null;
            return dao.update({ id, userId, title: v.title, content: v.content, linkedBillId: billId || null });
        },

        softDelete: ({ id, userId }) => dao.softDelete({ id, userId })
    };
};
