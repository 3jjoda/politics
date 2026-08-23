// services/DistrictService.js — 지역구 조회 + 내 지역구 의원
//
// 왜 있나 (2026-08-23): 개인화 진입점이 **성향 진단(20문항)뿐**이었는데 실측 완료자가 3명이다.
// 지역구는 로그인 후 클릭 두 번이라 장벽이 압도적으로 낮고, "당 말고 사람" 축에 정확히 맞는다.
//
// 🔴 **지역구 문자열을 저장하고 의원은 조회 시점에 찾는다.** 선거·보선으로 사람이 바뀌어도
//    "내 지역구" 는 유지되어야 한다 (실측: 현직+퇴임이 같이 있는 지역구 8군데).

import DistrictDao from '../daos/DistrictDao.js';
import logger from '../utils/logger.js';

const LIST_TTL_MS = 6 * 60 * 60 * 1000;   // 선거 때만 바뀐다. 6시간이면 넉넉

export default (db) => {
    const dao = DistrictDao(db);
    let listCache = null;
    let inflight = null;

    /* 지역구 목록 (시도 그룹). 실측 255개 · 시도 17종 */
    function getList() {
        if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return Promise.resolve(listCache.data);
        if (inflight) return inflight;
        inflight = dao.getList()
            .then((rows) => {
                // 화면이 <optgroup> 으로 쓰도록 시도별로 묶는다
                const bySido = new Map();
                rows.forEach((r) => {
                    if (!bySido.has(r.sido)) bySido.set(r.sido, []);
                    bySido.get(r.sido).push(r.district);
                });
                const data = {
                    groups: [...bySido.entries()].map(([sido, districts]) => ({ sido, districts })),
                    // 🔴 검증용 화이트리스트 — 사용자가 보낸 문자열은 이 집합 안에 있어야 저장한다
                    valid: new Set(rows.map((r) => r.district)),
                };
                listCache = { at: Date.now(), data };
                return data;
            })
            .catch((err) => { logger.error(`지역구 목록 조회 실패 — ${err.message}`); return null; })
            .finally(() => { inflight = null; });
        return inflight;
    }

    /* 사용자가 보낸 값이 실제 지역구인가 */
    const isValid = async (d) => {
        if (!d || typeof d !== 'string') return false;
        const list = await getList();
        return !!list && list.valid.has(d.trim());
    };

    /* 내 지역구 의원. 지역구가 없거나 사라졌으면 null (화면이 등록 CTA 를 그린다).
       ⚠️ 실패해도 null 을 돌린다 — 홈이 이것 때문에 죽으면 안 된다. */
    const getMember = (district) => {
        if (!district) return Promise.resolve(null);
        return dao.getMember(district).catch((err) => {
            logger.error(`지역구 의원 조회 실패(${district}) — ${err.message}`);
            return null;
        });
    };

    return { getList, isValid, getMember };
};
