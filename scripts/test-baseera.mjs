import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'baseera-test-'));
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'tests/baseera.test.ts', '--outDir', directory, '--target', 'es2022', '--module', 'commonjs', '--moduleResolution', 'node', '--esModuleInterop', '--skipLibCheck', '--strict', '--types', 'node'], { stdio: 'inherit' });
  writeFileSync(join(directory, 'package.json'), '{"type":"commonjs"}');
  execFileSync(process.execPath, ['--test', join(directory, 'tests/baseera.test.js')], { stdio: 'inherit', env: { ...process.env, NODE_PATH: resolve('node_modules') } });
} finally { rmSync(directory, { recursive: true, force: true }); }
