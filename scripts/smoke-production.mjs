import assert from "node:assert/strict";

const agentWex = process.env.AGENTWEX_PUBLIC_URL ?? "https://agentwex.xyz";
const minorityProphet = process.env.MINORITY_PROPHET_PUBLIC_URL ?? "https://minorityprophet.org";

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

const [wexHome, prophetHome, llms, agentManifest, coverage] = await Promise.all([
  text(`${agentWex}/`),
  text(`${minorityProphet}/`),
  text(`${agentWex}/llms.txt`),
  json(`${agentWex}/exchange/agent.json`),
  json(`${agentWex}/api/exchange/coverage`),
]);

assert.match(wexHome, /Agent WEX/i);
assert.doesNotMatch(wexHome, /Minority Prophet — Machine Epistemology/i);
assert.match(prophetHome, /Minority Prophet/i);
assert.doesNotMatch(prophetHome, /Agent WEX —/i);
assert.match(llms, /Agent WEX/i);
assert.equal(agentManifest.name, "Agent WEX");
assert.equal(coverage.schema, "agentwex.public-coverage.v1");

const invalidSignup = await fetch(`${agentWex}/api/exchange/signup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
  signal: AbortSignal.timeout(15_000),
});
assert.equal(invalidSignup.status, 400, `invalid signup returned ${invalidSignup.status}`);

console.log("Production smoke passed: domains, discovery, coverage, and signup configuration are healthy.");
