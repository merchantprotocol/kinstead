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
    const classes = [...text.matchAll(/\bclass\s+([\w$]+)(?:\s+extends\s+([\w$.]+))?/g)].map((match, index, all) => {
      const start = match.index, end = all[index + 1]?.index ?? text.length;
      const body = text.slice(start, end), methods = [...body.matchAll(/^    (?:static\s+)?(?:async\s+)?[\w$]+\s*\([^\n]*\)\s*\{/gm)].length;
      return { name: match[1], base: match[2] || null, methods };
    });
    const longLines = lines.filter((line) => line.length > 160).length;
    const prototypes = [...text.matchAll(/\.prototype\.[\w$]+\s*=/g)].length;
    const topFunctions = [...text.matchAll(/^\s*(?:async\s+)?function\s+[\w$]+\s*\(/gm)].length;
    return { absoluteFile: file, file: path.relative(this.root, file), lines: lines.length, classes, longLines, prototypes, topFunctions };
  }
  run() {
    const rows = this.files(path.join(this.root, 'src')).concat(this.files(path.join(this.root, 'server'))).map((file) => this.inspect(file));
    const declarations = new Map();
    for (const row of rows) for (const item of row.classes) declarations.set(item.name, { ...item, file: row.file });
    const allowed = (name) => /^(?:Tool|BrushTool|PaintTool|HeightTool|WallTool|RoomTool|BridgeTool)$/.test(name) || name.startsWith('THREE.');
    const chainIssues = [];
    for (const row of rows.filter((entry) => entry.file.startsWith('src/engine/'))) for (const item of row.classes) {
      if (!item.base) continue;
      const baseName = item.base.split('.').at(-1), base = declarations.get(baseName);
      if (!base) continue;
      const stem = (value) => value.replace(/(?:Core|Storage|Session|Selection|UI|Input|Overlay|Utils|History|Tools?)$/, '');
      if (base.file !== row.file && stem(item.name) === stem(baseName)) chainIssues.push(`${row.file}: ${item.name} extends same-stem ${baseName}`);
      let depth = 1, current = base, seen = new Set([item.name]);
      while (current?.base && !seen.has(current.name)) {
        seen.add(current.name); const parentName = current.base.split('.').at(-1);
        if (allowed(parentName)) break;
        current = declarations.get(parentName); if (current) depth++;
      }
      if (depth > 2 && !allowed(baseName)) chainIssues.push(`${row.file}: ${item.name} inheritance depth ${depth + 1} exceeds 2`);
    }
    console.log('FILE | LINES | CLASSES >25 METHODS | TOP-LEVEL FUNCTIONS | PROTOTYPE ASSIGNMENTS | LINES >160 | INHERITANCE');
    for (const row of rows) {
      const largeClasses = row.classes.filter((item) => item.methods > 25).map((item) => `${item.name}(${item.methods})`).join(', ') || '—';
      if (row.lines > 300 || largeClasses !== '—' || row.topFunctions || row.prototypes || row.longLines) {
        console.log(`${row.file} | ${row.lines} | ${largeClasses} | ${row.topFunctions} | ${row.prototypes} | ${row.longLines} | —`);
      }
    }
    for (const issue of chainIssues) console.log(`INHERITANCE | ${issue}`);
    const issues = chainIssues.length > 0 || rows.some((row) => row.lines > 300 || row.classes.some((item) => item.methods > 25) || row.topFunctions || row.prototypes || row.longLines);
    if (issues && this.strict) process.exitCode = 1;
  }
}
new OopAudit(process.cwd()).run();
