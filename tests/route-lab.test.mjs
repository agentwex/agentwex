import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../lab/participants.json", import.meta.url), "utf8"));
const runner = await readFile(new URL("../scripts/route-lab.mjs", import.meta.url), "utf8");

test("route lab has three physical participants under one first-party controller", () => {
  assert.equal(manifest.schema, "agentwex.route-lab.participants.v1");
  assert.equal(manifest.controllerGroupId, "agentwex-first-party-lab");
  assert.equal(manifest.participants.length, 3);
  assert.equal(new Set(manifest.participants.map((entry) => entry.participantId)).size, 3);
  assert.ok(manifest.participants.every((entry) => entry.runtimes.includes("codex") && entry.runtimes.includes("claude-code")));
});

test("route lab runner is allowlisted and cannot execute caller-supplied commands", () => {
  assert.deepEqual(manifest.canaries, [
    "npm-agentwex-install", "npm-registry-metadata", "github-repository-read",
  ]);
  assert.match(runner, /const canaries =/);
  assert.match(runner, /execFileAsync\("npm", \[/);
  assert.doesNotMatch(runner, /exec\(|spawn\(.*shell:\s*true|child_process.*exec[^F]/);
});
