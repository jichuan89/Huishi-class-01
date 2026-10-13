import { chromium } from '../../teacher-studio/frontend/node_modules/playwright/index.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const videoPath = process.argv[2];
if (!videoPath) throw new Error('Pass the local gesture video path.');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
try {
  const bytes = await readFile(videoPath);
  await page.route('**/__gesture_video.mp4', route => route.fulfill({ contentType: 'video/mp4', body: bytes }));
  await page.route('**/__gesture_video_inspect', route => route.fulfill({ contentType: 'text/html', body: '<video id="video" muted preload="auto" src="/__gesture_video.mp4"></video>' }));
  await page.goto('http://localhost:3000/__gesture_video_inspect');
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
  const metadata = await page.evaluate(() => {
    const v = document.querySelector('video');
    return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
  });
  console.log(JSON.stringify(metadata));
  const result = await page.evaluate(async () => {
    const v = document.querySelector('video');
    const canvas = document.createElement('canvas');
    const width = 480, height = Math.round(width * v.videoHeight / v.videoWidth);
    canvas.width = width * 3; canvas.height = (height + 24) * 3;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 9; i++) {
      const at = (i + .5) * v.duration / 9;
      await new Promise(resolve => { v.onseeked = resolve; v.currentTime = at; });
      const x = i % 3 * width, y = Math.floor(i / 3) * (height + 24);
      ctx.drawImage(v, x, y, width, height);
      ctx.fillStyle = '#fff'; ctx.font = '16px Arial'; ctx.fillText(at.toFixed(2) + 's', x + 8, y + height + 18);
    }
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await mkdir('outputs/swipe-video-check', { recursive: true });
  await writeFile('outputs/swipe-video-check/contact-sheet.png', Buffer.from(result, 'base64'));
} finally { await browser.close(); }
