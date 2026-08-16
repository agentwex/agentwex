const OUTCOME_RECEIPT_FIELDS = Object.freeze([
  "schema", "toolRegistry", "toolId", "toolVersion", "clientId", "clientVersion",
  "environment", "authMode", "operation", "outcome", "errorClass", "resolutionKind",
  "routeFingerprint", "observedAt", "provenanceRootId", "independenceBasis",
  "attestation.algorithm", "attestation.keyId", "attestation.signature",
]);

const FAILURE_QUERY_FIELDS = Object.freeze([
  "schema", "toolRegistry", "toolId", "attemptedToolVersion", "clientId",
  "attemptedClientVersion", "environment", "authMode", "operation",
  "localEvidenceStatus", "localEvidenceReceiptHash", "maxAgeDays", "minimumIndependentRoots",
]);

const NEVER_SHARED_FIELDS = Object.freeze([
  "raw prompts", "tool arguments", "tool results", "credentials or API keys",
  "local collector token", "private signing key", "customer content", "source code",
  "proprietary methods", "raw trace IDs", "URLs",
]);

function configuredMappings(config) {
  return Object.entries(config?.adapters ?? {}).flatMap(([runtime, adapter]) => {
    if (adapter?.enabled !== true) return [];
    const tools = Object.entries(adapter.tools ?? {}).map(([observedTool, mapping]) => ({
      observedTool,
      toolRegistry: mapping.toolRegistry,
      toolId: mapping.toolId,
      toolVersion: mapping.toolVersion,
      authMode: mapping.authMode,
      operation: mapping.operation,
      resolutionKind: mapping.resolutionKind,
    }));
    return [{ runtime, clientVersion: adapter.clientVersion ?? "unknown", environment: adapter.environment ?? "other", tools }];
  });
}

export function buildPrivacyInspection(config = null) {
  const target = config?.baseUrl ?? "https://agentwex.xyz";
  return {
    schema: "agentwex.inspect.v1",
    networkContacted: false,
    installed: Boolean(config),
    contributionStatus: !config
      ? "not_configured"
      : config.policy?.shareToolOutcomes === true ? "enabled" : "disabled",
    exchangeTarget: new URL(target).origin,
    pseudonymousNodeId: config?.agentId ?? null,
    trigger: "completed execute_tool events with an explicit success or failure outcome",
    outbound: {
      authentication: "Bearer credential (value never displayed)",
      outcomeReceiptFields: OUTCOME_RECEIPT_FIELDS,
      additionalFailureQueryFields: FAILURE_QUERY_FIELDS,
      configuredRouteMappings: configuredMappings(config),
    },
    neverShared: NEVER_SHARED_FIELDS,
    authorityGranted: false,
    note: "This command reads local configuration only. It sends no request and changes no setting.",
  };
}
