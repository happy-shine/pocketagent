import { createHash, randomUUID } from "node:crypto";
import { createConnection, createServer, type Server } from "node:net";
import { resolve } from "node:path";

function controlPipe(dataDir: string, pid: number): string {
  const key = createHash("sha256").update(resolve(dataDir).toLowerCase()).digest("hex").slice(0, 20);
  return `\\\\.\\pipe\\pocketagent-${key}-${pid}`;
}

/** Windows has no catchable remote SIGTERM. A local pipe lets pa stop drain the gateway. */
export async function startWindowsControl(dataDir: string, token: string, onStop: () => void): Promise<Server> {
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    socket.setTimeout(1000, () => socket.destroy());
    socket.on("error", () => {});
    let input = "";
    socket.on("data", (chunk) => {
      input += chunk;
      if (input.length > 256) { socket.destroy(); return; }
      if (!input.includes("\n")) return;
      if (input.trim() !== token) { socket.end("denied\n"); return; }
      socket.removeAllListeners("data");
      socket.end("stopping\n", onStop);
    });
  });
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(controlPipe(dataDir, process.pid), done);
  });
  server.unref();
  return server;
}

export async function requestWindowsStop(dataDir: string, pid: number, token: string): Promise<boolean> {
  return new Promise((done) => {
    const socket = createConnection(controlPipe(dataDir, pid));
    let reply = "";
    const finish = (ok: boolean) => { socket.destroy(); done(ok); };
    socket.setEncoding("utf8");
    socket.setTimeout(1000, () => finish(false));
    socket.once("error", () => finish(false));
    socket.once("connect", () => socket.write(`${token}\n`));
    socket.on("data", (chunk) => { reply += chunk; if (reply.includes("\n")) finish(reply.trim() === "stopping"); });
    socket.once("end", () => finish(false));
  });
}

/** WMI does not inherit a terminal's transient environment. Transfer it over a one-use
 * local pipe, never through command-line arguments or a file containing credentials. */
export async function windowsEnvironmentHandoff(): Promise<{ pipe: string; close: () => void }> {
  const pipe = `\\\\.\\pipe\\pocketagent-env-${randomUUID()}`;
  const server = createServer((socket) => {
    server.close();
    socket.on("error", () => {});
    socket.end(JSON.stringify(process.env));
  });
  await new Promise<void>((done, reject) => { server.once("error", reject); server.listen(pipe, done); });
  server.unref();
  return { pipe, close: () => { if (server.listening) server.close(); } };
}

export const WINDOWS_ENV_BOOTSTRAP = String.raw`
const net = require('node:net');
const { spawn } = require('node:child_process');
const socket = net.createConnection(process.argv[1]);
socket.setEncoding('utf8');
socket.setTimeout(10000, () => process.exit(1));
socket.on('error', () => process.exit(1));
let input = '';
socket.on('data', chunk => { input += chunk; });
socket.on('end', () => {
  const child = spawn(process.execPath, process.argv.slice(2), {
    env: JSON.parse(input), detached: true, windowsHide: true, stdio: 'ignore',
  });
  child.on('error', () => process.exit(1));
  child.unref();
});
`;
