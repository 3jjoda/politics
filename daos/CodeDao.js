import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/code');

const queries = {};
fs.readdirSync(queriesPath).forEach(file => {
    const key = path.basename(file, '.sql');
    queries[key] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => {
    const dao = {};

    /**
     * 공통코드 조회
     */
    return {
        getList: async () => {
            try {
                // mysql2/promise 라이브러리의 query 함수는 Promise를 반환
                // await를 사용해 DB 조회가 끝날 때까지 기다린다
                const [rows] = await db.query(queries.getList);
    
                // 조회된 결과를 바로 반환
                return rows;
            } catch (error) {
                // 에러 발생 시 그대로 상위(서비스) 계층으로 에러를 던진다
                throw error;
            }
        }
    }
};
