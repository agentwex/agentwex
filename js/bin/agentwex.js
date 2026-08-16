#!/usr/bin/env node

const version = "0.0.1";
const args = new Set(process.argv.slice(2));

if (args.has("--version") || args.has("-V")) {
  console.log(`agentwex ${version}`);
  process.exit(0);
}

console.log(`AgentWex ${version}`);
console.log("Create and exchange verifiable witness receipts for AI-agent actions.");
console.log("");
console.log("Usage: agentwex [--version]");
