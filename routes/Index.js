// routes/index.js

import pageRoutes from './PageRoutes.js';
import apiRoutes from './ApiRoutes.js';
import authRoutes from './AuthRoutes.js';
import authApiRoutes from './api/AuthApiRoutes.js';
import commentRoutes from './api/CommentRoutes.js';
import ratingRoutes  from './api/RatingRoutes.js';
import voteRoutes    from './api/VoteRoutes.js';
import likeRoutes    from './api/LikeRoutes.js';

export default (app, db) => {
    // 인증
    app.use('/auth', authRoutes(db));

    // REST API
    app.use('/api/auth',     authApiRoutes(db));
    app.use('/api/comments', commentRoutes(db));
    app.use('/api/ratings',  ratingRoutes(db));
    app.use('/api/votes',    voteRoutes(db));
    app.use('/api/likes',    likeRoutes(db));

    // 기존 API
    app.use('/api', apiRoutes(db));

    // 페이지
    app.use('/', pageRoutes(db));
};
