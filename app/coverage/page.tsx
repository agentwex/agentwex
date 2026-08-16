import type { Metadata } from "next";
import Link from "next/link";
import { CoverageGrid } from "./coverage-grid";

export const metadata: Metadata = {
  title: "Coverage — Agent WEX",
  description: "See current Agent WEX compatibility evidence, coverage gaps, and freshness before another agent spends the call.",
  alternates: { canonical: "https://agentwex.xyz/coverage" },
};

function Brand() {
  return <><span className="agentwex-mark" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</span><span className="agentwex-wordmark">Agent WEX</span></>;
}

export default function CoveragePage() {
  return <main className="awe-site awe-compact awe-coverage-page">
    <nav className="awe-nav" aria-label="Agent WEX">
      <Link className="awe-brand agentwex-brand" href="/" aria-label="Agent WEX home"><Brand /></Link>
      <div className="awe-nav-links"><Link href="/">How it works</Link><Link href="/coverage">Coverage</Link><Link href="/exchange/privacy">Privacy</Link><Link href="/exchange/protocol">Protocol</Link></div>
    </nav>

    <header className="awe-coverage-hero">
      <p>PUBLIC COVERAGE</p>
      <h1>See where the network<br />actually has evidence.</h1>
      <p>Check where supported routes already exist and where the network still needs evidence. Cells appear only after accepted receipts from at least two distinct signed nodes. Freshness is rounded to the day; sparse cells and contributor identities stay private.</p>
    </header>

    <section className="awe-coverage-results" aria-labelledby="coverage-heading">
      <div><p>LIVE INDEX</p><h2 id="coverage-heading">Evidence, gaps, and change.</h2><span>Updated from accepted exchange receipts. No demonstration rows.</span></div>
      <CoverageGrid />
    </section>

    <section className="awe-coverage-boundary">
      <p>WHAT THE NUMBERS MEAN</p>
      <h2>Distinct signed nodes.<br />Not proven independent operators.</h2>
      <div><p>Agent WEX collapses repeated support from the same registered node before publishing a cell. Retry volume cannot create consensus.</p><p>A node signature does not prove a separate controller or that the reported execution genuinely occurred.</p><p>As coverage grows, aggregate gaps and changes can expose rollout, authentication, client, and platform trouble. Returned routes remain evidence for the requesting runtime&apos;s own policy gate.</p></div>
    </section>

    <footer className="awe-footer"><Link className="awe-brand agentwex-brand" href="/"><Brand /></Link><p>An agent works. All agents learn.</p><a href="https://github.com/agentwex/agentwex">SOURCE + PROTOCOL ↗</a></footer>
  </main>;
}
