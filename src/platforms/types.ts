export interface InstallFile {
  path: string;
  content: string;
  mode: "write" | "json-merge" | "toml-merge" | "skip-if-exists" | "append-if-missing";
  marker?: string;
  backup?: boolean;
  atomic?: boolean;
}

export interface PlatformAdapter {
  name: string;
  installFiles: () => InstallFile[];
  sessionStartHook: (input: unknown) => {
    hookSpecificOutput: {
      hookEventName: "SessionStart";
      additionalContext: string;
    };
  };
}

export const ROUTING = `You have access to dora — a tool that finds and loads community skills for tasks you don't already know how to do. When the user describes a non-trivial task and you're unsure which approach is best, call the dora_query MCP tool first.`;

export const ROUTING_WITH_CONTEXT = [
  "<!-- dora:routing -->",
  "# dora",
  "",
  ROUTING,
  "",
  "When dora_load returns a non-null execution_context field, output it before executing the loaded skill.",
].join("\n");
