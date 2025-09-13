// 모델은 db 객체를 외부에서 주입받아 사용합니다.
module.exports = (db) => {

    const Inquiry = {};

    // 새로운 문의를 데이터베이스에 저장
    Inquiry.create = (inquiryData, callback) => {
        const sql = 'INSERT INTO inquiries (name, email, phone, message) VALUES (?, ?, ?, ?)';
        const values = [inquiryData.name, inquiryData.email, inquiryData.phone, inquiryData.message];
        db.query(sql, values, callback);
    };

    // 모든 문의 목록을 조회
    Inquiry.getAll = (callback) => {
        const sql = 'SELECT id, name, email, phone, created_at FROM inquiries ORDER BY created_at DESC';
        db.query(sql, callback);
    };

    // 특정 ID의 문의 상세 내용을 조회
    Inquiry.getById = (id, callback) => {
        const sql = 'SELECT * FROM inquiries WHERE id = ?';
        db.query(sql, [id], callback);
    };

    return Inquiry;
};