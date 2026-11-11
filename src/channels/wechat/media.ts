import fs from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Logger } from "pino";
import { decryptAesEcb, parseAesKey, aesEcbPaddedSize } from "./crypto.js";
import { getUploadUrl, uploadBufferToCdn, sendMessage } from "./api.js";
import { MessageItemType, UploadMediaType, type MessageItem, type SendMessageReq } from "./types.js";

const SILK_SAMPLE_RATE = 24_000;

/**
 * Wrap raw pcm_s16le bytes in a standard 44-byte WAV header.
 * Mono channel, 16-bit signed little-endian.
 */
function pcmBytesToWav(pcm: Uint8Array, sampleRate: number): Buffer {
  const pcmBytes = pcm.byteLength;
  const totalSize = 44 + pcmBytes;
  const buf = Buffer.allocUnsafe(totalSize);
  let offset = 0;

  buf.write("RIFF", offset);
  offset += 4;
  buf.writeUInt32LE(totalSize - 8, offset);
  offset += 4;
  buf.write("WAVE", offset);
  offset += 4;

  buf.write("fmt ", offset);
  offset += 4;
  buf.writeUInt32LE(16, offset);
  offset += 4;
  buf.writeUInt16LE(1, offset);
  offset += 2; // PCM format
  buf.writeUInt16LE(1, offset);
  offset += 2; // mono
  buf.writeUInt32LE(sampleRate, offset);
  offset += 4;
  buf.writeUInt32LE(sampleRate * 2, offset);
  offset += 4; // byte rate (mono 16-bit)
  buf.writeUInt16LE(2, offset);
  offset += 2; // block align
  buf.writeUInt16LE(16, offset);
  offset += 2; // bits per sample

  buf.write("data", offset);
  offset += 4;
  buf.writeUInt32LE(pcmBytes, offset);
  offset += 4;

  Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).copy(buf, offset);
  return buf;
}

/**
 * Transcodes SILK audio buffer to standard WAV using silk-wasm.
 */
export async function silkToWav(silkBuf: Buffer, log?: Logger): Promise<Buffer | null> {
  try {
    const { decode } = await import("silk-wasm");
    const result = await decode(silkBuf, SILK_SAMPLE_RATE);
    const wav = pcmBytesToWav(result.data, SILK_SAMPLE_RATE);
    log?.debug({ durationMs: result.duration, wavBytes: wav.length }, "Transcoded SILK to WAV");
    return wav;
  } catch (err) {
    log?.warn({ error: err }, "Failed to transcode SILK to WAV; returning raw SILK");
    return null;
  }
}

/**
 * Download raw bytes from CDN and decrypt if key is present.
 */
