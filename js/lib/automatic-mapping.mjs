import { mcpServerFromToolName } from "./mcp-discovery.mjs";

const safe = (value, fallback) => {
  const normalized = String(value ?? "")
    .trim()
    .replaceAll(/[^A-Za-z0-9._+~/-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 120);
  return normalized || fallback;
};

/**
 * Produce the narrowest honest mapping available when a runtime reports only a
 * tool name. Unknown package versions and authentication modes stay explicit.
 * A precise operator-supplied mapping always overrides this fallback.
 */
export function runtimeDerivedMapping(toolName, adapter = {}) {
  if (adapter.autoMap !== true || typeof toolName !== "string" || toolName.length === 0) return null;
  const normalized = safe(toolName, "unknown-tool");
  const mcp = /^mcp(?:__|[./:-])/.test(toolName);
  // A runtime's own built-in tool has no version of its own: it ships with the
  // runtime, so the client version is the tool version. Writing "unknown" here
  // discarded a version we already hold, and collapsed every release of a
  // runtime into a single indistinguishable cell.
  //
  // An MCP server's version genuinely is not knowable from a tool name, so it
  // stays explicitly unknown rather than being guessed.
  // An MCP server's version is not in its tool name, but it is usually in the
  // runtime's own declaration of that server. Read it when it is there; stay
  // explicitly unknown when it is not, rather than borrowing the client's
  // version, which would describe the wrong thing.
  const declaredServer = mcp ? adapter.mcpServers?.[mcpServerFromToolName(toolName)] : null;
  const derivedVersion = mcp
    ? safe(declaredServer?.version, "unknown")
    : safe(adapter.clientVersion, "unknown");
  return {
    toolRegistry: mcp ? "mcp" : "runtime",
    toolId: mcp ? normalized : `${safe(adapter.clientId, "runtime")}/${normalized}`,
    toolVersion: derivedVersion,
    authMode: "other",
    operation: normalized,
    resolutionKind: "none",
    mappingBasis: "runtime-derived",
    versionBasis: mcp ? (declaredServer ? "declared-mcp-server" : "unknown") : "runtime-client",
    // toolId for an MCP tool is the tool's own name, and that name is published
    // in coverage. For a public server that is the point: it is how another
    // operator looks the cell up. For a private or internal server it is a
    // proprietary string, and nobody else can call that server anyway, so the
    // cell is unusable to them for the same reason a runtime-internal tool is.
    //
    // A namespace counts as public only when discovery resolved the server to a
    // published package. Anything unresolved is treated as private: the name is
    // never transmitted, and an operator who knows better can say so with an
    // explicit mapping.
    publicNamespace: mcp ? Boolean(declaredServer?.packageId) : false,
  };
}

export function mappingForTool(toolName, adapter = {}) {
  return adapter.tools?.[toolName] ?? runtimeDerivedMapping(toolName, adapter);
}
