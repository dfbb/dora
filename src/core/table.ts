// Render an aligned text table wrapped in a fenced code block. Each cell is
// padded to the widest value in its column. The dora skills instruct the agent
// to print this output verbatim; the code fence forces the terminal to show it
// as monospace preformatted text, so the padding actually lines the columns up.
// (Without the fence, a markdown renderer recomputes column widths from cell
// content and discards our padding, which misaligns the separator row.)
export function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const fmt = (cells: string[]) =>
    "| " + widths.map((w, i) => (cells[i] ?? "").padEnd(w)).join(" | ") + " |";
  const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
  const table = [fmt(headers), sep, ...rows.map(fmt)].join("\n");
  return "```\n" + table + "\n```";
}

