import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the standalone site makes prevention, failure value, and scope explicit", async () => {
  const [page, protocol, llms, skill, css] = await Promise.all([
    readFile(new URL("../app/exchange/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/exchange/protocol/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/llms.txt", import.meta.url), "utf8"),
    readFile(new URL("../public/exchange/skill.md", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Check before the call/);
  assert.match(page, /npm install -g agentwex@0\.6\.1/);
  assert.doesNotMatch(page, /className="awe-nav"/);
  assert.match(page, /className="awe-brand agentwex-brand awe-hero-brand"/);
  assert.doesNotMatch(page, /awe-launch-strip/);
  assert.match(page, /<AweCommand id="install"/);
  assert.match(page, /Aggregate preflight is free/);
  assert.match(page, /Failure earns credits/i);
  assert.match(page, /Enterprises can pay for a private implementation/);
  assert.equal((page.match(/\bpay(?:ment)?\b/gi) ?? []).length, 2);
  assert.doesNotMatch([protocol, llms, skill].join("\n"), /\b(?:pay|pays|paid|payment|charge|costs?|spend|spends|spent|purchase|purchased)\b/i);
  assert.match(page, /Duplicate retries neither manufacture consensus nor mint more credits/);
  assert.match(page, /unrestricted cross-provider optimization/);
  assert.doesNotMatch(page, /awe contribute|awe ask|awe route apply/);
  assert.match(protocol, /Broader fleet routing/);
  assert.match(llms, /fewer failed calls/i);
  assert.match(skill, /agentwex contributions --limit 25/);
  assert.match(css, /background-image:radial-gradient\(circle,#7cf0bd38/);
});

test("machine discovery and the downloadable package are aligned", async () => {
  const [manifestSource, releaseSource, archive] = await Promise.all([
    readFile(new URL("../public/exchange/agent.json", import.meta.url), "utf8"),
    readFile(new URL("../public/exchange/release.json", import.meta.url), "utf8"),
    readFile(new URL("../public/exchange/agentwex-0.6.1.tgz", import.meta.url)),
  ]);
  const manifest = JSON.parse(manifestSource);
  const release = JSON.parse(releaseSource);
  const digest = createHash("sha256").update(archive).digest("hex");

  assert.equal(manifest.documentation.source, "https://github.com/agentwex/agentwex");
  assert.equal(manifest.distribution.publicNpmPackageReleased, true);
  assert.equal(manifest.distribution.npmPackage, "agentwex");
  assert.equal(manifest.distribution.npmVersion, "0.6.1");
  assert.match(manifest.distribution.npmInstallCommand, /npm install -g agentwex@0\.6\.1/);
  assert.equal(manifest.preflight.aggregateAssessmentCostCredits, 0);
  assert.equal(manifest.preflight.unrestrictedCrossToolProviderAuthRuntimeRoutingClaimed, false);
  assert.equal(digest, release.sha256);
  assert.equal(digest, manifest.distribution.directPackageSha256);
});

test("Sites ownership lives in the AgentWEX repository", async () => {
  const [hostingSource, packageSource, rootSource] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  const hosting = JSON.parse(hostingSource);
  const packageJson = JSON.parse(packageSource);

  assert.equal(hosting.project_id, "appgprj_6a821aace67c819196db13d04e3bf0d2");
  assert.notEqual(hosting.project_id, "appgprj_6a70fd338b2481919a840dad4631fb78");
  assert.equal(hosting.d1, "DB");
  assert.equal(packageJson.name, "agentwex-repository");
  assert.equal(packageJson.scripts.build.includes("vinext build"), true);
  assert.match(rootSource, /\.\/exchange\/page/);
});

test("the owner console is signed-in, read-only, and explicit about genesis limits", async () => {
  const [page, consoleSource, auth, css] = await Promise.all([
    readFile(new URL("../app/owner/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/owner/owner-console.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/chatgpt-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /requireChatGPTUser\("\/owner"\)/);
  assert.match(auth, /oai-authenticated-user-email/);
  assert.match(consoleSource, /Receipts are not votes/);
  assert.match(consoleSource, /An identity origin—not consciousness/);
  assert.match(consoleSource, /No action authority/);
  assert.match(consoleSource, /AUTO-REFRESH 30S/);
  assert.doesNotMatch(consoleSource, /localStorage|sessionStorage/);
  assert.match(css, /owner-console-page/);
});
