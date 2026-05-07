#!/usr/bin/env node
import("../cli.bundle.mjs").catch((e) => { process.stderr.write(e.message + "\n"); process.exit(1); });
