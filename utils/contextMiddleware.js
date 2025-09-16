import { asyncLocalStorage } from './context.js';
import crypto from 'crypto';

export const contextMiddleware = (req, res, next) => {
    const requestId = crypto.randomUUID(); // 요청 추적용 ID

    asyncLocalStorage.run({
        route: req.path,
        method: req.method,
        user: req.user?.id || 'anonymous',
        requestId,
        userAgent: req.headers['user-agent'] || 'unknown'
    }, () => {
        next(); // 요청 흐름 안에서 컨텍스트 유지됨
    });
};