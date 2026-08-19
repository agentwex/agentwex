import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

/**
 * Learn MCP server versions from the runtime's own declarations.
 *
 * A tool name carries the server that owns it -- `mcp__<server>__<tool>` -- but
 * not its version, so automatic mapping had to record "unknown" and every
 * release of a server collapsed into one indistinguishable cell. That is the
 * discrimination a compatibility cell exists to make, so the common
 * zero-configuration path produced the weakest possible evidence.
 *
 * Most servers are declared with their version already in the launch command
 * (`npx -y @scope/pkg@1.2.3`, `uvx pkg==1.2.3`), so it can be read rather than
 * guessed. Nothing is executed and no network call is made: these are config
 * files being parsed.
 *
 * A server whose version cannot be established stays absent from the result, so
 * mapping falls back to "unknown" rather than inventing something. Not knowing
 * is reported, never filled in.
 */

const NPM_SPEC = /^(?<name>@[^/\s@]+\/[^/\s@]+|[^@\s/][^/\s@]*)@(?<version>[0-9][^\s]*)$/;
const PYPI_SPEC = /^(?<name>[A-Za-z0-9._-]+)==(?<version>[0-9][^\s]*)$/;

function fromNpxArgs(args) {
  for (const arg of args) {
    if (typeof arg !== "string" || arg.startsWith("-")) continue;
    const match = NPM_SPEC.exec(arg);
    if (match) return { packageId: match.groups.name, version: match.groups.version, packageRegistry: "npm" };
  }
  return null;
}

function fromUvxArgs(args) {
  for (const arg of args) {
    if (typeof arg !== "string" || arg.startsWith("-")) continue;
    const match = PYPI_SPEC.exec(arg);
    if (match) return { packageId: match.groups.name, version: match.groups.version, packageRegistry: "pypi" };
  }
  return null;
}

/** Read one declared server entry. Returns null when the version is not stated. */
export function serverFromDeclaration(declaration) {
  if (!declaration || typeof declaration !== "object") return null;
  // An explicit version always wins over anything inferred from a command line.
  if (typeof declaration.version === "string" && declaration.version.length > 0) {
    return { version: declaration.version, packageId: declaration.packageId ?? null, packageRegistry: declaration.registry ?? null };
  }
  const command = typeof declaration.command === "string" ? declaration.command : "";
  const args = Array.isArray(declaration.args) ? declaration.args : [];
  if (/(^|\/)npx$/.test(command) || command === "bunx" || command === "pnpx") return fromNpxArgs(args);
  if (/(^|\/)uvx$/.test(command) || command === "pipx") return fromUvxArgs(args);
  // A bare interpreter pointed at a local path (node ./server.js, python -m x)
  // states no version. Reporting "unknown" is the honest outcome.
  return null;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function collect(into, declarations) {
  if (!declarations || typeof declarations !== "object") return;
  for (const [name, declaration] of Object.entries(declarations)) {
    if (into[name]) continue; // earlier sources win; nearest config is read first
    const resolved = serverFromDeclaration(declaration);
    if (resolved) into[name] = resolved;
  }
}

/**
 * Discover declared MCP servers across a runtime's configuration files.
 * Returns { [serverName]: { version, packageId, packageRegistry } }.
 */
export async function discoverMcpServers({ home = homedir(), projectDir = null } = {}) {
  const discovered = {};
  const sources = [
    projectDir ? resolve(projectDir, ".mcp.json") : null,
    resolve(home, ".claude.json"),
    resolve(home, ".claude", "settings.json"),
    resolve(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    resolve(home, ".codex", "mcp.json"),
  ].filter(Boolean);

  for (const source of sources) {
    const parsed = await readJson(source);
    if (!parsed) continue;
    collect(discovered, parsed.mcpServers);
    // Claude Code stores per-project blocks alongside the global ones.
    for (const project of Object.values(parsed.projects ?? {})) collect(discovered, project?.mcpServers);
  }
  return discovered;
}

/** `mcp__github__search_issues` -> `github`. Returns null when not an MCP tool. */
export function mcpServerFromToolName(toolName) {
  if (typeof toolName !== "string") return null;
  const match = /^mcp__([^_]+(?:_[^_]+)*?)__/.exec(toolName);
  if (match) return match[1];
  const separated = /^mcp[./:-]([^./:-]+)[./:-]/.exec(toolName);
  return separated ? separated[1] : null;
}
