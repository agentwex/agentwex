import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const candidates = [
  { id: "bernstein", command: "bernstein", adapter: "bernstein" },
  { id: "claude-code", command: "claude", adapter: "claude-code" },
  { id: "codex", command: "codex", adapter: "codex" },
  { id: "gemini-cli", command: "gemini", adapter: "gemini-cli" },
];

async function inspect(candidate) {
  try {
    const { stdout, stderr } = await execFileAsync(candidate.command, ["--version"], { timeout: 2_000 });
    const output = `${stdout}\n${stderr}`;
    const version = output.match(/\d+(?:\.\d+){1,3}/)?.[0] ?? "detected";
    return { ...candidate, detected: true, version, status: "adapter_configuration_required" };
  } catch {
    return { ...candidate, detected: false, status: "not_installed" };
  }
}

export async function detectRuntimes() {
  return Promise.all(candidates.map(inspect));
}
