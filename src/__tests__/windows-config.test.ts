import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadConfig, parseConfig, resolveDataDir } from '../config/loader.js';

let testDirectory: string | undefined;
afterEach(() => {
  vi.unstubAllEnvs();
  if (testDirectory) rmSync(testDirectory, { recursive: true, force: true });
  testDirectory = undefined;
});

describe('Windows deployment configuration', () => {
  it('preserves Windows paths in environment values without treating backslashes as YAML escapes', () => {
    vi.stubEnv('PA_TEST_DATA', 'D:\\中文 dir\\pocketagent');
    vi.stubEnv('PA_TEST_PORT', '19991');
    vi.stubEnv('PA_TEST_TOKEN', '123:quote" # literal\\value');
    const config = parseConfig('gateway:\n  port: ${PA_TEST_PORT}\n  dataDir: "${PA_TEST_DATA}"\nbots:\n  - name: test\n    token: "${PA_TEST_TOKEN}"');
    expect(config.gateway.port).toBe(19991);
    expect(config.gateway.dataDir).toBe('D:\\中文 dir\\pocketagent');
    expect(config.bots![0].token).toBe('123:quote" # literal\\value');
  });
  it('expands the data path even when Windows has no HOME variable', () => {
    vi.stubEnv('HOME', undefined);
    const config = parseConfig('gateway:\n  dataDir: ~/.pocketagent\nbots: []');
    expect(resolveDataDir(config)).toBe(resolve(homedir(), '.pocketagent'));
  });

  it('finds the configuration in a dedicated PocketAgent directory', () => {
    testDirectory = mkdtempSync(join(tmpdir(), 'pocketagent-config-'));
    vi.stubEnv('HOME', undefined);
    vi.stubEnv('POCKETAGENT_HOME', testDirectory);
    writeFileSync(join(testDirectory, 'config.yaml'), 'defaultEngine: codex\nbots: []');
    expect(loadConfig().defaultEngine).toBe('codex');
    expect(existsSync(join(testDirectory, 'config.yaml'))).toBe(true);
  });

  it('retains the local network proxy in validated configuration', () => {
    const config = parseConfig('gateway:\n  proxy: http://127.0.0.1:7897\nbots: []');
    expect(config.gateway.proxy).toBe('http://127.0.0.1:7897');
  });
});
