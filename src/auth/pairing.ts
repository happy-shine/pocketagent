import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import type { PairingRequest } from "./types.js";

const EXPIRY_MS = 3600_000;
const MAX_PENDING = 20;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export class PairingManager {
  private requests: PairingRequest[] = [];
  private storePath?: string;

  constructor(storePath?: string) {
    this.storePath = storePath;
    if (storePath && existsSync(storePath)) {
      try {
        const data = JSON.parse(readFileSync(storePath, "utf-8"));
        this.requests = data.requests ?? [];
      } catch {
        this.requests = [];
      }
    }
  }

  challenge(senderId: string, senderName: string, channelType: string, chatId: string): PairingRequest {
    this.cleanup();
    const existing = this.requests.find((r) => r.senderId === senderId && r.channelType === channelType);
    if (existing) return existing;
    if (this.requests.length >= MAX_PENDING) {
      this.requests.sort((a, b) => a.createdAt - b.createdAt);
      this.requests.shift();
    }
    const req: PairingRequest = {
      senderId,
      senderName,
      channelType,
      chatId,
      code: generateCode(),
      createdAt: Date.now(),
      expiresAt: Date.now() + EXPIRY_MS,
    };
    this.requests.push(req);
    this.persist();
    return req;
  }

  approve(code: string): { senderId: string } | null {
    this.cleanup();
    const idx = this.requests.findIndex((r) => r.code === code.toUpperCase());
    if (idx === -1) return null;
    const req = this.requests[idx];
    this.requests.splice(idx, 1);
    this.persist();
    return { senderId: req.senderId };
  }

  listPending(): PairingRequest[] {
    this.cleanup();
    return [...this.requests];
  }

  cleanup(): void {
    const now = Date.now();
    this.requests = this.requests.filter((r) => r.expiresAt > now);
  }

  private persist(): void {
    if (!this.storePath) return;
    mkdirSync(dirname(this.storePath), { recursive: true });
    const tmp = this.storePath + ".tmp";
    writeFileSync(tmp, JSON.stringify({ version: 1, requests: this.requests }, null, 2));
    renameSync(tmp, this.storePath);
  }
}
