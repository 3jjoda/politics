// daos/DistrictDao.js — 지역구 조회
//
// 목록은 거의 안 바뀌고(선거 때만) 254행이라 서비스가 캐시한다.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const queriesPath = path.resolve(__dirname, 'queries/district');
const queries = {};
fs.readdirSync(queriesPath).forEach((f) => {
    queries[path.basename(f, '.sql')] = fs.readFileSync(path.join(queriesPath, f), 'utf8');
});

export default (db) => ({
    getList: () => db.query(queries.getDistrictList).then((r) => r.rows),
    getMember: (district) => db.query(queries.getByDistrict, [district]).then((r) => r.rows[0] || null),
});
