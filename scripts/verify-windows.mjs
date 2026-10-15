import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") throw new Error("This smoke check requires Windows.");
const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "pa-windows-smoke space-"));
const config = join(dir, "config.yaml");
const lock = join(dir, "gateway.lock");
const cli = async (action) => run(process.execPath, [join(root, "dist", "index.js"), action], { windowsHide: true, timeout: 45000, env: { ...process.env, POCKETAGENT_HOME: dir, PA_SMOKE_DATA: dir } });
const reserve = createServer();
await new Promise((done) => reserve.listen(0, "127.0.0.1", done));
const port = reserve.address().port;
await new Promise((done) => reserve.close(done));
writeFileSync(config, `gateway:\n  port: ${port}\n  dataDir: '\${PA_SMOKE_DATA}'\n  logFormat: json\nbots: []\n`);
try {
  await cli("start");
  const first = JSON.parse(readFileSync(lock, "utf8")).pid;
  assert.ok(first > 0);
  assert.match((await cli("status")).stdout, /active in background/);
  assert.equal((await (await fetch(`http://127.0.0.1:${port}/api/status`)).json()).gateway.pid, first);
  await cli("restart");
  const second = JSON.parse(readFileSync(lock, "utf8")).pid;
  assert.notEqual(second, first);
  await cli("stop");
  assert.equal(existsSync(lock), false);
  assert.match(readFileSync(join(dir, "logs", "gateway.log"), "utf8"), /PocketAgent Gateway stopped cleanly/);
  console.log("Windows daemon smoke passed: independent WMI start, HTTP readiness, status, graceful restart and stop.");
} finally {
  if (existsSync(lock)) await cli("stop");
  assert.equal(dirname(resolve(dir)).toLowerCase(), resolve(tmpdir()).toLowerCase());
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
