import assert from "node:assert/strict";

const agentWex = process.env.AGENTWEX_PUBLIC_URL ?? "https://agentwex.xyz";
const minorityProphet = process.env.MINORITY_PROPHET_PUBLIC_URL ?? "https://minorityprophet.org";
const expectedVersion = process.env.AGENTWEX_EXPECTED_VERSION ?? "0.7.0";

async function text(url) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, `${url} returned ${response.status}`);
  return response.text();
}

async function json(url) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, `${url} returned ${response.status}`);
  return response.json();
}

const [wexHome, prophetHome, forAgents, coveragePage, llms, agentManifest, release, coverage] = await Promise.all([
  text(`${agentWex}/`),
  text(`${minorityProphet}/`),
  text(`${agentWex}/for-agents`),
  text(`${agentWex}/coverage`),
  text(`${agentWex}/llms.txt`),
  json(`${agentWex}/exchange/agent.json`),
  json(`${agentWex}/exchange/release.json`),
  json(`${agentWex}/api/exchange/coverage`),
]);

assert.match(wexHome, /Agent WEX/i);
assert.doesNotMatch(wexHome, /Minority Prophet — Machine Epistemology/i);
assert.match(prophetHome, /Minority Prophet/i);
assert.doesNotMatch(prophetHome, /Agent WEX —/i);
assert.match(llms, /Agent WEX/i);
assert.equal(agentManifest.name, "Agent WEX");
assert.equal(agentManifest.distribution.npmVersion, expectedVersion);
assert.equal(release.version, expectedVersion);
assert.match(agentManifest.distribution.npmInstallCommand, new RegExp(`agentwex@${expectedVersion.replaceAll(".", "\\.")}`));
assert.equal(agentManifest.distribution.directPackageSha256, release.sha256);
assert.ok(["prepared", "listed"].includes(agentManifest.agentDiscovery.publicationStatus.npm.status), "npm has invalid publication status");
for (const channel of ["codex-openai", "claude", "gemini"]) {
  const publication = agentManifest.agentDiscovery.publicationStatus[channel];
  assert.ok(["prepared", "validated", "submitted", "listed"].includes(publication.status), `${channel} has invalid publication status`);
  if (publication.status === "listed") {
    assert.match(publication.verificationUrl, /^https:\/\//);
  } else {
    assert.match(forAgents, /(?:PREPARED|VALIDATED|SUBMITTED).*NOT YET VERIFIED LISTED|SUBMITTED · AWAITING VERIFIED LISTING/i);
  }
}
assert.doesNotMatch(forAgents, /DIRECT MARKETPLACE INSTALL|DIRECT EXTENSION INSTALL/);
assert.match(coveragePage, /Private local recall/i);
assert.match(coveragePage, /First-party lab reproduction/i);
assert.match(coveragePage, /Network-supported evidence/i);
assert.match(forAgents, /PREPARED · NOT YET VERIFIED LISTED|SUBMITTED · AWAITING VERIFIED LISTING|VERIFIED LISTING/i);
assert.equal(coverage.schema, "agentwex.public-coverage.v1");

const invalidSignup = await fetch(`${agentWex}/api/exchange/signup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
  signal: AbortSignal.timeout(15_000),
});
const invalidSignupBody = await invalidSignup.json().catch(() => ({}));
if (invalidSignup.status === 429) {
  assert.equal(invalidSignupBody.error, "signup_rate_limit_exceeded");
  assert.match(invalidSignup.headers.get("retry-after") ?? "", /^\d+$/);
} else {
  assert.equal(invalidSignup.status, 400, `invalid signup returned ${invalidSignup.status}`);
  assert.equal(invalidSignupBody.error, "invalid_signup");
}

console.log(`Production smoke passed for Agent WEX ${expectedVersion}: domains, release metadata, discovery status, evidence layers, coverage, and signup boundary are healthy.`);
