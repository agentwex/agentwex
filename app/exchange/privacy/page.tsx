import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy — Agent WEX", description: "What the Agent WEX public preview collects, excludes, retains, and deletes." };

export default function PrivacyPage() {
  return <main className="awe-policy">
    <nav><Link href="/exchange">← Agent WEX</Link><Link href="/exchange/security">Security</Link><Link href="/exchange/protocol">Protocol</Link></nav>
    <header><p>PUBLIC PREVIEW · EFFECTIVE 2026-08-16</p><h1>Privacy boundary</h1><p>Agent WEX is designed to receive compatibility metadata, not work content. Do not connect sensitive or regulated workloads during the public preview.</p></header>
    <section><h2>What leaves the node</h2><p>A pseudonymous node ID; public tool and client identifiers and versions; coarse environment and authentication classes; operation category; success or failure; low-cardinality error and resolution categories; observation time; opaque route and provenance fingerprints; and a signature. Optional post-route feedback is bounded to an outcome, a failure class, and numeric estimates of attempts, tokens, or latency avoided.</p></section>
    <section><h2>What is intentionally excluded</h2><p>Prompts, messages, tool arguments, tool results, credentials, source code, customer content, private URLs, exception text, raw spans, and raw trace identifiers. The local minimizer discards these fields before submission.</p></section>
    <section><h2>Why and how long</h2><p>The exchange uses minimized records to deduplicate signed-node support, measure exact-cell reliability, detect possible regressions, match compatible routes, prevent credit replay, and maintain an auditable ledger. Optional savings estimates are self-reported product feedback, never billing or credit inputs. Accepted receipts and ledger entries are retained while the preview operates because deleting them could make prior balances or route support misleading. Rate-limit records expire with their short control window. Raw IP addresses are not stored; signup limits use a salted one-way fingerprint.</p></section>
    <section><h2>Deactivate and uninstall</h2><p><code>agentwex uninstall --yes</code> stops collection, removes Agent WEX runtime settings, revokes signing keys, invalidates the API key, and pseudonymizes the account. The account row is marked for purge after 30 days; integrity records may remain under the pseudonymous node ID. Backups are retained locally so uninstall does not destroy pre-existing settings.</p></section>
    <section><h2>Your choices</h2><p>Participation is optional. Inspect the service with <code>agentwex status</code>, your balance with <code>agentwex credits</code>, and the minimized records attributed to your node with <code>agentwex contributions</code>. Rotate credentials with <code>agentwex rotate-keys</code> or uninstall at any time. For a privacy issue, open a repository issue without including private data; for a vulnerability, use the private security-reporting path.</p></section>
    <footer><Link href="https://github.com/agentwex/agentwex/issues">Privacy issue</Link><Link href="/exchange/security">Security reporting</Link></footer>
  </main>;
}
