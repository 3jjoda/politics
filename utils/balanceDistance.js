// utils/balanceDistance.js — 사용자 좌표 ↔ 의원 좌표 거리 · 근사 일치도 (단일 소스)
//
// 사용 (app.locals 로 뷰에도 등록):
//   import { axisDistance, similarityPct, politicianAxisOf } from '../utils/balanceDistance.js';
//   const d   = axisDistance(userAxis, politicianAxisOf(row));   // null | number
//   const pct = similarityPct(d);                                 // null | 0~100 정수
//
// 🔴 어느 축을 세는지는 utils/axisConfig.js 의 MATCH_AXES 가 정한다 (2026-08-16 부터 3축 — 안보 제외).
//    뷰·SQL 어디서도 축을 손으로 나열하지 말 것. SQL 쪽(getMatchContext·getTopMatches·balanceGame 미들웨어)은
//    같은 3축을 쓴다 — 축을 바꾸면 그 셋도 같이 바꿔야 한다.
//
// 거리 = sqrt(Σ(u−p)²) / 2 · 일치도 = max(0, (1 − d/1.5) × 100)  — 분모 근거는 axisConfig 주석.

import { MATCH_AXES, MATCH_DENOM } from './axisConfig.js';

export function axisDistance(a, b) {
    if (!a || !b) return null;
    let sum = 0;
    for (const k of MATCH_AXES) {
        const av = a[k], bv = b[k];
        if (av === null || av === undefined || bv === null || bv === undefined || Number.isNaN(av) || Number.isNaN(bv)) return null;
        sum += (av - bv) ** 2;
    }
    return Math.sqrt(sum) / 2;
}

export function similarityPct(d) {
    if (d === null || d === undefined || Number.isNaN(d)) return null;
    return Math.max(0, Math.round((1 - d / MATCH_DENOM) * 100));
}

// 의원 row(axis_economy 등)에서 좌표 추출. 매칭 축 중 하나라도 없으면 null (거리를 못 낸다)
export function politicianAxisOf(row) {
    if (row == null) return null;
    const out = {};
    for (const k of MATCH_AXES) {
        const v = row['axis_' + k];
        if (v === null || v === undefined) return null;
        out[k] = parseFloat(v);
    }
    // 매칭엔 안 쓰지만 표시용으로 있으면 실어준다
    if (row.axis_security !== null && row.axis_security !== undefined) out.security = parseFloat(row.axis_security);
    return out;
}
