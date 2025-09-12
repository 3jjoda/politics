const express = require('express');
const app = express();
app.use(express.static('public'));
app.use(express.json());

const port = 3000;

/** mysql */
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'test_db'
});


// 1. 데이터베이스 연결
db.connect((err) => {
    if (err) {
        console.error('MySQL 연결 실패:', err);
        return; // 연결 실패 시 서버 시작 중단
    }
    console.log('MySQL 연결 성공!');
    
    // 2. 데이터베이스 연결 성공 시 웹 서버 실행
    app.get('/', (req, res) => {
        res.send('Hello, World!');
    });

    app.post('/api/inquiry', (req, res) => {
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

    // 모든 견적 목록을 가져오는 API
    app.get('/api/inquiries', (req, res) => {
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
    app.get('/api/inquiries/:id', (req, res) => {
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


    app.listen(port, () => {
        console.log(`웹 서버가 실행되었습니다: http://localhost:${port}`);
    });
});
