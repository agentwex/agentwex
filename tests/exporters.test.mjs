import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { createExporters, exportReceipt, fileExporter, hostedExporter } from "../js/lib/exporters.mjs";

const receipt = {
  schema: "minority-prophet.working-route-comp.v0.1",
  toolRegistry: "mcp",
  toolId: "example/tool",
  toolVersion: "1.0.0",
  clientId: "claude-code",
  clientVersion: "2.1.223",
  environment: "macos-arm64",
  authMode: "none",
  operation: "search",
  outcome: "success",
  errorClass: null,
  resolutionKind: "none",
  routeFingerprint: "sha256:abcdef01",
  observedAt: "2026-08-19T00:00:00.000Z",
  provenanceRootId: "root-1",
  independenceBasis: "declared",
  attestation: { algorithm: "ed25519", keyId: "k1", signature: "sig" },
};

test("a file listener needs no account and no network", async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), "awe-exporter-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = resolve(directory, "nested", "receipts.jsonl");

  const exporter = fileExporter({ path });
  await exporter.export(receipt);
  await exporter.export({ ...receipt, provenanceRootId: "root-2" });

  const lines = (await readFile(path, "utf8")).trim().split("\n");
  assert.equal(lines.length, 2, "one JSON object per line, append-only");
  assert.deepEqual(JSON.parse(lines[0]), receipt, "the listener receives exactly what the exchange would");
  assert.equal(JSON.parse(lines[1]).provenanceRootId, "root-2");
});

test("the file listener writes only the receipt it was given", async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), "awe-exporter-min-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = resolve(directory, "receipts.jsonl");
  await fileExporter({ path }).export(receipt);

  const written = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(Object.keys(written).sort(), Object.keys(receipt).sort(),
    "an exporter adds no fields; minimization already happened upstream");
  const serialized = JSON.stringify(written);
  for (const forbidden of ["prompt", "argument", "credential", "apiKey", "token", "traceId"]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, "i"), `never-send content absent: ${forbidden}`);
  }
});

test("the hosted exchange is the default and remains the primary", () => {
  const single = createExporters({ baseUrl: "https://example.invalid" });
  assert.deepEqual(single.map((exporter) => exporter.name), ["hosted"]);
  assert.equal(single[0].primary, true);
});

test("configuring exporters replaces the default, so a node can emit to a file alone", () => {
  const fileOnly = createExporters({ baseUrl: "https://example.invalid", exporters: [{ type: "file", path: "/tmp/x.jsonl" }] });
  assert.deepEqual(fileOnly.map((exporter) => exporter.name), ["file"]);
  assert.equal(fileOnly[0].primary, false, "a file listener is not a contribution path");
});

test("one emit reaches many listeners", async (context) => {
  const directory = await mkdtemp(resolve(tmpdir(), "awe-exporter-fanout-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = resolve(directory, "receipts.jsonl");
  const stubHosted = { name: "hosted", primary: true, export: async () => ({ status: "accepted", contributionId: "c1" }) };

  const delivered = await exportReceipt([stubHosted, fileExporter({ path })], receipt);
  assert.equal(delivered.primary.contributionId, "c1", "the primary result drives contribution bookkeeping");
  assert.deepEqual(delivered.results.map((entry) => [entry.exporter, entry.ok]), [["hosted", true], ["file", true]]);
  assert.equal((await readFile(path, "utf8")).trim().split("\n").length, 1);
});

test("an unavailable secondary listener does not cost the others their receipt", async () => {
  const broken = { name: "file", primary: false, export: async () => { throw new Error("disk full"); } };
  const stubHosted = { name: "hosted", primary: true, export: async () => ({ status: "accepted", contributionId: "c2" }) };

  const delivered = await exportReceipt([stubHosted, broken], receipt);
  assert.equal(delivered.primary.contributionId, "c2");
  assert.deepEqual(delivered.results.find((entry) => entry.exporter === "file"),
    { exporter: "file", ok: false, error: "disk full" });
});

test("an unknown exporter type is refused rather than ignored", () => {
  assert.throws(() => createExporters({ exporters: [{ type: "carrier-pigeon" }] }), /unknown exporter type/);
  assert.throws(() => fileExporter({}), /requires a path/);
});
