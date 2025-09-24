import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js'; // 로거 추가

const countFilePath = path.resolve('./visitor_count.json');
let visitorData = {};

// 서버 시작 시 파일 내용을 메모리로 미리 불러옴
async function loadCount() {
    try {
        const fileContent = await fs.readFile(countFilePath, 'utf8');
        visitorData = JSON.parse(fileContent);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(countFilePath, JSON.stringify({}));
        } else {
            logger.error("방문자 수 파일 로딩 실패:", error);
        }
    }
}

// 10초에 한 번씩만 파일에 저장하여 부하를 줄임
let isSaving = false;
let lastSaveTime = Date.now();
async function saveCount() {
    if (!isSaving && Date.now() - lastSaveTime > 10000) {
        isSaving = true;
        try {
            await fs.writeFile(countFilePath, JSON.stringify(visitorData));
            lastSaveTime = Date.now();
        } catch (error) {
            logger.error("방문자 수 파일 저장 실패:", error);
        } finally {
            isSaving = false;
        }
    }
}

// 미들웨어 함수
export function visitorCounter() {
    return (req, res, next) => {
        const today = new Date().toISOString().split('T')[0]; // 오늘 날짜 (예: '2025-09-25')
        
        // 세션에 오늘 방문 기록이 없으면 카운트 증가
        if (!req.session.lastVisit || req.session.lastVisit !== today) {
            visitorData[today] = (visitorData[today] || 0) + 1;
            req.session.lastVisit = today; // 세션에 오늘 날짜 기록
            saveCount(); // 파일 저장 시도
        }

        // res.locals를 통해 EJS 템플릿에 항상 오늘자 방문자 수를 전달
        res.locals.visitorCount = visitorData[today] || 0;
        
        next(); // 다음 작업으로 전달
    };
}

// 서버 시작 시 최초 1회 실행
loadCount();