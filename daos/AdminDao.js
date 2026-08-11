// daos/AdminDao.js — 관리자 화면 전용 (직위 CRUD)
//
// ⚠️ 여기서 다루는 건 politician_titles **뿐**이다.
//    politician_committees(상임위 직위)는 syncCommittees 가 매일 전체 교체하므로 편집 대상이 아니다.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const queriesPath = path.resolve(__dirname, 'queries/admin');

const queries = {};
fs.readdirSync(queriesPath).forEach((file) => {
    queries[path.basename(file, '.sql')] = fs.readFileSync(path.join(queriesPath, file), 'utf8');
});

export default (db) => ({
    getTitles: () => db.query(queries.getTitles).then((r) => r.rows),
    getPoliticianOptions: () => db.query(queries.getPoliticianOptions).then((r) => r.rows),
    getCommitteeRoles: () => db.query(queries.getCommitteeRoles).then((r) => r.rows),

    /* mona_cd 실재 확인 — FK 를 안 걸었으므로(승계 타이밍 대비) 오타가 조용히 통과한다.
       화면에서는 select 로만 고르지만, 폼은 조작될 수 있으니 서버에서 한 번 더 본다. */
    politicianExists: (monaCd) =>
        db.query('SELECT 1 FROM politicians WHERE mona_cd = $1', [monaCd]).then((r) => r.rowCount > 0),

    create: ({ monaCd, category, title, sourceUrl, note, reviewAfter }) =>
        db.query(`
            INSERT INTO politician_titles (mona_cd, category, title, source_url, note, review_after)
            VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING id`,
            [monaCd, category, title, sourceUrl || null, note || null, reviewAfter || null])
          .then((r) => r.rows[0].id),

    /* updated_at 은 트리거(trg_politician_titles_updated_at)가 갱신한다 — SET 에 넣지 않는다.
       그래서 이 화면에서 저장만 눌러도 "마지막 확인 시각" 이 자동으로 갱신되고,
       배치의 6개월 폴백 경고가 초기화된다 (재확인했다는 뜻이므로 의도된 동작). */
    update: (id, { monaCd, category, title, sourceUrl, note, reviewAfter }) =>
        db.query(`
            UPDATE politician_titles
               SET mona_cd = $2, category = $3, title = $4,
                   source_url = $5, note = $6, review_after = $7
             WHERE id = $1`,
            [id, monaCd, category, title, sourceUrl || null, note || null, reviewAfter || null])
          .then((r) => r.rowCount),

    remove: (id) =>
        db.query('DELETE FROM politician_titles WHERE id = $1', [id]).then((r) => r.rowCount),
});
