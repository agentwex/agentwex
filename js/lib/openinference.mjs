/**
 * Normalize OpenInference TOOL spans into Agent WEX's bounded OpenTelemetry
 * input. OpenInference may carry prompts, arguments, results, metadata, URLs,
 * exception messages, and stack traces. This module copies none of them.
 *
 * An exact operator mapping is mandatory. `tool.name` alone does not establish
 * that a tool is public, which version ran, or which compatibility cell another
 * operator could use.
 */

function attributes(span) {
  return { ...(span.resource?.attributes ?? {}), ...(span.attributes ?? {}) };
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function errorClass(value) {
  const normalized = String(value ?? "").toLowerCase();
  if (/auth|credential|permission|unauthor|forbidden/.test(normalized)) return "authentication";
  if (/timeout|deadline/.test(normalized)) return "timeout";
  if (/rate.?limit|throttl/.test(normalized)) return "rate-limit";
  if (/network|dns|connect|socket|tls/.test(normalized)) return "network";
  if (/unavailable|service.?down|overload/.test(normalized)) return "unavailable";
  if (/policy|denied|blocked/.test(normalized)) return "policy";
  if (/compat|version|schema|protocol|not.?found|unsupported/.test(normalized)) return "compatibility";
  return "other";
}

function normalizeToolSpan(span, adapter) {
  const attrs = attributes(span);

  // Spans already carrying the complete Agent WEX convention stay on the
  // canonical path, even when another instrumentor also labels them.
  if (attrs["gen_ai.operation.name"] === "execute_tool") return { span, normalized: false };
  if (attrs["openinference.span.kind"] == null) return { span, normalized: false };
  if (String(attrs["openinference.span.kind"]).toUpperCase() !== "TOOL") return null;
  if (adapter?.enabled !== true) return null;

  const observedTool = nonEmptyString(attrs["tool.name"]);
  if (!observedTool) return null;
  const mapping = adapter.tools?.[observedTool];
  if (!mapping) return null;

  const errorType = errorClass(nonEmptyString(attrs["error.type"])
    ?? nonEmptyString(attrs["exception.type"]));

  return {
    normalized: true,
    span: {
      traceId: span.traceId,
      endTime: span.endTime,
      status: span.status,
      // Resource attributes can contain private application and host identity.
      resource: { attributes: {} },
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": mapping.toolId ?? observedTool,
        "awe.tool.registry": mapping.toolRegistry,
        "awe.tool.version": mapping.toolVersion,
        "awe.client.id": mapping.clientId ?? adapter.clientId,
        "awe.client.version": mapping.clientVersion ?? adapter.clientVersion,
        "awe.environment": mapping.environment ?? adapter.environment,
        "awe.auth.mode": mapping.authMode,
        "awe.operation": mapping.operation ?? observedTool,
        ...(mapping.capabilityId ? {
          "awe.capability.id": mapping.capabilityId,
          "awe.effect.class": mapping.effectClass,
        } : {}),
        "awe.resolution.kind": mapping.resolutionKind ?? "none",
        ...(span.status?.code === "ERROR" ? { "error.type": errorType } : {}),
      },
    },
  };
}

export function normalizeOpenInferenceSpans(spans, adapter = {}) {
  const output = [];
  let ignored = 0;
  let normalized = 0;
  for (const span of spans) {
    const result = normalizeToolSpan(span, adapter);
    if (!result) {
      ignored += 1;
      continue;
    }
    output.push(result.span);
    if (result.normalized) normalized += 1;
  }
  return { spans: output, received: spans.length, ignored, normalized };
}
