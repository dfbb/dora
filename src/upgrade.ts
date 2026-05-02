export function buildUpgradeCommand(): string {
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (root && root.length > 0) {
    return `cd ${root} && git pull && npm install && npm run build && dora doctor`;
  }
  return "npm install -g dora@latest && dora doctor";
}
