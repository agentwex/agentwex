import { attributeMap, isoFromUnixNano } from "./otlp.mjs";
import { mappingForTool } from "./automatic-mapping.mjs";

function observedAt(record, attributes) {
  if (typeof attributes["event.timestamp"] === "string" && attributes["event.timestamp"].length > 0) {
    return attributes["event.timestamp"];
  }
  const eventTime = String(record.timeUnixNano ?? "0");
  return isoFromUnixNano(eventTime !== "0" ? eventTime : record.observedTimeUnixNano);
}

function toolResultRecords(payload) {
  const records = [];
  for (const resourceLogs of payload?.resourceLogs ?? []) {
    const resource = attributeMap(resourceLogs.resource?.attributes);
    for (const scopeLogs of resourceLogs.scopeLogs ?? resourceLogs.instrumentationLibraryLogs ?? []) {
      for (const record of scopeLogs.logRecords ?? []) {
        const attributes = { ...resource, ...attributeMap(record.attributes) };
        if (attributes["event.name"] !== "codex.tool_result") continue;
        records.push({ attributes, observedAt: observedAt(record, attributes) });
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
 * Translate Codex's documented codex.tool_result OTLP logs into the canonical
 * Agent WEX execute-tool shape. Arguments, output and log bodies are intentionally
 * never read even though some Codex versions include them in the local event.
 */
export function spansFromCodexLogs(payload, adapter = {}) {
  const records = toolResultRecords(payload);
  const spans = [];
  let ignored = 0;
  for (const record of records) {
    const toolName = record.attributes.tool_name;
    const mapping = mappingForTool(toolName, adapter);
    const success = explicitBoolean(record.attributes.success);
    const callId = record.attributes.call_id;
    if (adapter.enabled !== true || !mapping || success == null || !callId || !record.observedAt) {
      ignored += 1;
      continue;
    }
    spans.push({
      traceId: `codex:${callId}`,
      spanId: "codex-tool-result",
      endTime: record.observedAt,
      status: { code: success ? "OK" : "ERROR" },
      resource: { attributes: {} },
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": mapping.toolId ?? toolName,
        "awe.tool.registry": mapping.toolRegistry,
        "awe.tool.version": mapping.toolVersion,
        "awe.client.id": "codex",
        "awe.client.version": adapter.clientVersion,
        "awe.environment": adapter.environment,
        "awe.auth.mode": mapping.authMode,
        "awe.operation": mapping.operation ?? toolName,
        "awe.resolution.kind": mapping.resolutionKind ?? "none",
        "error.type": success ? undefined : "other",
      },
    });
  }
  return { received: records.length, ignored, spans };
}
