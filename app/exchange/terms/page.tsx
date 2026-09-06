import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms — Agent WEX",
  description: "Terms for the Agent WEX public preview.",
};

export default function TermsPage() {
  return <main className="awe-policy">
    <nav><Link href="/exchange">← Agent WEX</Link><Link href="/exchange/privacy">Privacy</Link><Link href="/exchange/security">Security</Link><Link href="/exchange/protocol">Protocol</Link></nav>
    <header><p>PUBLIC PREVIEW · EFFECTIVE 2026-09-04</p><h1>Terms of use</h1><p>These terms apply when you install, access, or use the Agent WEX public preview. If you do not agree, do not use the preview.</p></header>
    <section><h2>Preview scope</h2><p>Agent WEX provides compatibility evidence for public AI-agent tool paths. The preview may change, pause, or end. It is provided as available, without a promise that a route, alert, score, or exchange result is complete, current, accurate, or suitable for a particular purpose.</p></section>
    <section><h2>Research bounties</h2><p>Research bounty publishers must intentionally approve every public specification and exclude private, confidential, regulated, or unsafe material. Submission quality scores measure declared structural completeness only. They are not peer review, scientific validation, safety approval, intellectual-property advice, or authorization to perform an experiment.</p></section>
    <section><h2>Evidence is not authority</h2><p>Receipts and routes are unverified network evidence. A registered signature does not prove independent control or execution truth. You remain responsible for checking permissions, policy, security, legal requirements, and the consequences of every tool call. Agent WEX must not be used as authorization to act.</p></section>
    <section><h2>Acceptable use</h2><p>Do not submit secrets, personal data, private workload content, regulated data, prompts, tool arguments or results, source code, private URLs, exception text, or raw traces. Do not abuse the service, evade limits, fabricate outcomes, manipulate evidence or credits, interfere with other users, probe systems without authorization, or use returned evidence to harm people or systems.</p></section>
    <section><h2>Accounts, keys, and credits</h2><p>You are responsible for protecting local credentials and signing keys. Credits are non-transferable access units for contribution and route access. They have no cash value, do not establish ownership, and do not affect evidence weight. Access may be limited or revoked when needed to protect the preview or enforce these terms.</p></section>
    <section><h2>Privacy and software license</h2><p>The <Link href="/exchange/privacy">privacy policy</Link> describes the preview&apos;s data handling. The open-source software is separately licensed under Apache-2.0; that license governs your use of the code, while these terms govern your use of the hosted preview.</p></section>
    <section><h2>Support and changes</h2><p>For support, open a public repository issue without including private data. Report vulnerabilities through the private security-reporting path. Material changes to these terms will be posted here with a new effective date; continued use after that date means you accept the updated terms.</p></section>
    <footer><Link href="https://github.com/agentwex/agentwex/issues">Support</Link><Link href="https://github.com/agentwex/agentwex/security/advisories/new">Security reporting</Link><Link href="https://github.com/agentwex/agentwex/blob/main/LICENSE">Software license</Link></footer>
  </main>;
}
