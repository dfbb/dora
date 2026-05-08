import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "skilldb-mini.json"));
writeFileSync(join(here, "skilldb-mini.json.gz"), gzipSync(src));
console.log("wrote skilldb-mini.json.gz");
