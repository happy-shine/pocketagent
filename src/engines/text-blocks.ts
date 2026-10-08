import type { EngineEvent } from "./types.js";

/**
 * Marks where a turn's text blocks start, so the bot can join separate blocks with a blank line while keeping
 * the streamed pieces of one block together. One instance per turn.
 */
export class TextBlocks {
  // Text was emitted earlier in the turn
  private seen = false;
  // The last thing emitted was text, so a streamed piece continues that block
  private open = false;

  /** A text event; `startsBlock` says the CLI reported this text as the start of a new block. */
  text(text: string, startsBlock = false): EngineEvent {
    const newBlock = this.seen && (startsBlock || !this.open);
    this.seen = true;
    this.open = true;
    return newBlock ? { type: "text", text, newBlock: true } : { type: "text", text };
  }

  /** Something other than text happened (a tool call, reasoning): the next text starts a new block. */
  close(): void {
    this.open = false;
  }
}

/** Appends a text event to a turn's text: pieces of one block as they are, a new block after a blank line. */
export function appendText(acc: string, text: string, newBlock = false): string {
  if (!newBlock || !acc.trim()) return acc + text;
  return `${acc.replace(/\s+$/, "")}\n\n${text.replace(/^\n+/, "")}`;
}
