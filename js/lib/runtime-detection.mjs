import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Some runtimes ship inside an application bundle and are never placed on PATH.
 * Codex is the common case on macOS: the ChatGPT desktop app bundles the CLI in
 * its Resources directory, so `execFile("codex")` fails on a machine where Codex
 * is installed and in daily use.
 *
 * Detecting by name alone therefore under-reports installed runtimes, and the
 * failure is silent: the node installs cleanly, reports healthy, and observes
 * nothing from that runtime. These are additional locations to try after PATH
 * resolution fails. A hit here is still confirmed by running `--version`, so a
 * stale path cannot produce a false positive.
 */
const bundledLocations = {
  codex: [
    "/Applications/ChatGPT.app/Contents/Resources/codex",
    resolve(homedir(), "Applications/ChatGPT.app/Contents/Resources/codex"),
    resolve(homedir(), ".codex/bin/codex"),
  ],
  "claude-code": [resolve(homedir(), ".claude/local/claude")],
  "gemini-cli": [resolve(homedir(), ".gemini/bin/gemini")],
  bernstein: [resolve(homedir(), ".bernstein/bin/bernstein")],
};

const candidates = [
  { id: "bernstein", command: "bernstein", adapter: "bernstein" },
  { id: "claude-code", command: "claude", adapter: "claude-code" },
  { id: "codex", command: "codex", adapter: "codex" },
  { id: "gemini-cli", command: "gemini", adapter: "gemini-cli" },
];

function versionFrom(stdout, stderr) {
  return `${stdout}\n${stderr}`.match(/\d+(?:\.\d+){1,3}/)?.[0] ?? "detected";
}

async function tryCommand(command) {
  const { stdout, stderr } = await execFileAsync(command, ["--version"], { timeout: 2_000 });
  return versionFrom(stdout, stderr);
}

async function isExecutable(path) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function inspect(candidate) {
  // PATH first: an operator-installed runtime on PATH is the authoritative one.
  try {
    const version = await tryCommand(candidate.command);
    return { ...candidate, detected: true, version, resolvedFrom: "path", status: "adapter_configuration_required" };
  } catch {
    // fall through to bundled locations
  }

  for (const path of bundledLocations[candidate.id] ?? []) {
    if (!(await isExecutable(path))) continue;
    try {
      const version = await tryCommand(path);
      return {
        ...candidate,
        command: path,
        detected: true,
        version,
        resolvedFrom: "bundled",
        status: "adapter_configuration_required",
      };
    } catch {
      // An executable that will not report a version is not a usable runtime.
      // Keep looking rather than claiming a detection we cannot confirm.
    }
  }

  return { ...candidate, detected: false, status: "not_installed" };
}

export async function detectRuntimes() {
  return Promise.all(candidates.map(inspect));
}
