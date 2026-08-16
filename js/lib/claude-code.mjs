import { attributeMap, isoFromUnixNano } from "./otlp.mjs";
import { mappingForTool } from "./automatic-mapping.mjs";

function toolResultRecords(payload) {
  const records = [];
  for (const resourceLogs of payload?.resourceLogs ?? []) {
    const resource = attributeMap(resourceLogs.resource?.attributes);
    for (const scopeLogs of resourceLogs.scopeLogs ?? resourceLogs.instrumentationLibraryLogs ?? []) {
      for (const record of scopeLogs.logRecords ?? []) {
        const attributes = { ...resource, ...attributeMap(record.attributes) };
        if (attributes["event.name"] !== "tool_result") continue;
        records.push({
          attributes,
          observedAt: isoFromUnixNano(record.timeUnixNano ?? record.observedTimeUnixNano),
        });
      }
    }
  }
  return records;
}

function explicitBoolean(value) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

/**
 * Translate Claude Code's documented tool_result OTLP logs into the canonical
 * Agent WEX execute-tool shape. Raw log bodies, tool parameters, inputs and results
 * are deliberately never read.
 */
export function spansFromClaudeCodeLogs(payload, adapter = {}) {
  const records = toolResultRecords(payload);
  const spans = [];
  let ignored = 0;
  for (const record of records) {
    const toolName = record.attributes.tool_name;
    const mapping = mappingForTool(toolName, adapter);
    const success = explicitBoolean(record.attributes.success);
    const toolUseId = record.attributes.tool_use_id;
    if (adapter.enabled !== true || !mapping || success == null || !toolUseId || !record.observedAt) {
      ignored += 1;
      continue;
    }
    spans.push({
      traceId: `claude-code:${toolUseId}`,
      spanId: "claude-code-tool-result",
      endTime: record.observedAt,
      status: { code: success ? "OK" : "ERROR" },
      resource: { attributes: {} },
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": mapping.toolId ?? toolName,
        "awe.tool.registry": mapping.toolRegistry,
        "awe.tool.version": mapping.toolVersion,
        "awe.client.id": "claude-code",
        "awe.client.version": adapter.clientVersion,
        "awe.environment": adapter.environment,
        "awe.auth.mode": mapping.authMode,
        "awe.operation": mapping.operation ?? toolName,
        "awe.resolution.kind": mapping.resolutionKind ?? "none",
        "error.type": success ? undefined : (record.attributes.error_type ?? "other"),
      },
    });
  }
  return { received: records.length, ignored, spans };
}