async function fetchAndDecrypt(
  url: string,
  aesKeyBase64?: string,
  label: string = "media",
): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CDN download failed ${res.status}: ${res.statusText}`);
  }
  const rawBuf = Buffer.from(await res.arrayBuffer());
  if (aesKeyBase64) {
    const key = parseAesKey(aesKeyBase64, label);
    return decryptAesEcb(rawBuf, key);
  }
  return rawBuf;
}

export interface DecryptedMediaResult {
  localPath: string;
  type: "photo" | "voice" | "video" | "document";
  fileName?: string;
  mimeType?: string;
}

/**
 * Download and decrypt an inbound WeChat media item.
 */
export async function downloadInboundMedia(
  item: MessageItem,
  destDir: string,
  cdnBaseUrl: string,
  log?: Logger,
): Promise<DecryptedMediaResult | null> {
  mkdirSync(destDir, { recursive: true });
  const ts = Date.now();
  const rand = crypto.randomBytes(4).toString("hex");

  if (item.type === MessageItemType.IMAGE && item.image_item) {
    const img = item.image_item;
    const fullUrl = img.media?.full_url || (img.media?.encrypt_query_param ? `${cdnBaseUrl}/download?param=${encodeURIComponent(img.media.encrypt_query_param)}` : "");
    if (!fullUrl) return null;
    const aesKey = img.aeskey ? Buffer.from(img.aeskey, "hex").toString("base64") : img.media?.aes_key;
    try {
      const buf = await fetchAndDecrypt(fullUrl, aesKey, "image");
      const fileName = `image_${ts}_${rand}.jpg`;
      const localPath = path.join(destDir, fileName);
      await fs.writeFile(localPath, buf);
      return { localPath, type: "photo", fileName, mimeType: "image/jpeg" };
    } catch (err) {
      log?.error({ error: err }, "Failed to download image");
      return null;
    }
  }

  if (item.type === MessageItemType.VOICE && item.voice_item) {
    const voice = item.voice_item;
    const fullUrl = voice.media?.full_url || (voice.media?.encrypt_query_param ? `${cdnBaseUrl}/download?param=${encodeURIComponent(voice.media.encrypt_query_param)}` : "");
    if (!fullUrl || !voice.media?.aes_key) return null;
    try {
      const silkBuf = await fetchAndDecrypt(fullUrl, voice.media.aes_key, "voice");
      const wavBuf = await silkToWav(silkBuf, log);
      if (wavBuf) {
        const fileName = `voice_${ts}_${rand}.wav`;
        const localPath = path.join(destDir, fileName);
        await fs.writeFile(localPath, wavBuf);
        return { localPath, type: "voice", fileName, mimeType: "audio/wav" };
      } else {
        const fileName = `voice_${ts}_${rand}.silk`;
        const localPath = path.join(destDir, fileName);
        await fs.writeFile(localPath, silkBuf);
        return { localPath, type: "voice", fileName, mimeType: "audio/silk" };
      }
    } catch (err) {
      log?.error({ error: err }, "Failed to download voice");
      return null;
    }
  }

  if (item.type === MessageItemType.VIDEO && item.video_item) {
    const video = item.video_item;
    const fullUrl = video.media?.full_url || (video.media?.encrypt_query_param ? `${cdnBaseUrl}/download?param=${encodeURIComponent(video.media.encrypt_query_param)}` : "");
    if (!fullUrl || !video.media?.aes_key) return null;
    try {
      const buf = await fetchAndDecrypt(fullUrl, video.media.aes_key, "video");
      const fileName = `video_${ts}_${rand}.mp4`;
      const localPath = path.join(destDir, fileName);
      await fs.writeFile(localPath, buf);
      return { localPath, type: "video", fileName, mimeType: "video/mp4" };
    } catch (err) {
      log?.error({ error: err }, "Failed to download video");
      return null;
    }
  }

  if (item.type === MessageItemType.FILE && item.file_item) {
    const file = item.file_item;
    const fullUrl = file.media?.full_url || (file.media?.encrypt_query_param ? `${cdnBaseUrl}/download?param=${encodeURIComponent(file.media.encrypt_query_param)}` : "");
    if (!fullUrl || !file.media?.aes_key) return null;
    try {
      const buf = await fetchAndDecrypt(fullUrl, file.media.aes_key, "file");
      const rawName = file.file_name || `file_${ts}_${rand}.bin`;
      const fileName = `${path.parse(rawName).name}_${ts}_${rand}${path.parse(rawName).ext}`;
      const localPath = path.join(destDir, fileName);
      await fs.writeFile(localPath, buf);
      return { localPath, type: "document", fileName: rawName };
    } catch (err) {
      log?.error({ error: err }, "Failed to download file");
      return null;
    }
  }

  return null;
}

/**
 * Upload a local file to CDN and send to WeChat recipient.
 */
export async function uploadAndSendWechatMedia(params: {
  filePath: string;
  toUserId: string;
  baseUrl: string;
  token: string;
  cdnBaseUrl: string;
  contextToken?: string;
  caption?: string;
  log?: Logger;
}): Promise<string> {
  const { filePath, toUserId, baseUrl, token, cdnBaseUrl, contextToken, caption, log } = params;
  if (!existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }

  const plaintext = await fs.readFile(filePath);
  const rawsize = plaintext.length;
  const rawfilemd5 = crypto.createHash("md5").update(plaintext).digest("hex");
  const filesize = aesEcbPaddedSize(rawsize);
  const filekey = crypto.randomBytes(16).toString("hex");
  const aeskey = crypto.randomBytes(16);

  const ext = path.extname(filePath).toLowerCase();
  const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext);
  const isVideo = [".mp4", ".mov", ".mkv", ".webm"].includes(ext);
  const mediaType = isImage ? UploadMediaType.IMAGE : (isVideo ? UploadMediaType.VIDEO : UploadMediaType.FILE);

  log?.info({ filePath, mediaType, rawsize }, "Requesting upload URL for WeChat media");
  const uploadUrlResp = await getUploadUrl(baseUrl, token, {
    filekey,
    media_type: mediaType,
    to_user_id: toUserId,
    rawsize,
    rawfilemd5,
    filesize,
    no_need_thumb: true,
    aeskey: aeskey.toString("hex"),
  });

  const uploadFullUrl = uploadUrlResp.upload_full_url;
  const uploadParam = uploadUrlResp.upload_param;
  if (!uploadFullUrl && !uploadParam) {
    throw new Error(`Failed to get upload URL: ${JSON.stringify(uploadUrlResp)}`);
  }

  log?.info({ filekey }, "Uploading encrypted media buffer to CDN");
  const { downloadParam } = await uploadBufferToCdn({
    buf: plaintext,
    uploadFullUrl,
    uploadParam,
    filekey,
    cdnBaseUrl,
    aeskey,
  });

  const clientId = `wechat-out-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const item: MessageItem = {};

  if (isImage) {
    item.type = MessageItemType.IMAGE;
    item.image_item = {
      media: {
        encrypt_query_param: downloadParam,
        aes_key: aeskey.toString("base64"),
      },
      hd_size: filesize,
      mid_size: filesize,
    };
  } else if (isVideo) {
    item.type = MessageItemType.VIDEO;
    item.video_item = {
      media: {
        encrypt_query_param: downloadParam,
        aes_key: aeskey.toString("base64"),
      },
      video_size: filesize,
    };
  } else {
    item.type = MessageItemType.FILE;
    item.file_item = {
      media: {
        encrypt_query_param: downloadParam,
        aes_key: aeskey.toString("base64"),
      },
      file_name: path.basename(filePath),
      len: String(rawsize),
      md5: rawfilemd5,
    };
  }

  const items: MessageItem[] = [item];
  if (caption && caption.trim()) {
    items.push({
      type: MessageItemType.TEXT,
      text_item: { text: caption.trim() },
    });
  }

  const sendReq: SendMessageReq = {
    msg: {
      to_user_id: toUserId,
      client_id: clientId,
      message_type: 2, // BOT
      message_state: 2, // FINISH
      item_list: items,
      context_token: contextToken,
    },
  };

  const resp = await sendMessage(baseUrl, token, sendReq);
  return resp.msg_id ?? resp.message_id ?? clientId;
}
