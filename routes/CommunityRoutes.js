// routes/CommunityRoutes.js
// 라우트 순서 주의:
//   /community/write 는 /community/:id 보다 먼저 선언해야 Express 가 '/write' 를 :id 로 매칭하지 않음

import express from 'express';
import PostController from '../controllers/PostController.js';
import { requireLogin } from '../middlewares/auth.js';

export default (db) => {
    const router = express.Router();
    const c = PostController(db);

    // 페이지
    router.get('/',              c.listPage);
    router.get('/write', requireLogin, c.writePage);
    router.get('/:id/edit', requireLogin, c.editPage);
    router.get('/:id',           c.detailPage);

    // REST
    router.post('/',         requireLogin, c.create);
    router.put('/:id',       requireLogin, c.update);
    router.delete('/:id',    requireLogin, c.remove);

    return router;
};
