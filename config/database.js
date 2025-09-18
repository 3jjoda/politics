import 'dotenv/config';

// DB 설정을 객체로 정의하고 export
const dbConfig = {
    host: process.env.DB_HOST || 'localhost', // .env 값이 없으면 'localhost'를 기본값으로 사용
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    // .env 값은 문자열이므로 숫자로 변환하고, 값이 없으면 기본값 10을 사용
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
    queueLimit: 0
};

export default dbConfig;