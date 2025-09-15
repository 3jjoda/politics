const winston = require('winston');

const logger = winston.createLogger({
  level: 'info', // 기본 로그 레벨
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    /* 콘솔에 로그를 출력 */
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    /* 오류 로그를 파일로 기록 */
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    /* 모든 로그를 파일로 기록 */
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

module.exports = logger;