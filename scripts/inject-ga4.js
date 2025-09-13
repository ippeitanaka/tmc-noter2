#!/usr/bin/env node
/*
  GA4タグ(G-3K0XSVMYL7)を全HTMLの</head>直前に注入するスクリプト。
  - 再帰的に*.htmlを探索（node_modules, .git, .next等は除外）
  - 既に当該IDのgtagスニペットがあればスキップ
  - app_nameはパスから推測（/apps/<name>/ または 先頭ディレクトリ）
  - CSPのnonceが<head>内にあれば同じnonceを付与
  - BOM/EOL/インデントを可能な範囲で保持
  - 実行結果を標準出力に要約表示
*/

const fs = require('fs');
const path = require('path');

const MEASUREMENT_ID = 'G-3K0XSVMYL7';
const GA_URL = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;

const ROOT = process.cwd();
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.vercel', 'out', 'dist', 'build', 'coverage',
]);

/**
 * 再帰的にディレクトリを探索し、.htmlファイルを列挙
 */
function listHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.DS_Store')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      result.push(...listHtmlFiles(full));
    } else if (entry.isFile()) {
      if (entry.name.toLowerCase().endsWith('.html')) {
        result.push(full);
      }
    }
  }
  return result;
}

/**
 * 改行コードを推定
 */
function detectEol(text) {
  const crlf = text.includes('\r\n');
  return crlf ? '\r\n' : '\n';
}

/**
 * 先頭BOMの有無を判定
 */
function stripBom(buf) {
  const text = buf.toString('utf8');
  if (text.charCodeAt(0) === 0xFEFF) {
    return { text: text.slice(1), hadBom: true };
  }
  return { text, hadBom: false };
}

/**
 * </head>の最初の出現位置（大文字小文字無視）
 */
function indexOfClosingHead(html) {
  const match = html.match(/<\/head\s*>/i);
  return match ? { index: match.index, match: match[0] } : null;
}

/**
 * head内のscript nonceを取得（最初の一つ）
 */
function detectNonceInHead(html) {
  const headEnd = indexOfClosingHead(html);
  if (!headEnd) return null;
  const headPart = html.slice(0, headEnd.index);
  const m = headPart.match(/<script[^>]*\snonce=("|')([^"']+)(\1)[^>]*>/i);
  return m ? m[2] : null;
}

/**
 * 重複検出
 */
function hasGa4Already(html) {
  if (html.includes(GA_URL)) return true;
  const re = /gtag\(\s*["']config["']\s*,\s*["']G-3K0XSVMYL7["']\s*\)/i;
  return re.test(html);
}

/**
 * 直前行のインデント（空白/タブ）を推定
 */
function detectIndentBefore(html, insertPos) {
  const upToPos = html.slice(0, insertPos);
  const lastNl = upToPos.lastIndexOf('\n');
  const start = lastNl === -1 ? 0 : lastNl + 1;
  const line = upToPos.slice(start);
  const m = line.match(/^[\t ]*/);
  return m ? m[0] : '';
}

/**
 * パスからアプリ名を推測
 * 優先: /apps/<name>/ -> <name>
 * 次: 先頭ディレクトリ（ただし一般的な非アプリ名ディレクトリは除外）
 */
function guessAppName(absPath) {
  const rel = path.relative(ROOT, absPath).replace(/\\/g, '/');
  const m = rel.match(/(?:^|\/)apps\/([^\/]+)/);
  let name = m ? m[1] : null;
  if (!name) {
    const segments = rel.split('/').filter(Boolean);
    if (segments.length > 1) {
      const cand = segments[0];
      const ignore = new Set(['app', 'apps', 'public', 'dist', 'build', 'out', 'static', 'assets', 'node_modules', '.next', '.vercel', 'scripts', 'styles', 'components', 'lib', 'src', 'pages']);
      if (!ignore.has(cand)) name = cand;
    }
  }
  if (!name) return null;
  // TitleCase（ハイフン/アンダースコア/空白で分割）
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function buildSnippet({ indent, nonce, appName, eol }) {
  const i = indent || '';
  const i2 = i + '  ';
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
  const appPlaceholder = appName || 'APP_NAME_PLACEHOLDER';
  const todoLine = appName ? '' : `${i2}// TODO: set app name${eol}`;
  const lines = [
    `${i}<!-- Google tag (gtag.js) -->`,
    `${i}<script async${nonce ? ' nonce="' + nonce + '"' : ''} src="${GA_URL}"></script>`,
    `${i}<script${nonceAttr}>`,
    `${i2}window.dataLayer = window.dataLayer || [];`,
    `${i2}function gtag(){dataLayer.push(arguments);}`,
    `${i2}gtag('js', new Date());`,
    `${i2}gtag('config', '${MEASUREMENT_ID}');`,
    `${i2}// アプリ名をGA4へ送信（必要に応じて書き換え）`,
    todoLine ? todoLine.slice(0, -eol.length) : undefined,
    `${i2}gtag('event', 'app_loaded', { 'app_name': '${appPlaceholder}' });`,
    `${i}</script>`,
  ].filter((l) => l !== undefined);
  return lines.join(eol) + eol;
}

function processFile(file) {
  const raw = fs.readFileSync(file);
  const { text, hadBom } = stripBom(raw);
  const eol = detectEol(text);
  const html = text; // work on text without BOM

  if (!indexOfClosingHead(html)) {
    return { status: 'skipped-no-head' };
  }
  if (hasGa4Already(html)) {
    return { status: 'skipped-duplicate' };
  }

  const { index, match } = indexOfClosingHead(html);
  const indent = detectIndentBefore(html, index);
  const nonce = detectNonceInHead(html);
  const appName = guessAppName(file);
  const snippet = buildSnippet({ indent, nonce, appName, eol });

  const newHtml = html.slice(0, index) + snippet + html.slice(index);
  const final = (hadBom ? '\uFEFF' : '') + newHtml;
  fs.writeFileSync(file, final);
  return { status: appName ? 'modified' : 'modified-todo-app-name' };
}

function main() {
  const files = listHtmlFiles(ROOT);
  const results = [];
  for (const f of files) {
    try {
      const r = processFile(f);
      results.push({ file: path.relative(ROOT, f), ...r });
    } catch (e) {
      results.push({ file: path.relative(ROOT, f), status: 'error', error: e.message });
    }
  }

  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  // ログ出力
  console.log('--- GA4 Injection Summary ---');
  console.log(`Target files: ${files.length}`);
  console.log(`Modified: ${counts['modified'] || 0}`);
  console.log(`Modified (TODO app name): ${counts['modified-todo-app-name'] || 0}`);
  console.log(`Skipped (duplicate): ${counts['skipped-duplicate'] || 0}`);
  console.log(`Skipped (no </head>): ${counts['skipped-no-head'] || 0}`);
  console.log(`Errors: ${counts['error'] || 0}`);
  if (results.length) {
    console.log('\nChanged/Processed files:');
    for (const r of results) {
      if (r.status.startsWith('modified') || r.status.startsWith('skipped') || r.status === 'error') {
        console.log(`- ${r.file}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
      }
    }
  }

  // 変更ファイル一覧（変更のみ）
  const changed = results.filter((r) => r.status === 'modified' || r.status === 'modified-todo-app-name');
  if (changed.length) {
    console.log('\nModified files:');
    changed.forEach((r) => console.log(`- ${r.file}`));
  }
}

main();
