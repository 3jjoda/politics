// utils/shortsKit.js — 유튜브 쇼츠 배치 공용 (genBriefingVideo · genQuizVideo)
//   TTS(edge-tts 기본 / macOS say) · 자막 컷 나누기 · SRT · 프레임 캡처 · ffmpeg 조립
//   🔴 로컬 전용 운영 도구의 부품이다 (Railway 에 올리지 않는다)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { shoot } from './headlessShot.js';

export const W = 1080, H = 1920;   // 쇼츠 9:16
export const BG = '#F7F6F1';
export const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...opts });
export const has = (cmd) => { try { sh('which', [cmd]); return true; } catch { return false; } };
export const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function probeDuration(file) {
    const out = sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim();
    return Number(out) || 0;
}

/* TTS 설정 — 배치가 인자를 읽어 넘긴다 */
export const ttsConfig = { engine: 'edge', voice: 'ko-KR-InJoonNeural', rate: '+8%' };
/* TTS — 문장 → wav. edge-tts 는 mp3, `say` 는 aiff 로 뱉으므로 ffmpeg 로 wav 변환. 빈 문장이면 무음 1초 */
let EDGE_CMD = null;   // ['edge-tts'] 또는 ['python3','-m','edge_tts']
export function edgeCmd() {
    if (EDGE_CMD) return EDGE_CMD;
    if (has('edge-tts')) return (EDGE_CMD = ['edge-tts']);
    for (const py of ['python3', 'python']) {
        try { sh(py, ['-c', 'import edge_tts']); return (EDGE_CMD = [py, '-m', 'edge_tts']); } catch {}
    }
    return null;
}
const EDGE_PY = `
import asyncio, edge_tts, json, sys
text, voice, rate, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
async def m():
    c = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    ws = []
    with open(out, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary": ws.append({"t": ch["offset"] / 1e7, "d": ch["duration"] / 1e7, "w": ch["text"]})
    print(json.dumps(ws))
asyncio.run(m())
`;
/* 문장 → wav. 반환: 단어 시각 [{t,d,w}] (edge 만 — 자막 컷을 말과 맞추는 데 쓴다. say 는 [] )
   🔴 앞 무음은 자르지 않는다 — 단어 시각이 원본 기준이라 앞을 자르면 전부 어긋난다. 뒤 무음만 자른다 */
export function tts(text, outWav) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) { silence(1, outWav); return []; }
    if (ttsConfig.engine === 'say') {
        const aiff = outWav.replace(/\.wav$/, '.aiff');
        sh('say', ['-v', ttsConfig.voice, '-r', String(ttsConfig.rate), '-o', aiff, t]);
        sh('ffmpeg', ['-y', '-i', aiff, '-ar', '44100', '-ac', '1', outWav]);
        fs.unlinkSync(aiff);
        return [];
    }
    const mp3 = outWav.replace(/\.wav$/, '.mp3');
    const [cmd, ...pre] = edgeCmd();
    let words = [];
    if (pre.length) {   // python 모듈 경로 — 단어 시각까지 받는다
        const out = sh(cmd, ['-c', EDGE_PY, t, ttsConfig.voice, ttsConfig.rate, mp3]);
        try { words = JSON.parse(out.trim().split('\n').pop()); } catch { words = []; }
    } else {
        sh(cmd, ['--voice', ttsConfig.voice, `--rate=${ttsConfig.rate}`, '--text', t, '--write-media', mp3]);
    }
    sh('ffmpeg', ['-y', '-i', mp3, '-af', 'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse', '-ar', '44100', '-ac', '1', outWav]);
    fs.unlinkSync(mp3);
    return words;
}

/* 자막 줄 → 컷 시작 시각. 단어 시각이 있으면 각 줄의 첫 단어 시각, 없으면 글자 수 비례 근사.
   줄은 toSubLines(text) 로 만든 것이라 text 안에서 순서대로 찾을 수 있다 */
export function cutTimes(text, lines, words, total) {
    const n = lines.length;
    if (!n) return [];
    const approx = () => {
        const wts = lines.map((l) => Math.max(4, [...l].length)), wsum = wts.reduce((a, b) => a + b, 0);
        const out = []; let acc = 0;
        for (const w of wts) { out.push(acc); acc += total * w / wsum; }
        return out;
    };
    if (!words || !words.length) return approx();
    const flat = String(text).replace(/\s+/g, ' ').trim();
    // 단어 → 문자 위치
    let pos = 0; const wpos = [];
    for (const w of words) {
        const i = flat.indexOf(w.w, pos);
        if (i < 0) { wpos.push(null); continue; }
        wpos.push(i); pos = i + w.w.length;
    }
    // 줄 → 문자 위치 (순서대로)
    let lp = 0; const starts = [];
    for (const l of lines) {
        const key = l.replace(/\s+/g, ' ').trim();
        const i = flat.indexOf(key, lp);
        starts.push(i < 0 ? null : i); if (i >= 0) lp = i + key.length;
    }
    if (starts.some((v) => v == null)) return approx();
    const out = starts.map((cs, li) => {
        if (li === 0) return 0;
        // 이 줄의 첫 문자 이상에서 시작하는 첫 단어
        for (let k = 0; k < words.length; k++) if (wpos[k] != null && wpos[k] >= cs) return Math.max(0, words[k].t - 0.05);
        return null;
    });
    if (out.some((v) => v == null)) return approx();
    for (let i = 1; i < out.length; i++) if (out[i] <= out[i - 1]) out[i] = out[i - 1] + 0.3;   // 단조 증가 보장
    return out;
}

