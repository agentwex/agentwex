import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

test("release verification accepts one canonical version and truthful publication states", async () => {
  const { verifyReleaseMetadata } = await import("../scripts/release-metadata.mjs");
  const verified = await verifyReleaseMetadata(repositoryRoot);

  assert.equal(verified.version, "0.7.0");
  assert.ok(verified.checked.includes(".claude-plugin/plugin.json"));
  assert.ok(verified.checked.includes("distribution/publication-status.json"));
});

test("release verification rejects one stale discovery manifest", async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), "agentwex-release-metadata-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await cp(repositoryRoot, directory, {
    recursive: true,
    filter: (source) => ![".git", ".worktrees", ".superpowers", "node_modules", ".next", ".vinext", ".wrangler", "dist"].includes(source.split("/").at(-1)),
  });
  const claudePath = resolve(directory, ".claude-plugin", "plugin.json");
  const claude = JSON.parse(await readFile(claudePath, "utf8"));
  claude.version = "0.0.0";
  await writeFile(claudePath, `${JSON.stringify(claude, null, 2)}\n`);

  const { verifyReleaseMetadata } = await import("../scripts/release-metadata.mjs");
  await assert.rejects(() => verifyReleaseMetadata(directory), /version drift.*\.claude-plugin\/plugin\.json/i);
});

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
  const [codex, claude, claudeMarket, gemini, geminiContext, skill, pluginSkill, publicSkill, fullContext] = await Promise.all([
    readJson(".agents/plugins/marketplace.json"),
    readJson(".claude-plugin/plugin.json"),
    readJson(".claude-plugin/marketplace.json"),
    readJson("gemini-extension.json"),
    read("GEMINI.md"),
    read("skills/agentwex/SKILL.md"),
    read("openai-plugin/agentwex/skills/agentwex/SKILL.md"),
    read("public/exchange/skill.md"),
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
  for (const source of [geminiContext, skill, pluginSkill, publicSkill, fullContext]) {
    assert.match(source, /(?:repeated|fragile)/i);
    assert.match(source, /(?:expensive|high-cost|costly)/i);
    assert.match(source, /public (?:agent-)?tool/i);
    assert.match(source, /explicit (?:user )?approval/i);
    assert.match(source, /(?:earned credit|credit may be spent|approval before.*credit)/i);
    assert.match(source, /local recall/i);
    assert.match(source, /first-party lab/i);
    assert.match(source, /network(?:-supported| support| evidence)/i);
    assert.match(source, /install(?:ation|s)? (?:does|do) not (?:establish|prove|count as) support/i);
  }
});

test("public discovery reports verified listings separately from prepared packages", async () => {
  const [publication, manifest, agentPage, submission, evals] = await Promise.all([
    readJson("distribution/publication-status.json"),
    readJson("public/exchange/agent.json"),
    read("app/for-agents/page.tsx"),
    read("openai-plugin/SUBMISSION.md"),
    readJson("openai-plugin/discovery-evals.json"),
  ]);

  assert.ok(["prepared", "listed"].includes(publication.channels.npm.status));
  if (publication.channels.npm.status === "listed") {
    assert.match(publication.channels.npm.verificationUrl, /\/agentwex\/v\/0\.7\.0$/);
  }
  for (const channel of ["codex-openai", "claude", "gemini"]) assert.equal(publication.channels[channel].status, "prepared");
  assert.deepEqual(manifest.agentDiscovery.publicationStatus, publication.channels);
  assert.match(agentPage, /VERIFIED LISTING/i);
  assert.match(agentPage, /PREPARED · NOT YET VERIFIED LISTED/i);
  assert.doesNotMatch(agentPage, /DIRECT MARKETPLACE INSTALL|DIRECT EXTENSION INSTALL/);
  assert.match(submission, /prepared discovery package/i);
  const byId = new Map(evals.cases.map((entry) => [entry.id, entry]));
  assert.equal(byId.get("indirect-expensive-first-call")?.expected, "suggest_or_invoke");
  assert.equal(byId.get("direct-offline-local-recall")?.expected, "suggest_or_invoke");
  assert.equal(byId.get("negative-private-debugging")?.expected, "do_not_suggest");
  assert.equal(byId.get("negative-unauthorized-execution")?.expected, "do_not_suggest");
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

test("release smoke covers live metadata, evidence layers, and the complete activation loop", async () => {
  const [productionSmoke, lifecycleSmoke] = await Promise.all([
    read("scripts/smoke-production.mjs"),
    read("scripts/smoke-live-lifecycle.mjs"),
  ]);

  assert.match(productionSmoke, /AGENTWEX_EXPECTED_VERSION/);
  assert.match(productionSmoke, /\/for-agents/);
  assert.match(productionSmoke, /\/coverage/);
  assert.match(productionSmoke, /publicationStatus/);
  assert.match(productionSmoke, /PREPARED · NOT YET VERIFIED LISTED/);
  assert.match(productionSmoke, /Private local recall/);
  assert.match(productionSmoke, /First-party lab reproduction/);
  assert.match(productionSmoke, /Network-supported evidence/);

  assert.match(lifecycleSmoke, /node_install_complete/);
  assert.match(lifecycleSmoke, /ready_passive/);
  assert.match(lifecycleSmoke, /localOutcomeFromReceipt/);
  assert.match(lifecycleSmoke, /runLayeredPreflight/);
  assert.match(lifecycleSmoke, /contribution_accepted/);
  assert.match(lifecycleSmoke, /credit_earned/);
  assert.match(lifecycleSmoke, /route_unlocked/);
  assert.match(lifecycleSmoke, /route_outcome_reported/);
});
