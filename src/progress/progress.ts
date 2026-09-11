import type { ChannelAdapter } from "../channels/types.js";

const TICK_INTERVAL = 3000;
const FLUSH_MIN = 3000;
const FLUSH_MAX = 15000;
const FLUSH_TAU = 120000;

function getFlushInterval(elapsedMs: number): number {
  return FLUSH_MIN + (FLUSH_MAX - FLUSH_MIN) * (1 - Math.exp(-elapsedMs / FLUSH_TAU));
}

const GLYPH_FRAMES = ["·", "✢", "✶", "✻", "✽", "✽", "✻", "✶", "✢", "·"];

const TOOL_ICONS: Record<string, string> = {
  Read: "↓",
  Write: "↑",
  Edit: "δ",
  Bash: "$",
  Glob: "⊕",
  Grep: "⊕",
  Agent: "◇",
  WebSearch: "⊙",
  WebFetch: "⊙",
};

const SPINNER_VERBS = [
  "Accomplishing", "Architecting", "Baking", "Brewing", "Calculating",
  "Channeling", "Choreographing", "Churning", "Composing", "Computing",
  "Crafting", "Creating", "Deliberating", "Generating", "Ideating",
  "Imagining", "Kneading", "Orchestrating", "Pondering", "Processing",
  "Synthesizing", "Thinking", "Tinkering", "Vibing", "Working",
];

function randomVerb(): string {
  return SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)];
}

export class ProgressTracker {
  private channel: ChannelAdapter;
  private chatId: string;
  private replyToMessageId?: string;

  private messageId: string | null = null;
  private completed: string[] = [];
  private currentLabel = "";
  private currentIcon = "";
  private phaseStart = Date.now();
  private globalStart = Date.now();
  private glyphIdx = 0;
  private verb = randomVerb();
  private lastFlush = 0;
  private flushing = false;
  private flushTimer?: ReturnType<typeof setInterval>;
  private done = false;
  private pendingFlush: Promise<void> = Promise.resolve();

  constructor(channel: ChannelAdapter, chatId: string, replyToMessageId?: string) {
    this.channel = channel;
    this.chatId = chatId;
    this.replyToMessageId = replyToMessageId;
  }

  start(): void {
    this.flushTimer = setInterval(() => {
      this.pendingFlush = this.flush().catch(() => {});
    }, TICK_INTERVAL);
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  thinking(): void {
    if (this.currentLabel && !this.currentLabel.startsWith("Thinking")) {
      const dur = ((Date.now() - this.phaseStart) / 1000).toFixed(1);
      this.completed.push(`${this.currentIcon} ${this.currentLabel} (${dur}s)`);
    }
    this.currentLabel = `${this.verb}…`;
    this.currentIcon = "✶";
    this.phaseStart = Date.now();
  }

  toolStart(name: string, detail?: string): void {
    if (this.currentLabel) {
      const dur = ((Date.now() - this.phaseStart) / 1000).toFixed(1);
      this.completed.push(`${this.currentIcon} ${this.currentLabel} (${dur}s)`);
    }
    this.currentIcon = TOOL_ICONS[name] ?? "⚙";
    this.currentLabel = detail ? `${name}: ${detail}` : name;
    this.phaseStart = Date.now();
  }

  async finish(finalText: string, buttons?: string[]): Promise<void> {
    this.done = true;
    this.stop();
    await this.pendingFlush;

    if (this.messageId) {
      try {
        await this.channel.editMessage(this.chatId, this.messageId, finalText, buttons);
        return;
      } catch {
        // Fall back to sending new message if edit fails
      }
    }
    await this.channel.send({
      chatId: this.chatId,
      text: finalText,
      replyToMessageId: this.replyToMessageId,
    });
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.done) return;
    const now = Date.now();
    const interval = getFlushInterval(now - this.globalStart);
    if (now - this.lastFlush < interval) return;

    this.flushing = true;
    try {
      const text = this.render();
      if (!this.messageId) {
        this.messageId = await this.channel.send({
          chatId: this.chatId,
          text,
          replyToMessageId: this.replyToMessageId,
        });
      } else {
        await this.channel.editMessage(this.chatId, this.messageId, text);
      }
      this.lastFlush = Date.now();
    } catch {
      // Ignore transient edit errors
    } finally {
      this.flushing = false;
    }
  }

  private render(): string {
    const glyph = GLYPH_FRAMES[this.glyphIdx % GLYPH_FRAMES.length];
    this.glyphIdx++;

    const lines: string[] = [];
    const recent = this.completed.slice(-3);
    for (const c of recent) {
      lines.push(`✓ ${c}`);
    }

    if (this.currentLabel) {
      lines.push(`${glyph} ${this.currentIcon} ${this.currentLabel}`);
    } else {
      lines.push(`${glyph} Thinking…`);
    }

    return lines.join("\n");
  }
}
