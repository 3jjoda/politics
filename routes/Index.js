// routes/index.js (최종본)
import pageRoutes from './PageRoutes.js';
import apiRoutes from './ApiRoutes.js';

export default (app, db) => {
    // 페이지 관련 주소들은 최상위 경로('/')에 연결
    app.use('/', pageRoutes(db));

    // API 관련 주소들은 '/api' 경로에 연결
    app.use('/api', apiRoutes(db));
};