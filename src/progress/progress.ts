import type { ChannelAdapter } from "../channels/types.js";
import { markdownToTelegramHtml, stripHtml } from "../channels/telegram/formatter.js";
import { appendText } from "../engines/text-blocks.js";

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

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
  private buffer = "";
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
    let shortDetail = "";
    if (detail) {
      try {
        const parsed = JSON.parse(detail);
        if (parsed.CommandLine) shortDetail = parsed.CommandLine;
        else if (parsed.path) shortDetail = parsed.path;
        else if (parsed.query) shortDetail = parsed.query;
        else shortDetail = detail;
      } catch {
        shortDetail = detail;
      }
      shortDetail = shortDetail.replace(/\s+/g, " ").trim();
      if (shortDetail.length > 60) shortDetail = shortDetail.slice(0, 60) + "…";
    }
    this.currentLabel = shortDetail ? `${name}: ${shortDetail}` : name;
    this.phaseStart = Date.now();
  }

  appendText(text: string, newBlock = false): void {
    this.buffer = appendText(this.buffer, text, newBlock);
  }

  getBuffer(): string {
    return this.buffer;
  }

  getMessageId(): string | null {
    return this.messageId;
  }

  /** Ends without posting an answer: stops the updates and removes the progress message. */
  async discard(): Promise<void> {
    this.done = true;
    this.stop();
    await this.pendingFlush;
    if (this.messageId) {
      const progressId = this.messageId;
      this.messageId = null;
      await this.channel.deleteMessage?.(this.chatId, progressId).catch(() => {});
    }
  }

  /**
   * Posts the final answer, replacing the progress message. With `mention`, the answer starts by mentioning
   * that user and is sent as a new message, because mentions added by an edit do not notify anyone.
   */
  async finish(finalText: string, buttons?: string[], opts: { mention?: { id: string; name: string } } = {}): Promise<void> {
    this.done = true;
    this.stop();
    await this.pendingFlush;

    const isTelegram = this.channel.type === "telegram";
    const { mention } = opts;
    let textToSend = finalText;
    let parseMode: "HTML" | undefined;
    let plainFallback: string | undefined;

    if (isTelegram) {
      textToSend = markdownToTelegramHtml(finalText);
      if (mention) textToSend = `<a href="tg://user?id=${escapeHtml(mention.id)}">${escapeHtml(mention.name)}</a>\n${textToSend}`;
      parseMode = "HTML";
      plainFallback = stripHtml(textToSend);
    } else if (mention) {
      textToSend = `<@${mention.id}>\n${finalText}`;
    }

    if (mention && this.messageId) {
      const progressId = this.messageId;
      this.messageId = null;
      await this.channel.deleteMessage?.(this.chatId, progressId).catch(() => {});
    }

    if (this.messageId) {
      try {
        await this.channel.editMessage(
          this.chatId,
          this.messageId,
          textToSend,
          buttons,
          parseMode,
          plainFallback,
        );
        return;
      } catch {
        // Fall back to sending new message if edit fails
      }
    }
    await this.channel.send({
      chatId: this.chatId,
      text: textToSend,
      replyToMessageId: this.replyToMessageId,
      parseMode,
      plainFallback,
    });
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.done) return;
    const now = Date.now();
    const interval = getFlushInterval(now - this.globalStart);
    if (now - this.lastFlush < interval) return;

    this.flushing = true;
    try {
      const text = this.render().slice(0, 1000);
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
