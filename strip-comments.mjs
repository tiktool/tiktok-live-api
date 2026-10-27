#!/usr/bin/env node
// Post-build step for the published SDK packages: removes comments from emitted
// JS and declaration files and deletes source maps, so only the public API
// surface ships. Usage: node strip-comments.mjs <distDir> [<distDir> ...]
// typescript is resolved from the calling package (cwd), not from this folder.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const ts = require('typescript');

const JS_EXT = /\.(c|m)?js$/;
const DTS_EXT = /\.d\.(c|m)?ts$/;
const MAP_EXT = /\.map$/;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function stripJs(code, fileName) {
  const out = ts.transpileModule(code, {
    fileName: fileName.replace(JS_EXT, '.js'),
    compilerOptions: {
      removeComments: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.Preserve,
      allowJs: true,
      sourceMap: false,
      newLine: ts.NewLineKind.LineFeed,
    },
    reportDiagnostics: false,
  });
  return out.outputText.replace(/\n\/\/# sourceMappingURL=.*$/m, '');
}

function stripDts(code, fileName) {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.ESNext, false, ts.ScriptKind.TS);
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  return printer.printFile(source);
}

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error('usage: strip-comments.mjs <distDir> [...]');
  process.exit(1);
}

let maps = 0;
let files = 0;
for (const dir of dirs) {
  for (const file of walk(path.resolve(dir))) {
    if (MAP_EXT.test(file)) {
      fs.unlinkSync(file);
      maps++;
      continue;
    }
    const isDts = DTS_EXT.test(file);
    if (!isDts && !JS_EXT.test(file)) continue;
    const code = fs.readFileSync(file, 'utf8');
    const shebang = code.startsWith('#!') ? code.slice(0, code.indexOf('\n') + 1) : '';
    const body = shebang ? code.slice(shebang.length) : code;
    const stripped = isDts ? stripDts(body, file) : stripJs(body, file);
    fs.writeFileSync(file, shebang + stripped);
    files++;
  }
}
console.log(`strip-comments: ${files} files cleaned, ${maps} source maps removed`);
