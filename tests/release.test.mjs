import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the public-preview package has a bound checksum and no dependency or lifecycle surface", async () => {
  const root = new URL("../release/", import.meta.url);
  const release = JSON.parse(await readFile(new URL("release.json", root), "utf8"));
  const manifest = JSON.parse(await readFile(new URL("../docs/agent.json", import.meta.url), "utf8"));
  const bytes = await readFile(new URL(release.filename, root));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const sums = await readFile(new URL("SHA256SUMS", root), "utf8");
  assert.equal(release.package, "agentwex");
  assert.equal(release.version, "0.6.3");
  assert.equal(release.sha256, sha256);
  assert.equal(sums, `${sha256}  ${release.filename}\n`);
  assert.equal(release.dependencies, 0);
  assert.equal(release.lifecycleScripts, false);
  assert.equal(manifest.distribution.sha256, sha256);
  assert.equal(manifest.authorityBoundary.controllerIndependenceVerified, false);
  assert.equal(manifest.authorityBoundary.executionTruthVerified, false);
});

test("npm publishing uses the committed checksummed artifact", async () => {
  const workflow = await readFile(new URL("../.github/workflows/publish-npm.yml", import.meta.url), "utf8");
  assert.match(workflow, /npm publish \.\/release\/agentwex-0\.6\.3\.tgz --access public --provenance/);
  assert.doesNotMatch(workflow, /working-directory:\s*js/);
});
