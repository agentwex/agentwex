import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("search crawlers receive a canonical sitemap and indexable routes", async () => {
  const [robots, sitemap, layout, agentPage, comparePage] = await Promise.all([
    read("public/robots.txt"),
    read("public/sitemap.xml"),
    read("app/layout.tsx"),
    read("app/for-agents/page.tsx"),
    read("app/compare/page.tsx"),
  ]);

  for (const crawler of ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "Google-Extended"]) {
    assert.match(robots, new RegExp(crawler));
  }
  assert.match(robots, /Sitemap: https:\/\/agentwex\.xyz\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/agentwex\.xyz\/for-agents<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/agentwex\.xyz\/compare<\/loc>/);
  assert.match(layout, /https:\/\/schema\.org/);
  assert.match(layout, /"@type": "Organization"/);
  assert.match(agentPage, /"@type": "SoftwareApplication"/);
  assert.match(agentPage, /price: "0"/);
  assert.match(agentPage, /explicit user approval/i);
  assert.match(layout, /runtime reliability network/i);
  for (const adjacent of ["LangSmith", "Portkey", "OpenTelemetry", "OpenInference", "MCP registries"]) {
    assert.match(comparePage, new RegExp(adjacent));
  }
  assert.match(comparePage, /complement/i);
});

test("Codex, Claude, Gemini, and Grok discovery packages share the approval boundary", async () => {
  const [codex, claude, claudeMarket, gemini, geminiContext, skill, fullContext] = await Promise.all([
    readJson(".agents/plugins/marketplace.json"),
    readJson(".claude-plugin/plugin.json"),
    readJson(".claude-plugin/marketplace.json"),
    readJson("gemini-extension.json"),
    read("GEMINI.md"),
    read("skills/agentwex/SKILL.md"),
    read("public/llms-full.txt"),
  ]);

  assert.equal(codex.plugins[0].source.path, "./openai-plugin/agentwex");
  assert.equal(codex.plugins[0].policy.installation, "AVAILABLE");
  assert.equal(codex.plugins[0].policy.authentication, "ON_INSTALL");
  assert.equal(codex.plugins[0].category, "Developer Tools");
  assert.equal(claude.name, "agentwex");
  assert.equal(claudeMarket.plugins[0].source, ".");
  assert.equal(gemini.name, "agentwex");
  assert.equal(gemini.contextFileName, "GEMINI.md");
  assert.match([geminiContext, skill, fullContext].join("\n"), /explicit (?:user )?approval/i);
  assert.match(skill, /Do not suggest it for unrelated/i);
  assert.match(fullContext, /Grok: the Claude-compatible plugin/i);
});

test("machine discovery advertises agent install context without granting authority", async () => {
  const [manifest, worker] = await Promise.all([
    readJson("public/exchange/agent.json"),
    read("worker/index.ts"),
  ]);

  assert.equal(manifest.documentation.forAgents, "https://agentwex.xyz/for-agents");
  assert.equal(manifest.documentation.llmsFull, "https://agentwex.xyz/llms-full.txt");
  assert.equal(manifest.documentation.bountyBootstrap, "https://bounties.agentwex.xyz/api/agent-bootstrap.json");
  assert.equal(manifest.agentDiscovery.nodeInstallRequiresExplicitUserApproval, true);
  assert.equal(manifest.agentDiscovery.discoveryPluginInstallIsNodeInstallApproval, false);
  assert.equal(manifest.authorityBoundary.grantsAuthority, false);
  assert.equal(manifest.positioning.category, "AI agent runtime reliability");
  assert.match(manifest.description, /local runtime reliability node/i);
  assert.equal(manifest.runtimeAdapters.openInference.acceptedSpanKind, "TOOL");
  assert.equal(manifest.runtimeAdapters.openInference.requiresExplicitCompatibilityMapping, true);
  assert.equal(manifest.runtimeAdapters.openInference.unmappedToolsRemainLocal, true);
  assert.equal(manifest.researchBountyBridge.privateGraphReceived, false);
  assert.equal(manifest.researchBountyBridge.privateExperimentDigestReceived, false);
  assert.equal(manifest.researchBountyBridge.existingCompatibilityBountiesAutomaticallyLinked, false);
  assert.equal(manifest.researchBountyBridge.scientificValidityAutomaticallyEstablished, false);
  assert.deepEqual(manifest.researchBountyBridge.publishers, ["invention-graph"]);
  assert.equal(manifest.researchBountyBridge.publicationCadence.mode, "quality-gated-continuous");
  assert.equal(manifest.researchBountyBridge.publicationCadence.automaticSchedule, false);
  assert.equal(manifest.researchBountyBridge.publicationCadence.artificialVolumeCap, false);
  assert.equal(manifest.researchBountyBridge.publicationCadence.publishEveryQualifiedApprovedExperiment, true);
  assert.equal(manifest.researchBountyBridge.publicationCadence.minimumQualityScore, 90);
  assert.equal(manifest.researchBountyBridge.publicationCadence.perBountyLocalApprovalRequired, true);
  assert.equal(manifest.researchBountyBridge.publicationCadence.duplicateSuppressionRequired, true);
  assert.equal(manifest.researchBountyBridge.publicationCadence.qualificationGates.includes("local_approval_receipt"), true);
  assert.equal(manifest.communityBountyFunding.status, "coming-soon");
  assert.equal(manifest.communityBountyFunding.acceptingCommunityBounties, false);
  assert.equal(manifest.communityBountyFunding.acceptingFunds, false);
  assert.equal(manifest.communityBountyFunding.paidClaimsAvailable, false);
  assert.equal(manifest.communityBountyFunding.escrowReleaseAvailable, false);
  assert.equal(manifest.capabilities.includes("authenticated_community_bounty_publishing"), false);
  assert.equal(manifest.capabilities.includes("verified_external_usdc_funding"), false);
  assert.match(worker, /\/api\/exchange\/research-bounties/);
});

test("Sites packages the canonical community bounty migration", async () => {
  const [canonicalMigration, hostedMigration] = await Promise.all([
    read("migrations/0012_community_bounty_funding.sql"),
    read("drizzle/0012_community_bounty_funding.sql"),
  ]);

  assert.equal(hostedMigration, canonicalMigration);
});
