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
  return {
    toolRegistry: mcp ? "mcp" : "runtime",
    toolId: mcp ? normalized : `${safe(adapter.clientId, "runtime")}/${normalized}`,
    toolVersion: "unknown",
    authMode: "other",
    operation: normalized,
    resolutionKind: "none",
    mappingBasis: "runtime-derived",
  };
}

export function mappingForTool(toolName, adapter = {}) {
  return adapter.tools?.[toolName] ?? runtimeDerivedMapping(toolName, adapter);
}
