/**
 * Deploy script for tiktok-live-api npm package.
 *
 * Usage:
 *   npx tsx deploy.ts           — publish as latest
 *   npx tsx deploy.ts --dry-run — test without publishing
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = import.meta.dirname || __dirname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const dryRun = process.argv.includes('--dry-run');

console.log(`\n📦  tiktok-live-api v${pkg.version}`);
console.log(`${'='.repeat(40)}\n`);

// 1. Build
console.log('🔨  Building...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });
console.log('✅  Build complete\n');

// 2. Check npm login
try {
  const whoami = execSync('npm whoami', { cwd: root, encoding: 'utf-8' }).trim();
  console.log(`🔑  Logged in as: ${whoami}\n`);
} catch {
  console.log('🔐  Not logged in to npm. Running npm login...\n');
  execSync('npm login', { cwd: root, stdio: 'inherit' });
  console.log('');
}

// 3. Publish
if (dryRun) {
  console.log('🧪  Dry run — skipping publish');
  execSync('npm pack --dry-run', { cwd: root, stdio: 'inherit' });
} else {
  console.log('🚀  Publishing to npm...');
  execSync('npm publish --access public', { cwd: root, stdio: 'inherit' });
  console.log(`\n✅  Published tiktok-live-api@${pkg.version}`);
  console.log(`    https://www.npmjs.com/package/tiktok-live-api\n`);
}