/* 무음 wav (초) — 카운트다운 같은 말 없는 장면용 */
export function silence(sec, outWav) {
    sh('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(sec), outWav]);
}
/* 째깍 소리 wav — 카운트다운. 880Hz 짧은 삑 + 나머지 무음 */
export function tick(sec, outWav) {
    sh('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=0.07', '-af', `volume=0.35,apad=whole_dur=${sec}`, '-ar', '44100', '-ac', '1', outWav]);
}

export const shootFrame = (browser, htmlFile, outPng, budgetMs = 3000) =>
    shoot(browser, `file://${htmlFile}`, outPng, { width: W, height: H, budgetMs, extraArgs: ['--allow-file-access-from-files'] });

/* SRT 시각 포맷 (유튜브 자막 파일용 — 화면엔 굽지 않고 별도 업로드 가능) */
export const ts = (sec) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60), ms = Math.round((sec % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};
/* 나레이션을 자막 줄로 — 한 줄 24자 안팎으로 접는다 (세로 화면). 문장 단위 → 길면 공백에서 */
export function toSubLines(text) {
    const sents = String(text).split(/(?<=[.!?。])\s+/).filter(Boolean);
    const lines = [];
    for (const s of sents) {
        if ([...s].length <= 26) { lines.push(s); continue; }
        let cur = '';
        for (const w of s.split(' ')) {
            if ([...(cur + ' ' + w)].length > 26 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
        }
        if (cur) lines.push(cur);
    }
    // `2.` · `당 말고 사람.` 같은 짧은 조각은 혼자 한 컷이 되면 어색하다 → 다음 조각 앞에 붙인다 (마지막이면 앞 조각 뒤에)
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if ([...l].length < 8 && i + 1 < lines.length && [...(l + ' ' + lines[i + 1])].length <= 30) { lines[i + 1] = l + ' ' + lines[i + 1]; continue; }
        if ([...l].length < 8 && out.length && [...(out[out.length - 1] + ' ' + l)].length <= 30) { out[out.length - 1] += ' ' + l; continue; }
        out.push(l);
    }
    return out;
}


/* 프레임 목록 + 장면 오디오 목록 → mp4.
   frames: [{png,dur} | {seq:[png…],fps,dur}] · wavs: [{wav,dur}]
   - 정지 프레임은 **아주 느린 줌**(30fps, 최대 +5%)으로 살아 있게 하고, 컷 사이는 **0.25초 디졸브**(xfade) — "뚝뚝 끊기는" 느낌 제거
   - seq(연속 프레임 = 카운트다운 애니메이션)는 fps 그대로 30fps 로 올린다
   - 각 조각을 T 만큼 늘리고 T 만큼 겹치므로 총 길이는 Σdur 그대로 → 오디오와 어긋나지 않는다 */
export const XFADE = 0.25;
export function assemble(work, frames, wavs, out, { xfade = XFADE, zoom = true } = {}) {
    const segs = [];
    frames.forEach((f, i) => {
        const seg = path.join(work, `seg${i}.mp4`);
        const len = f.dur + xfade;
        if (f.seq) {
            const list = path.join(work, `seq${i}.txt`);
            const per = 1 / f.fps;
            fs.writeFileSync(list, f.seq.map((p) => `file '${p}'\nduration ${per.toFixed(4)}`).join('\n') + `\nfile '${f.seq[f.seq.length - 1]}'\n`, 'utf8');
            sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=30,tpad=stop_mode=clone:stop_duration=${xfade + 0.5},trim=duration=${len.toFixed(3)},setpts=PTS-STARTPTS`,
                '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', seg]);
        } else {
            const nfr = Math.max(1, Math.round(len * 30));
            const vf = zoom
                ? `scale=2160:3840,zoompan=z='min(1+0.00035*on,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${nfr}:s=${W}x${H}:fps=30,trim=duration=${len.toFixed(3)},setpts=PTS-STARTPTS`
                : `fps=30,trim=duration=${len.toFixed(3)},setpts=PTS-STARTPTS`;
            sh('ffmpeg', ['-y', '-loop', '1', '-framerate', '30', '-t', (len + 0.2).toFixed(3), '-i', f.png, '-vf', vf,
                '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', seg]);
        }
        segs.push({ seg, dur: f.dur });
    });
    // xfade 체인
    const vmp4 = path.join(work, 'v.mp4');
    if (segs.length === 1) fs.copyFileSync(segs[0].seg, vmp4);
    else {
        const inputs = segs.flatMap((s) => ['-i', s.seg]);
        let fc = '', prev = '[0:v]', off = 0;
        for (let i = 1; i < segs.length; i++) {
            off += segs[i - 1].dur;
            const outl = i === segs.length - 1 ? '[v]' : `[x${i}]`;
            fc += `${prev}[${i}:v]xfade=transition=fade:duration=${xfade}:offset=${off.toFixed(3)}${outl};`;
            prev = outl;
        }
        sh('ffmpeg', ['-y', ...inputs, '-filter_complex', fc.replace(/;$/, ''), '-map', '[v]', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', vmp4]);
    }
    // 오디오: 장면 wav 를 각 길이로 패딩 후 concat
    const apads = [];
    wavs.forEach((w, i) => {
        const p2 = path.join(work, `a${i + 1}.wav`);
        sh('ffmpeg', ['-y', '-i', w.wav, '-af', `apad,atrim=0:${w.dur.toFixed(3)}`, p2]);
        apads.push(p2);
    });
    const alist = path.join(work, 'a.txt');
    fs.writeFileSync(alist, apads.map((a2) => `file '${a2}'`).join('\n'), 'utf8');
    const awav = path.join(work, 'a.wav');
    sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', alist, '-c', 'copy', awav]);
    sh('ffmpeg', ['-y', '-i', vmp4, '-i', awav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out]);
    return out;
}

/* 카운트다운 링 HTML — 3초 동안 링이 줄고 숫자 3→2→1. progress 0..1 로 한 프레임 */
export function countdownHtml(baseCss, topHtml, questionHtml, progress, seconds = 3) {
    const left = seconds * (1 - progress);
    const digit = Math.max(1, Math.ceil(left - 1e-6));
    const frac = digit - left;                       // 0→1 안에서 이 숫자가 지나간 비율
    const R = 160, C = 2 * Math.PI * R;
    const dash = C * (1 - progress);
    const pop = 1 + 0.12 * Math.max(0, 1 - frac * 5); // 숫자 바뀐 직후 살짝 커졌다 줄어듦
    return `<!doctype html><meta charset="utf-8">${baseCss}<style>
.ring{position:absolute;left:50%;top:1000px;width:360px;height:360px;margin-left:-180px}
.cnt{position:absolute;left:0;right:0;top:1000px;height:360px;text-align:center;font:700 230px/360px "JetBrains Mono",monospace;color:#B8740C;transform:scale(${pop.toFixed(3)})}
</style>${topHtml}${questionHtml}<div class="ring"><svg width="360" height="360" viewBox="0 0 360 360"><circle cx="180" cy="180" r="${R}" fill="none" stroke="#E2DFD4" stroke-width="16"/><circle cx="180" cy="180" r="${R}" fill="none" stroke="#B8740C" stroke-width="16" stroke-linecap="round" transform="rotate(-90 180 180)" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C - dash).toFixed(1)}"/></svg></div><div class="cnt">${digit}</div>`;
}

/* 공통 CSS — 브랜드 서체(구글 폰트)·색. 장면 HTML 이 앞에 붙인다 */
export const FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700;900&family=Noto+Sans+KR:wght@400;500;700;800&family=JetBrains+Mono:wght@500;700&display=block" rel="stylesheet">';
const MARK = '<svg viewBox="0 0 64 64" width="{S}" height="{S}"><circle cx="32" cy="32" r="28" fill="none" stroke="#B8740C" stroke-width="5"/><path d="M32 16v32M32 30l12 10" fill="none" stroke="#B8740C" stroke-width="5" stroke-linecap="round"/></svg>';
export const mark = (size) => MARK.replace(/\{S\}/g, size);
export const BASE_CSS = `html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${BG};color:#1A1D24;font-family:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;word-break:keep-all}
.top{position:absolute;left:72px;right:72px;top:190px;display:flex;justify-content:space-between;align-items:center}
.brand{display:flex;align-items:center;gap:14px;font-weight:800;font-size:34px;color:#1A1D24}
.date{font:700 28px/1 "JetBrains Mono",monospace;color:#8F5800;letter-spacing:.08em}
.sub{position:absolute;left:60px;right:60px;top:1470px;bottom:230px;display:flex;align-items:flex-end;justify-content:center;text-align:center}
.sub span{display:inline-block;background:rgba(26,29,36,.92);color:#F7F6F1;font-size:46px;font-weight:800;line-height:1.35;padding:18px 32px;border-radius:16px}`;
export const subHtml = (line) => line ? `<div class="sub"><span>${esc(line)}</span></div>` : '';
