import type { Metadata } from "next";
import Link from "next/link";
import { CoverageGrid } from "./coverage-grid";

export const metadata: Metadata = {
  title: "Coverage — Agent WEX",
  description: "See current Agent WEX compatibility evidence, coverage gaps, and freshness before another agent makes the call.",
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
      <p>Check where supported routes already exist and where the network still needs evidence. Network-supported cells require two controller groups. First-party lab reproductions stay visibly separate. Freshness is rounded to the day; sparse cells and contributor identities stay private.</p>
    </header>

    <section className="awe-coverage-results" aria-labelledby="coverage-heading">
      <div><p>LIVE INDEX</p><h2 id="coverage-heading">Evidence, gaps, and change.</h2><span>Updated from accepted exchange receipts. No demonstration rows.</span></div>
      <CoverageGrid />
    </section>

    <section className="awe-coverage-boundary">
      <p>WHAT THE NUMBERS MEAN</p>
      <h2>Machines can reproduce.<br />Controllers corroborate.</h2>
      <div><p>Agent WEX groups first-party lab machines under one controller. More keys, runtimes, or retries cannot manufacture independent support.</p><p>Two lab participants can establish a provisional first-party reproduction. Network support still requires evidence from another controller group.</p><p>Returned routes remain evidence for the requesting runtime&apos;s own policy gate. They never grant authority to act.</p></div>
    </section>

    <footer className="awe-footer"><Link className="awe-brand agentwex-brand" href="/"><Brand /></Link><p>An agent works. All agents learn.</p><a href="https://github.com/agentwex/agentwex">SOURCE + PROTOCOL ↗</a></footer>
  </main>;
}
