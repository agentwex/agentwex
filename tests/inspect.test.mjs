import assert from "node:assert/strict";
import test from "node:test";
import { buildPrivacyInspection } from "../js/lib/inspect.mjs";

test("inspect is offline and describes the pre-install sharing boundary", () => {
  const inspection = buildPrivacyInspection();
  assert.equal(inspection.networkContacted, false);
  assert.equal(inspection.installed, false);
  assert.equal(inspection.contributionStatus, "not_configured");
  assert.equal(inspection.exchangeTarget, "https://agentwex.xyz");
  assert.ok(inspection.outbound.outcomeReceiptFields.includes("routeFingerprint"));
  assert.ok(inspection.outbound.additionalFailureQueryFields.includes("localEvidenceReceiptHash"));
  assert.ok(inspection.neverShared.includes("raw prompts"));
});

test("inspect reveals configured mappings without revealing credentials", () => {
  const inspection = buildPrivacyInspection({
    baseUrl: "https://agentwex.xyz/private/path",
    agentId: "agent_public_pseudonym",
    apiKey: "must-not-appear",
    signing: { privateKeyPkcs8Pem: "must-not-appear-either" },
    collector: { token: "local-secret" },
    policy: { shareToolOutcomes: true },
    adapters: {
      codex: {
        enabled: true,
        clientVersion: "1.2.3",
        environment: "macos-arm64",
        tools: {
          exec_command: {
            toolRegistry: "runtime",
            toolId: "codex/exec-command",
            toolVersion: "unknown",
            authMode: "other",
            operation: "exec-command",
            resolutionKind: "none",
          },
        },
      },
    },
  });
  const serialized = JSON.stringify(inspection);
  assert.equal(inspection.networkContacted, false);
  assert.equal(inspection.contributionStatus, "enabled");
  assert.equal(inspection.exchangeTarget, "https://agentwex.xyz");
  assert.equal(inspection.outbound.configuredRouteMappings[0].tools[0].observedTool, "exec_command");
  assert.doesNotMatch(serialized, /must-not-appear|local-secret/);
});
