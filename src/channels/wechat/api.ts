import crypto from "node:crypto";
import { encryptAesEcb } from "./crypto.js";
import type {
  BaseInfo,
  GetUpdatesReq,
  GetUpdatesResp,
  SendMessageReq,
  SendMessageResp,
  SendTypingReq,
  GetUploadUrlReq,
  GetUploadUrlResp,
  WechatQrStatus,
} from "./types.js";

export const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
export const DEFAULT_CDN_BASE_URL = "https://ilinkai.weixin.qq.com";
const DEFAULT_TIMEOUT_MS = 20_000;
const CHANNEL_VERSION = "2.4.10";
const CLIENT_VERSION = 132106; // 0x0002040A

export function buildBaseInfo(): BaseInfo {
  return {
    channel_version: CHANNEL_VERSION,
    bot_agent: "PocketAgent",
  };
}

function randomWechatUin(): string {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf-8").toString("base64");
}

export function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "AuthorizationType": "ilink_bot_token",
    "X-WECHAT-UIN": randomWechatUin(),
    "iLink-App-Id": "bot",
    "iLink-App-ClientVersion": String(CLIENT_VERSION),
  };
  if (token && token.trim()) {
    headers["Authorization"] = `Bearer ${token.trim()}`;
  }
  return headers;
}

const LOSSLESS_ID_FIELDS = new Set(["message_id", "msg_id", "svr_id"]);

export function parseWeixinApiJson<T>(rawText: string): T {
  let output = "";
  let index = 0;
  while (index < rawText.length) {
    if (rawText[index] !== '"') {
      output += rawText[index++];
      continue;
    }

    const stringStart = index;
    index++;
    let escaped = false;
    while (index < rawText.length) {
      const char = rawText[index++];
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        break;
      }
    }
    const stringToken = rawText.slice(stringStart, index);
    output += stringToken;

    let cursor = index;
    while (/\s/.test(rawText[cursor] ?? "")) cursor++;
    if (rawText[cursor] !== ":") continue;

    let key: unknown;
    try {
      key = JSON.parse(stringToken);
    } catch {
      continue;
    }
    if (typeof key !== "string" || !LOSSLESS_ID_FIELDS.has(key)) continue;

    output += rawText.slice(index, cursor + 1);
    cursor++;
    while (/\s/.test(rawText[cursor] ?? "")) {
      output += rawText[cursor++];
    }
    const numberStart = cursor;
    if (rawText[cursor] === "-") cursor++;
    while (/\d/.test(rawText[cursor] ?? "")) cursor++;
    if (cursor > numberStart && !(cursor === numberStart + 1 && rawText[numberStart] === "-")) {
      output += `"${rawText.slice(numberStart, cursor)}"`;
      index = cursor;
    } else {
      index = numberStart;
    }
  }
  return JSON.parse(output) as T;
}

