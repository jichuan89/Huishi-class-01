// 浅色主题迁移脚本：把深色 UI 的中性色批量替换为浅色主题语义令牌。
// 跳过独立的深色 3D / 建模工作台子模块（保持深色设计）。
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const ROOT = process.cwd();
const SKIP_FILES = new Set(['ProceduralTerrain.tsx', 'ProceduralEarth.tsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'output', 'scripts', '.git']);
const EXTS = new Set(['.tsx', '.ts']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
let changed = 0;

for (const file of files) {
  if (SKIP_FILES.has(basename(file))) continue;
  let c = readFileSync(file, 'utf8');
  const orig = c;

  // 深色 hex 卡片/面板/弹窗/输入框 -> 浅色主题卡片底
  c = c.replace(/bg-\[#0[0-9a-fA-F]{5}(?:\/\d+)?\]/g, 'bg-cyan-50');
  // 浅色阶强调文字 -> 深色强调文字（保证浅底可读）
  c = c.replace(/text-cyan-\d+/g, 'text-cyan');
  // 浅色阶边框 -> 深色强调边框
  c = c.replace(/border-cyan-\d+/g, 'border-cyan');
  // 白字 -> 深色正文
  c = c.split('text-white').join('text-ink');
  // 白边框 -> 深色边框
  c = c.split('border-white').join('border-line');
  // 浅色次级文字 -> 深色次级文字
  c = c.split('text-slate-100').join('text-ink-soft');
  c = c.split('text-slate-200').join('text-ink-soft');
  c = c.split('text-slate-300').join('text-ink-soft');
  c = c.split('text-slate-400').join('text-ink-soft');
  // 深色玻璃 -> 主题色玻璃
  c = c.split('bg-black/').join('bg-cyan/');

  if (c !== orig) {
    writeFileSync(file, c);
    changed += 1;
    console.log('updated', file.replace(ROOT + '\\', ''));
  }
}

console.log(`\ndone, ${changed} files updated`);
