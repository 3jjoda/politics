const express = require('express');
const router = express.Router();

// 모든 견적 목록을 가져오는 API
router.get('/inquiries', (req, res) => {
    const db = req.db;
    const sql = 'SELECT id, name, email, phone, created_at FROM inquiries ORDER BY created_at DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('견적 목록 조회 중 오류:', err);
            return res.status(500).json({ success: false, message: '데이터 조회 실패' });
        }
        res.status(200).json(results);
    });
});

// 특정 견적 상세를 가져오는 API
router.get('/inquiries/:id', (req, res) => {
    const db = req.db;
    const { id } = req.params;
    const sql = 'SELECT * FROM inquiries WHERE id = ?';
    db.query(sql, [id], (err, result) => {
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
});

// 새로운 견적을 저장하는 API
router.post('/inquiry', (req, res) => {
    const db = req.db;
    const { name, email, phone, message } = req.body;
    const sql = 'INSERT INTO inquiries (name, email, phone, message) VALUES (?, ?, ?, ?)';
    const values = [name, email, phone, message];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('문의 저장 중 오류:', err);
            return res.status(500).json({ success: false, message: 'DB 저장 실패' });
        }
        res.status(200).json({ success: true, message: '문의 접수 완료' });
    });
});

module.exports = router;