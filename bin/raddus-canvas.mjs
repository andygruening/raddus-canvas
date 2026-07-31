#!/usr/bin/env node

import { startServer } from "../server/index.mjs";

await startServer({ isDev: process.argv.includes("--dev") });
