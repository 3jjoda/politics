// controllers/DistrictController.js — 지역구 공개 API (2026-08-23)
//
// 왜 공개인가: 비로그인도 지역구를 고를 수 있어야 한다. 로그인을 요구하면
// "성향 진단(20문항)보다 장벽이 낮다" 는 이 기능의 존재 이유가 사라진다.
// 🔴 여기서 다루는 건 **전부 공개 데이터**다 (지역구 목록·의원 프로필). 개인 정보가 없다.
//    비로그인 사용자의 선택은 **브라우저(localStorage)에만** 남고 서버에 오지 않는다 —
//    정치 사이트에서 "이 방문자의 지역구" 를 서버에 쌓지 않겠다는 뜻이다.
//    로그인 사용자만 users.district 에 저장한다 (본인이 준 값).

import DistrictService from '../services/DistrictService.js';
import logger from '../utils/logger.js';

export default (db) => {
    const service = DistrictService(db);

    /* 지역구 목록 (시도 그룹). 선거 때만 바뀌므로 서비스가 6시간 캐시한다 */
    const getList = async (req, res, next) => {
        try {
            const list = await service.getList();
            if (!list) return res.status(503).json({ error: 'UNAVAILABLE' });
            res.json({ groups: list.groups });
        } catch (err) { logger.error(`지역구 목록 API 실패 — ${err.message}`); next(err); }
    };

    /* 지역구 → 의원 한 명 (현직 우선).
       ⚠️ 모르는 지역구는 404. 화면이 "등록된 지역구가 더 이상 없다" 를 구분할 수 있어야 한다
          (행정구역 개편으로 사라질 수 있다). */
    const getMember = async (req, res, next) => {
        try {
            const d = String(req.query.d || '').trim();
            if (!d || !(await service.isValid(d))) return res.status(404).json({ error: 'NOT_FOUND' });
            const m = await service.getMember(d);
            if (!m) return res.status(404).json({ error: 'NOT_FOUND' });
            res.json({
                mona_cd: m.mona_cd, name: m.name, party_name: m.party_name,
                electoral_district: m.electoral_district, reelected: m.reelected,
                active_yn: m.active_yn, photo_url: m.photo_url,   // 홈 카드가 사진을 그린다 (2026-08-24)
            });
        } catch (err) { logger.error(`지역구 의원 API 실패 — ${err.message}`); next(err); }
    };

    return { getList, getMember };
};
