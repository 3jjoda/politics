// utils/promiseWrapper.js
/**
 * 콜백 기반의 DAO 함수를 Promise를 반환하는 함수로 래핑.
 * @param {Function} daoMethod 콜백을 마지막 인자로 받는 DAO 함수.
 * @returns {Function} Promise를 반환하는 새로운 함수.
 */
function wrapDaoCallback(daoMethod) {
    // ...args는 DAO 함수에 전달될 인자들 (id, searchKeyword 등)
    return function(...args) {
        return new Promise((resolve, reject) => {
            // DAO 함수를 호출하고, 마지막 인자로 콜백 함수를 전달
            daoMethod(...args, (err, results) => {
                if (err) {
                    return reject(err);
                }
                resolve(results);
            });
        });
    };
}

export { wrapDaoCallback };