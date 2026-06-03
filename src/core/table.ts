// Render a GitHub-flavored markdown table with each cell padded to the widest
// value in its column. The dora skills instruct the agent to print this output
// verbatim, so padding makes the columns line up both as raw monospace terminal
// text and as rendered markdown.
export function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const fmt = (cells: string[]) =>
    "| " + widths.map((w, i) => (cells[i] ?? "").padEnd(w)).join(" | ") + " |";
  const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
  return [fmt(headers), sep, ...rows.map(fmt)].join("\n");
}
