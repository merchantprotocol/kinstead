#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

class OopAudit {
  constructor(root) { this.root = root; this.strict = process.argv.includes('--strict'); }
  files(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return ['node_modules', 'dist', '.git'].includes(entry.name) ? [] : this.files(full);
      return entry.name.endsWith('.js') || entry.name.endsWith('.mjs') ? [full] : [];
    });
  }
  inspect(file) {
    const text = fs.readFileSync(file, 'utf8'), lines = text.split('\n');
    const classes = [...text.matchAll(/\bclass\s+([\w$]+)/g)].map((match, index, all) => {
      const start = match.index, end = all[index + 1]?.index ?? text.length;
      const body = text.slice(start, end), methods = [...body.matchAll(/^    (?:static\s+)?(?:async\s+)?[\w$]+\s*\([^\n]*\)\s*\{/gm)].length;
      return { name: match[1], methods };
    });
    const longLines = lines.filter((line) => line.length > 160).length;
    const prototypes = [...text.matchAll(/\.prototype\.[\w$]+\s*=/g)].length;
    const topFunctions = [...text.matchAll(/^\s*(?:async\s+)?function\s+[\w$]+\s*\(/gm)].length;
    return { file: path.relative(this.root, file), lines: lines.length, classes, longLines, prototypes, topFunctions };
  }
  run() {
    const rows = this.files(path.join(this.root, 'src')).concat(this.files(path.join(this.root, 'server'))).map((file) => this.inspect(file));
    console.log('FILE | LINES | CLASSES >25 METHODS | TOP-LEVEL FUNCTIONS | PROTOTYPE ASSIGNMENTS | LINES >160');
    for (const row of rows) {
      const largeClasses = row.classes.filter((item) => item.methods > 25).map((item) => `${item.name}(${item.methods})`).join(', ') || '—';
      if (row.lines > 300 || largeClasses !== '—' || row.topFunctions || row.prototypes || row.longLines) {
        console.log(`${row.file} | ${row.lines} | ${largeClasses} | ${row.topFunctions} | ${row.prototypes} | ${row.longLines}`);
      }
    }
    const issues = rows.some((row) => row.lines > 300 || row.classes.some((item) => item.methods > 25) || row.topFunctions || row.prototypes || row.longLines);
    if (issues && this.strict) process.exitCode = 1;
  }
}
new OopAudit(process.cwd()).run();
