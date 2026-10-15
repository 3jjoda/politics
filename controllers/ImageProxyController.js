// controllers/ImageProxyController.js — 의원 공식 사진 같은-출처 프록시 (2026-10-15)
//
// GET /img/politician/:monaCd → politicians.photo_url 을 서버가 받아 그대로 흘려준다.
//
// 왜 필요한가: SNS 카드 표지(A형)가 의원 사진을 싣는데, assembly.go.kr 이미지를 그대로
// <img> 에 걸면 cardShot.js(브라우저 PNG 저장)가 깨진다 —
//   ① SVG foreignObject 캡처는 외부 리소스를 아예 못 받고,
//   ② inlineImages 의 fetch 가 교차 출처 CORS 에 막힌다.
// 같은 출처 URL 이면 둘 다 자연히 풀린다 (inlineImages 가 알아서 data URI 로 인라인한다).
//
// 🔴 URL 은 사용자 입력이 아니라 **우리 DB 의 photo_url** 이다 (mona_cd 로만 찾는다).
//    그래도 허용 호스트를 assembly.go.kr 로 못박는다 — DB 가 오염돼도 SSRF 통로가 되지 않게.
// ⚠️ 사진은 수 년 단위로 안 바뀐다 → 메모리 캐시(24h) + 브라우저 캐시(Cache-Control 1일).
//    309명 × ~100KB 라 상한을 둔다 (가장 오래된 것부터 비운다).

import logger from '../utils/logger.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 150;                       // ≈ 15MB 상한 (실측 공식 사진 50~150KB)
const FETCH_TIMEOUT_MS = 8000;
const ALLOWED_HOST = /(^|\.)assembly\.go\.kr$/;

export default (db) => {
    const cache = new Map();   // monaCd → { buf, type, at } (Map 은 삽입 순서를 지켜 FIFO 비우기가 된다)

    return {
        async getPoliticianPhoto(req, res) {
            const monaCd = String(req.params.monaCd || '').trim();
            // mona_cd 는 영대문자+숫자 고정폭 코드다 — 형식 밖이면 DB 까지 안 간다
            if (!/^[A-Z0-9_]{4,20}$/.test(monaCd)) return res.status(404).end();

            try {
                const hit = cache.get(monaCd);
                if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
                    res.set('Content-Type', hit.type);
                    res.set('Cache-Control', 'public, max-age=86400');
                    return res.send(hit.buf);
                }

                const { rows } = await db.query(
                    'SELECT photo_url FROM politicians WHERE mona_cd = $1', [monaCd]);
                const url = rows[0]?.photo_url;
                if (!url) return res.status(404).end();

                let host;
                try { host = new URL(url).hostname; } catch { return res.status(404).end(); }
                if (!ALLOWED_HOST.test(host)) return res.status(404).end();

                const ctl = new AbortController();
                const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
                let upstream;
                try {
                    upstream = await fetch(url, { signal: ctl.signal, redirect: 'follow' });
                } finally { clearTimeout(timer); }
                if (!upstream.ok) return res.status(404).end();

                const type = (upstream.headers.get('content-type') || 'image/jpeg').split(';')[0];
                if (!type.startsWith('image/')) return res.status(404).end();
                const buf = Buffer.from(await upstream.arrayBuffer());

                cache.set(monaCd, { buf, type, at: Date.now() });
                while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);

                res.set('Content-Type', type);
                res.set('Cache-Control', 'public, max-age=86400');
                return res.send(buf);
            } catch (err) {
                // 원천 장애는 우리 장애가 아니다 — 로그만 남기고 404 (카드 쪽은 사진 없으면 B형으로 접는다)
                logger.error(`[imgProxy] 의원 사진 프록시 실패 (${monaCd}): ${err.message}`);
                return res.status(404).end();
            }
        },
    };
};
