import inquiryRoutes from './InquiryRoutes.js';
// import politicianRoutes from './politicianRoutes.js'; // 새로 추가될 라우트
// import userRoutes from './userRoutes.js'; // 계속해서 추가 가능

export default (app, db) => {
    // 각 라우터 모듈을 app에 등록합니다.
    app.use('/api', inquiryRoutes(db));
    // app.use('/api', politicianRoutes(db));
    // app.use('/api', userRoutes(db));
};