/** Keep remote attachment names valid on Windows and inside their download directory. */
export function safeFileName(name: string): string {
  const safe = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/g, "");
  const leaf = safe && safe !== "." && safe !== ".." ? safe : "attachment";
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(leaf) ? `_${leaf}` : leaf;
}
