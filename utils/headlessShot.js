// utils/headlessShot.js — 헤드리스 크롬/엣지로 URL 을 PNG 로 찍는다 (genInstaCards · genBriefingVideo 공용)
//
// 🔴 macOS 크롬은 `--screenshot` 을 다 찍고도 **프로세스가 안 끝난다** (업데이터·크래시 핸들러가 붙잡는다 — 2026-08-17 실측:
//    PNG 는 1~2초 안에 나오는데 execFileSync 는 60초 타임아웃으로 죽었다. `--timeout` 플래그도 소용없다).
//    → 자식으로 띄우고 **파일이 생겨 크기가 안정되면 우리가 죽인다.** 윈도우 Edge 는 알아서 끝나지만 같은 경로로 처리해도 무해하다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function findBrowser() {
    const LA = process.env.LOCALAPPDATA || '';
    return [
        process.env.CHROME_PATH,
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        LA && path.join(LA, 'Google/Chrome/Application/chrome.exe'),
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    ].filter(Boolean).find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) || null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} browser  실행 파일
 * @param {string} url      찍을 URL (http 또는 file://)
 * @param {string} outFile  PNG 경로
 * @param {object} o        { width, height, budgetMs(가상시계, 기본 6000), maxWaitMs(기본 30000), extraArgs[] }
 */
export async function shoot(browser, url, outFile, o = {}) {
    const width = o.width || 1080, height = o.height || 1350;
    try { fs.unlinkSync(outFile); } catch {}
    const args = [
        '--headless=new', '--disable-gpu', '--hide-scrollbars',
        '--disable-extensions', '--disable-crash-reporter', '--disable-component-update',
        '--no-first-run', '--no-default-browser-check',
        '--force-device-scale-factor=1',                 // 고DPI 에서 2배로 찍히는 것 방지
        `--window-size=${width},${height}`,
        `--virtual-time-budget=${o.budgetMs || 6000}`,   // 웹폰트 로드 전에 찍히는 것 방지
        `--user-data-dir=${path.join(os.tmpdir(), 'dangmalsa-shot')}`,
        ...(o.extraArgs || []),
        `--screenshot=${outFile}`,
        url,
    ];
    const child = spawn(browser, args, { stdio: 'ignore' });
    let exited = false;
    child.on('exit', () => { exited = true; });
    const t0 = Date.now(), maxWait = o.maxWaitMs || 30000;
    let lastSize = -1, stable = 0;
    while (Date.now() - t0 < maxWait) {
        await sleep(200);
        let size = -1;
        try { size = fs.statSync(outFile).size; } catch {}
        if (size > 0 && size === lastSize) { if (++stable >= 3) break; } else stable = 0;   // 600ms 동안 크기 불변이면 완료
        lastSize = size;
        if (exited) break;
    }
    if (!exited) { try { child.kill('SIGKILL'); } catch {} }
    if (!(lastSize > 0)) throw new Error(`screenshot 실패: ${url}`);
    return outFile;
}
