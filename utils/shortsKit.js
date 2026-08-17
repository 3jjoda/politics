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
export function tts(text, outWav) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) { sh('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1', outWav]); return; }
    if (ttsConfig.engine === 'say') {
        const aiff = outWav.replace(/\.wav$/, '.aiff');
        sh('say', ['-v', ttsConfig.voice, '-r', String(ttsConfig.rate), '-o', aiff, t]);
        sh('ffmpeg', ['-y', '-i', aiff, '-ar', '44100', '-ac', '1', outWav]);
        fs.unlinkSync(aiff);
    } else {
        const mp3 = outWav.replace(/\.wav$/, '.mp3');
        const [cmd, ...pre] = edgeCmd();
        sh(cmd, [...pre, '--voice', ttsConfig.voice, `--rate=${ttsConfig.rate}`, '--text', t, '--write-media', mp3]);
        // 앞뒤 무음을 잘라 컷 타이밍이 말과 맞게 (edge-tts 는 앞에 0.1~0.3초 여백을 붙인다)
        sh('ffmpeg', ['-y', '-i', mp3, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse', '-ar', '44100', '-ac', '1', outWav]);
        fs.unlinkSync(mp3);
    }
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


/* 프레임 목록 + 장면 오디오 목록 → mp4. frames: [{png,dur}] · wavs: [{wav,dur}] */
export function assemble(work, frames, wavs, out) {
    const vlist = path.join(work, 'v.txt');
    fs.writeFileSync(vlist, frames.map((f) => `file '${f.png}'\nduration ${f.dur.toFixed(3)}`).join('\n') + `\nfile '${frames[frames.length - 1].png}'\n`, 'utf8');
    const vmp4 = path.join(work, 'v.mp4');
    sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', vlist, '-fps_mode', 'vfr', '-pix_fmt', 'yuv420p',
        '-c:v', 'libx264', '-crf', '20', '-tune', 'stillimage', vmp4]);
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
