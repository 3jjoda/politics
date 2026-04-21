import 'dotenv/config';

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    max: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
    ...(process.env.DB_SSL === 'true' && { ssl: { rejectUnauthorized: false } }),
};

export default dbConfig;