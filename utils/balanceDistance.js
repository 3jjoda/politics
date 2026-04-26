// utils/balanceDistance.js — 4축 좌표 사이 거리 계산
//
// 사용:
//   import { axisDistance, distanceBadge } from '../utils/balanceDistance.js';
//   const d = axisDistance(userAxis, polAxis);   // null | number (0~2)
//   const html = distanceBadge(userAxis, polAxis, version);  // 거리 배지 HTML 또는 회색 배지
//
// 거리 공식 (BALANCEGAME §11):
//   distance = sqrt((u.economy-p.economy)^2 + ... ) / 2
//   각 축 차이 [-2, +2] → 제곱합 [0, 16] → sqrt [0, 4] → /2 → [0, 2]
//   실제 분포는 대부분 [0, 1] 범위 (정당 평균 간 거리 ~0.6)

export function axisDistance(a, b) {
    if (!a || !b) return null;
    const ke = ['economy', 'social', 'security', 'institution'];
    let sum = 0;
    for (const k of ke) {
        const av = a[k];
        const bv = b[k];
        if (av === null || av === undefined || bv === null || bv === undefined) return null;
        sum += (av - bv) ** 2;
    }
    return Math.sqrt(sum) / 2;
}

// 의원 row에서 4축 좌표 추출 (axis_economy 등) — 좌표 미산출이면 null
export function politicianAxisOf(row) {
    if (row == null) return null;
    if (row.axis_economy === null || row.axis_economy === undefined) return null;
    return {
        economy:     parseFloat(row.axis_economy),
        social:      parseFloat(row.axis_social),
        security:    parseFloat(row.axis_security),
        institution: parseFloat(row.axis_institution),
    };
}
