/** Render the built-in HTTP examples for the host shell (PowerShell on Windows). */
export function platformApiExamples(text: string, platform: NodeJS.Platform = process.platform): string {
  if (platform !== "win32") return text;
  return text.replace(/```bash\n([\s\S]*?)```/g, (_block, body: string) => {
    const lines = body.replace(/\\\r?\n\s*/g, " ").split("\n");
    const rendered = lines.map((line) => {
      if (!line.startsWith("curl -s ")) return line;
      const url = line.match(/"(http:[^"]+)"/)?.[1];
      if (!url) return line;
      const method = line.match(/-X (\w+)/)?.[1] ?? "GET";
      const json = line.match(/-d '([\s\S]*)'\s*$/)?.[1];
      const args = [`Invoke-RestMethod -Method ${method} -Uri '${url}'`];
      if (line.includes("X-PocketAgent-Session")) args.push("-Headers @{ 'X-PocketAgent-Session' = $env:POCKETAGENT_SESSION_ID }");
      if (json) args.push(`-ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes('${json.replace(/'/g, "''")}'))`);
      return args.join(" ");
    });
    return "```powershell\n" + rendered.join("\n") + "```";
  }).replaceAll('`$POCKETAGENT_SESSION_ID`', '`$env:POCKETAGENT_SESSION_ID`');
}
