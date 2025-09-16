import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine( // 여러 포맷을 결합
    winston.format.colorize(), // 콘솔 색상 적용
    winston.format.timestamp(), // 시간 기록
    winston.format.printf(info => { // 커스텀 포맷 정의
      // SQL 쿼리 메시지는 줄바꿈을 포함한 그대로 출력
      // if (info.message.startsWith('Executing query:')) {
      //   return `${info.timestamp} ${info.level}: ${info.message}`;
      // }
      return `${info.timestamp} ${info.level}: ${info.message}`;
    })
  ),
  transports: [
    // 콘솔에 로그를 출력
    new winston.transports.Console(),
    // 오류 로그를 파일로 기록
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // 모든 로그를 파일로 기록
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

export default logger;