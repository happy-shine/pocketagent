/** A real Node child, quoted for the shell used by JobManager on this platform. */
export function nodeCommand(source: string): string {
  const quote = (value: string) => process.platform === "win32"
    ? `'${value.replace(/'/g, "''")}'`
    : `'${value.replace(/'/g, `'"'"'`)}'`;
  return `${process.platform === "win32" ? "& " : ""}${quote(process.execPath)} -e ${quote(source)}`;
}

export function sleepCommand(seconds: number, after = ""): string {
  return nodeCommand(`setTimeout(() => { ${after} }, ${seconds * 1000})`);
}
