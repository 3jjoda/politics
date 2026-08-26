// daos/ReportDao.js — 신고 접수 (관리자 처리 쪽은 AdminDao 에 있다)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const queriesPath = path.resolve(__dirname, 'queries/report');
const queries = {};
fs.readdirSync(queriesPath).forEach((f) => {
    queries[path.basename(f, '.sql')] = fs.readFileSync(path.join(queriesPath, f), 'utf8');
});

export default (db) => ({
    insert: ({ type, targetId, userId, reason }) =>
        db.query(queries.insert, [type, targetId, userId, reason]).then((r) => r.rows[0]),

    countForTarget: ({ type, targetId, userId = null }) =>
        db.query(queries.countForTarget, [type, targetId, userId]).then((r) => r.rows[0]),
});
