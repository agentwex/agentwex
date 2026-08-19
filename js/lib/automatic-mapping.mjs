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
  const derivedVersion = mcp ? "unknown" : safe(adapter.clientVersion, "unknown");
  return {
    toolRegistry: mcp ? "mcp" : "runtime",
    toolId: mcp ? normalized : `${safe(adapter.clientId, "runtime")}/${normalized}`,
    toolVersion: derivedVersion,
    authMode: "other",
    operation: normalized,
    resolutionKind: "none",
    mappingBasis: "runtime-derived",
  };
}

export function mappingForTool(toolName, adapter = {}) {
  return adapter.tools?.[toolName] ?? runtimeDerivedMapping(toolName, adapter);
}
