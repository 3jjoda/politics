import { updateContext } from './context.js';

/**
 * 컨트롤러 함수명을 기반으로 action 태그 자동 설정
 */
export const wrapWithContext = (fn) => {
    const name = fn.name || 'anonymous';
    return function wrapped(req, res, next) {
        updateContext({ action: name });
        return fn(req, res, next);
    };
};