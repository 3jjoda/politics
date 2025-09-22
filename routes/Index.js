import inquiryRoutes from './InquiryRoutes.js';
import politicianRoutes from './PoliticianRoutes.js';

export default (app, db) => {
    // 각 라우터 모듈을 app에 등록합니다.
    app.use('/api', inquiryRoutes(db));
    app.use('/api', politicianRoutes(db));
};