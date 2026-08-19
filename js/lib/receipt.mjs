import { createHash } from "node:crypto";

const registries = new Set(["mcp", "npm", "pypi", "github", "public-api", "runtime"]);
const environments = new Set(["macos-arm64", "macos-x64", "linux-arm64", "linux-x64", "windows-x64", "container", "other"]);
const authModes = new Set(["none", "api-key", "oauth-pkce", "oauth-client", "mtls", "signed-request", "other"]);
const resolutions = new Set(["none", "upgrade-client", "upgrade-tool", "upgrade-client-and-tool", "change-auth-flow", "change-transport", "change-runtime", "retry-later", "alternate-tool"]);
const effectClasses = new Set(["read", "write", "execute", "communicate", "observe", "other"]);

const digest = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const attributes = (span) => ({ ...(span.resource?.attributes ?? {}), ...(span.attributes ?? {}) });

function requiredString(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Missing OpenTelemetry attribute: ${name}`);
  return value;
}

export function adaptOtelSpanToRouteOutcome(span, policy) {
  if (policy?.enabled !== true || policy?.shareToolOutcomes !== true) {
    return { status: "IGNORED", reason: "operator_policy_disabled", authorityGranted: false };
  }
  const attrs = attributes(span);
  if (attrs["gen_ai.operation.name"] !== "execute_tool") {
    return { status: "IGNORED", reason: "not_an_execute_tool_span", authorityGranted: false };
  }
  const statusCode = span.status?.code;
  if (statusCode !== "OK" && statusCode !== "ERROR") {
    return { status: "IGNORED", reason: "outcome_not_explicit", authorityGranted: false };
  }
  const toolRegistry = requiredString(attrs["awe.tool.registry"], "awe.tool.registry");
  // Credits are for evidence another operator can act on. A runtime's own
  // built-in tool offers no alternative to route to: a reader already inside
  // that runtime cannot choose a different one, so the cell answers no question
  // they could ask before making a call. It is observed locally and never
  // submitted, so it can neither earn credits nor pad public coverage.
  //
  // An operator who believes a tool is externally routable can map it
  // explicitly under a real registry, which is a deliberate act rather than a
  // default.
  if (toolRegistry === "runtime") {
    return { status: "IGNORED", reason: "runtime_internal_not_operator_actionable", authorityGranted: false };
  }
  const environment = requiredString(attrs["awe.environment"], "awe.environment");
  const authMode = requiredString(attrs["awe.auth.mode"], "awe.auth.mode");
  const resolutionKind = attrs["awe.resolution.kind"] ?? "none";
  if (!registries.has(toolRegistry)) throw new Error("Unsupported Agent WEX tool registry");
  if (!environments.has(environment)) throw new Error("Unsupported Agent WEX environment class");
  if (!authModes.has(authMode)) throw new Error("Unsupported Agent WEX authentication mode");
  if (!resolutions.has(resolutionKind)) throw new Error("Unsupported Agent WEX resolution kind");
  const toolId = requiredString(attrs["gen_ai.tool.name"], "gen_ai.tool.name");
  const toolVersion = requiredString(attrs["awe.tool.version"], "awe.tool.version");
  const clientId = requiredString(attrs["awe.client.id"], "awe.client.id");
  const clientVersion = requiredString(attrs["awe.client.version"], "awe.client.version");
  const operation = requiredString(attrs["awe.operation"], "awe.operation");
  const capabilityId = attrs["awe.capability.id"] ?? null;
  const effectClass = attrs["awe.effect.class"] ?? null;
  if ((capabilityId == null) !== (effectClass == null)) throw new Error("Agent WEX capability and effect must be provided together");
  if (effectClass != null && !effectClasses.has(effectClass)) throw new Error("Unsupported Agent WEX effect class");
  const observedAt = requiredString(span.endTime, "span.endTime");
  const traceId = requiredString(span.traceId, "span.traceId");
  const agentId = requiredString(policy.agentId, "policy.agentId");
  const routeShape = [toolRegistry, toolId, toolVersion, clientId, clientVersion, environment, authMode, operation, capabilityId ?? "", effectClass ?? "", resolutionKind].join("|");
  return {
    status: "READY_TO_SUBMIT",
    receipt: {
      schema: "minority-prophet.working-route-comp.v0.1",
      toolRegistry,
      toolId,
      toolVersion,
      clientId,
      clientVersion,
      environment,
      authMode,
      operation,
      ...(capabilityId ? { capabilityId, effectClass } : {}),
      outcome: statusCode === "OK" ? "success" : "failure",
      errorClass: statusCode === "ERROR" ? (attrs["error.type"] ?? "other") : null,
      resolutionKind,
      routeFingerprint: digest(routeShape),
      observedAt,
      provenanceRootId: digest(`${agentId}|${traceId}`),
      independenceBasis: "declared",
    },
    review: {
      acceptanceStatus: "pending",
      note: "OpenTelemetry proves an observed execution event, not independence. The exchange must verify whether this root is additive.",
    },
    authorityGranted: false,
  };
}
