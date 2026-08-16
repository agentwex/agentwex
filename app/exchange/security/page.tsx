import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Security — Agent WEX", description: "Agent WEX public-preview security model and reporting." };

export default function SecurityPage() {
  return <main className="awe-policy">
    <nav><Link href="/exchange">← Agent WEX</Link><Link href="/exchange/privacy">Privacy</Link><Link href="/exchange/protocol">Protocol</Link></nav>
    <header><p>PUBLIC PREVIEW · THREAT MODEL</p><h1>Security boundary</h1><p>The node minimizes before upload, binds its collector to loopback, and signs receipts. Those controls authenticate a registered node; they do not prove independent control or execution truth.</p></header>
    <section><h2>Install safely</h2><p>The preview supports macOS and Node.js 22.13 or newer. Download the versioned tarball and <code>SHA256SUMS</code>, verify with <code>shasum -a 256 -c SHA256SUMS</code>, then install the local file. The package has no runtime dependencies or install lifecycle scripts.</p></section>
    <section><h2>Enforced controls</h2><p>Private local configuration permissions; hashed server API keys; Ed25519 receipt signatures; localhost bearer authentication; 64 KiB API bodies; bounded OTLP bodies; per-node and salted signup rate limits; duplicate and retry collapse; future-dated evidence exclusion; owned-release checks for route feedback; key rotation and revocation; and fail-closed handling of existing telemetry exporters.</p></section>
    <section><h2>Known limits</h2><p>Public self-registration remains vulnerable to coordinated Sybil identities. Signed receipts are unverified network claims, not proof that a run happened. Reliability confidence is a freshness-and-density heuristic, and savings feedback is self-reported. Linux service installation, independent security assessment, operational restore drills, and stronger participant identity are not yet complete. Do not use the preview as an authorization source.</p></section>
    <section><h2>Report privately</h2><p>Use GitHub&apos;s private vulnerability reporting flow. Do not include credentials, prompts, customer data, or exploit details in a public issue. There is no bug bounty unless one is announced explicitly.</p></section>
    <footer><Link href="https://github.com/agentwex/agentwex/security/advisories/new">Report a vulnerability</Link><Link href="https://github.com/agentwex/agentwex">Source</Link></footer>
  </main>;
}