async function apiFetch(
  url: string,
  method: "GET" | "POST",
  headers: Record<string, string>,
  body?: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const fetchOpts: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (body !== undefined) {
    fetchOpts.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const res = await fetch(url, fetchOpts);
  return res.text();
}

export async function fetchBotQrCode(
  baseUrl: string,
  botType: string = "3",
  localTokenList: string[] = [],
): Promise<{ qrcode: string; qrcode_img_content: string }> {
  const url = `${baseUrl}/ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(botType)}`;
  const headers = buildHeaders();
  const text = await apiFetch(url, "POST", headers, { local_token_list: localTokenList, base_info: buildBaseInfo() });
  const resp = JSON.parse(text);
  if (resp.ret !== 0 || !resp.qrcode) {
    throw new Error(`fetchBotQrCode failed: ${text}`);
  }
  return { qrcode: resp.qrcode, qrcode_img_content: resp.qrcode_img_content };
}

export async function fetchQrCodeStatus(
  baseUrl: string,
  qrcode: string,
  timeoutMs: number = 35_000,
): Promise<WechatQrStatus> {
  const url = `${baseUrl}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`;
  const headers = buildHeaders();
  const text = await apiFetch(url, "GET", headers, undefined, timeoutMs);
  return JSON.parse(text) as WechatQrStatus;
}

export async function notifyStart(baseUrl: string, token: string): Promise<void> {
  const url = `${baseUrl}/ilink/bot/msg/notifystart`;
  const headers = buildHeaders(token);
  await apiFetch(url, "POST", headers, { base_info: buildBaseInfo() });
}

export async function notifyStop(baseUrl: string, token: string): Promise<void> {
  const url = `${baseUrl}/ilink/bot/msg/notifystop`;
  const headers = buildHeaders(token);
  await apiFetch(url, "POST", headers, { base_info: buildBaseInfo() });
}

export async function getUpdates(
  baseUrl: string,
  token: string,
  getUpdatesBuf: string,
  timeoutMs: number = 35_000,
): Promise<GetUpdatesResp> {
  const url = `${baseUrl}/ilink/bot/getupdates`;
  const headers = buildHeaders(token);
  const req: GetUpdatesReq = {
    get_updates_buf: getUpdatesBuf || "",
    base_info: buildBaseInfo(),
  };
  const text = await apiFetch(url, "POST", headers, req, timeoutMs + 5000);
  return parseWeixinApiJson<GetUpdatesResp>(text);
}

export async function sendMessage(
  baseUrl: string,
  token: string,
  req: SendMessageReq,
): Promise<SendMessageResp> {
  const url = `${baseUrl}/ilink/bot/sendmessage`;
  const headers = buildHeaders(token);
  const body = { ...req, base_info: buildBaseInfo() };
  const text = await apiFetch(url, "POST", headers, body);
  const resp = parseWeixinApiJson<SendMessageResp>(text);
  if (resp.ret !== 0) {
    throw new Error(`sendMessage ret=${resp.ret} errcode=${resp.errcode} errmsg=${resp.errmsg}`);
  }
  return resp;
}

export async function sendTyping(
  baseUrl: string,
  token: string,
  req: SendTypingReq,
): Promise<void> {
  const url = `${baseUrl}/ilink/bot/sendtyping`;
  const headers = buildHeaders(token);
  const body = { ...req, base_info: buildBaseInfo() };
  await apiFetch(url, "POST", headers, body, 10_000);
}

export async function getUploadUrl(
  baseUrl: string,
  token: string,
  req: GetUploadUrlReq,
): Promise<GetUploadUrlResp> {
  const url = `${baseUrl}/ilink/bot/getuploadurl`;
  const headers = buildHeaders(token);
  const body = { ...req, base_info: buildBaseInfo() };
  const text = await apiFetch(url, "POST", headers, body);
  return JSON.parse(text) as GetUploadUrlResp;
}

export async function uploadBufferToCdn(params: {
  buf: Buffer;
  uploadFullUrl?: string;
  uploadParam?: string;
  filekey: string;
  cdnBaseUrl: string;
  aeskey: Buffer;
}): Promise<{ downloadParam: string }> {
  const { buf, uploadFullUrl, uploadParam, filekey, cdnBaseUrl, aeskey } = params;
  const ciphertext = encryptAesEcb(buf, aeskey);
  let cdnUrl = uploadFullUrl?.trim();
  if (!cdnUrl && uploadParam) {
    cdnUrl = `${cdnBaseUrl}/upload?param=${encodeURIComponent(uploadParam)}&filekey=${encodeURIComponent(filekey)}`;
  }
  if (!cdnUrl) {
    throw new Error("uploadBufferToCdn: missing upload target url");
  }

  const res = await fetch(cdnUrl, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: new Uint8Array(ciphertext),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`CDN upload failed ${res.status}: ${errText}`);
  }

  const downloadParam = res.headers.get("x-encrypted-param");
  if (!downloadParam) {
    throw new Error("CDN response missing x-encrypted-param header");
  }

  return { downloadParam };
}
