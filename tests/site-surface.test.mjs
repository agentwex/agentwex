import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the standalone site makes prevention, failure value, and scope explicit", async () => {
  const [page, protocol, llms, skill] = await Promise.all([
    readFile(new URL("../app/exchange/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/exchange/protocol/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/llms.txt", import.meta.url), "utf8"),
    readFile(new URL("../public/exchange/skill.md", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Check before the call/);
  assert.match(page, /npm install -g agentwex@0\.6\.0/);
  assert.match(page, /Aggregate preflight is free/);
  assert.match(page, /Failure pays back/i);
  assert.match(page, /Duplicate retries neither manufacture consensus nor mint more credits/);
  assert.match(page, /unrestricted cross-provider optimization/);
  assert.doesNotMatch(page, /awe contribute|awe ask|awe route apply/);
  assert.match(protocol, /Broader fleet routing/);
  assert.match(llms, /fewer failed calls/i);
  assert.match(skill, /agentwex contributions --limit 25/);
});

test("machine discovery and the downloadable package are aligned", async () => {
  const [manifestSource, releaseSource, archive] = await Promise.all([
    readFile(new URL("../public/exchange/agent.json", import.meta.url), "utf8"),
    readFile(new URL("../public/exchange/release.json", import.meta.url), "utf8"),
    readFile(new URL("../public/exchange/agentwex-0.6.0.tgz", import.meta.url)),
  ]);
  const manifest = JSON.parse(manifestSource);
  const release = JSON.parse(releaseSource);
  const digest = createHash("sha256").update(archive).digest("hex");

  assert.equal(manifest.documentation.source, "https://github.com/agentwex/agentwex");
  assert.equal(manifest.distribution.publicNpmPackageReleased, true);
  assert.equal(manifest.distribution.npmPackage, "agentwex");
  assert.equal(manifest.distribution.npmVersion, "0.6.0");
  assert.match(manifest.distribution.npmInstallCommand, /npm install -g agentwex@0\.6\.0/);
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

  assert.equal(hosting.d1, "DB");
  assert.equal(packageJson.name, "agentwex-repository");
  assert.equal(packageJson.scripts.build.includes("vinext build"), true);
  assert.match(rootSource, /\.\/exchange\/page/);
});
