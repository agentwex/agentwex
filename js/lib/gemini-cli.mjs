import { attributeMap, isoFromUnixNano } from "./otlp.mjs";
import { mappingForTool } from "./automatic-mapping.mjs";

function toolCallRecords(payload) {
  const records = [];
  for (const resourceLogs of payload?.resourceLogs ?? []) {
    const resource = attributeMap(resourceLogs.resource?.attributes);
    for (const scopeLogs of resourceLogs.scopeLogs ?? resourceLogs.instrumentationLibraryLogs ?? []) {
      for (const record of scopeLogs.logRecords ?? []) {
        const attributes = { ...resource, ...attributeMap(record.attributes) };
        if (attributes["event.name"] !== "gemini_cli.tool_call") continue;
        const eventTime = String(record.timeUnixNano ?? "0");
        records.push({
          attributes,
          observedAt: isoFromUnixNano(eventTime !== "0" ? eventTime : record.observedTimeUnixNano),
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
 * Translate Gemini CLI's documented gemini_cli.tool_call OTLP logs into the
 * canonical Agent WEX execute-tool shape. Function arguments, errors, metadata and
 * log bodies are deliberately never read.
 */
export function spansFromGeminiCliLogs(payload, adapter = {}) {
  const records = toolCallRecords(payload);
  const spans = [];
  let ignored = 0;
  for (const record of records) {
    const toolName = record.attributes.function_name;
    const mapping = mappingForTool(toolName, adapter);
    const success = explicitBoolean(record.attributes.success);
    const sessionId = record.attributes.sessionId ?? record.attributes["session.id"];
    if (adapter.enabled !== true || !mapping || success == null || !sessionId || !record.observedAt) {
      ignored += 1;
      continue;
    }
    spans.push({
      traceId: `gemini-cli:${sessionId}:${toolName}:${record.observedAt}`,
      spanId: "gemini-cli-tool-call",
      endTime: record.observedAt,
      status: { code: success ? "OK" : "ERROR" },
      resource: { attributes: {} },
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": mapping.toolId ?? toolName,
        "awe.tool.registry": mapping.toolRegistry,
        "awe.tool.version": mapping.toolVersion,
        "awe.client.id": "gemini-cli",
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
