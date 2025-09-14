const InquiryModel = require('../models/Inquiry');
let Inquiry;

module.exports = (db) => {
    // db 객체가 주입되면 모델을 초기화합니다.
    Inquiry = InquiryModel(db);

    const controller = {};

    // 모든 견적 목록을 가져오는 로직
    controller.getAllInquiries = (req, res) => {
        Inquiry.getAll((err, results) => {
            if (err) {
                console.error('견적 목록 조회 중 오류:', err);
                return res.status(500).json({ success: false, message: '데이터 조회 실패' });
            }
            res.status(200).json(results);
        });
    };

    // 특정 견적 상세를 가져오는 로직
    controller.getInquiryById = (req, res) => {
        const { id } = req.params;
        Inquiry.getById(id, (err, result) => {
            if (err) {
                console.error('견적 상세 조회 중 오류:', err);
                return res.status(500).json({ success: false, message: '데이터 조회 실패' });
            }
            if (result.length > 0) {
                res.status(200).json(result[0]);
            } else {
                res.status(404).json({ success: false, message: '견적을 찾을 수 없습니다' });
            }
        });
    };

    // 새로운 견적을 저장하는 로직
    controller.createInquiry = (req, res) => {
        const { name, email, phone, message } = req.body;
        if (!name || !email || !phone || !message) {
            return res.status(400).json({ success: false, message: '모든 필드를 입력해야 합니다.' });
        }
        
        const inquiryData = { name, email, phone, message };
        Inquiry.create(inquiryData, (err, result) => {
            if (err) {
                console.error('문의 저장 중 오류:', err);
                return res.status(500).json({ success: false, message: 'DB 저장 실패' });
            }
            res.status(200).json({ success: true, message: '문의 접수 완료' });
        });
    };

    return controller;
};