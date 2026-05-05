export function buildUpgradeCommand(): string {
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (root && root.length > 0) {
    // Cache path: /...cache/<marketplace>/<plugin>/<version>
    const segs = root.replace(/\/+$/, "").split("/");
    const plugin = segs.at(-2);
    const marketplace = segs.at(-3);
    if (plugin && marketplace) {
      return `claude plugin update ${plugin}@${marketplace}`;
    }
    // Fallback if path structure is unexpected
    return `claude plugin update dora@dora`;
  }
  return "npm install -g dora@latest && dora doctor";
}
