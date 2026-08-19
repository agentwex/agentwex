import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { submitRouteOutcome } from "./client.mjs";

/**
 * Where a signed receipt goes after it is built.
 *
 * The hosted exchange is one listener, not the protocol. A runtime that wants
 * to speak the envelope without an Agent WEX account writes to a file and hands
 * that file to whatever it likes: a verifier, a CI check, its own collector.
 *
 * Every exporter receives the same object the exchange would receive -- already
 * minimized by the receipt constructor and already signed locally. Exporters do
 * not add fields, and cannot: they take a finished receipt.
 *
 * Collapse is deliberately not performed here. It is a property of counting,
 * not of emitting, so it belongs to whoever computes support from a set of
 * receipts. The requirement on that listener is stated in docs/SEMCONV.md and
 * has frozen vectors in conformance/collapse/.
 */

/** The hosted exchange at config.baseUrl. Returns the contribution record. */
export function hostedExporter(config) {
  return {
    name: "hosted",
    primary: true,
    async export(receipt) {
      return submitRouteOutcome(config, receipt);
    },
  };
}

/**
 * Append one JSON object per line. No account, no network, no exchange.
 *
 * JSONL because a receipt stream is append-only and a partial write must not
 * corrupt earlier records.
 */
export function fileExporter({ path }) {
  if (typeof path !== "string" || path.length === 0) {
    throw new TypeError("file exporter requires a path");
  }
  return {
    name: "file",
    primary: false,
    async export(receipt) {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await appendFile(path, `${JSON.stringify(receipt)}\n`, { mode: 0o600 });
      return { status: "written", destination: path };
    },
  };
}

/**
 * Build the exporter list from configuration.
 *
 * Default is the hosted exchange alone, so `agentwex install` is unchanged.
 * Configuring exporters explicitly replaces that default, which is how a node
 * emits to a file and nowhere else.
 */
export function createExporters(config) {
  const declared = Array.isArray(config?.exporters) ? config.exporters : null;
  if (!declared || declared.length === 0) return [hostedExporter(config)];
  return declared.map((entry) => {
    if (entry?.type === "hosted") return hostedExporter(config);
    if (entry?.type === "file") return fileExporter({ path: entry.path });
    throw new TypeError(`unknown exporter type: ${entry?.type}`);
  });
}

/**
 * Send one receipt to every exporter.
 *
 * The primary exporter's result is returned, because contribution bookkeeping
 * depends on it. A secondary exporter that throws is reported and does not
 * prevent delivery to the others: one unavailable listener must not stop the
 * rest, and must not lose the receipt for a listener that is available.
 */
export async function exportReceipt(exporters, receipt) {
  const results = [];
  let primary = null;
  for (const exporter of exporters) {
    try {
      const result = await exporter.export(receipt);
      results.push({ exporter: exporter.name, ok: true, result });
      if (exporter.primary) primary = result;
    } catch (error) {
      if (exporter.primary) throw error;
      results.push({ exporter: exporter.name, ok: false, error: error.message });
    }
  }
  return { primary, results };
}
