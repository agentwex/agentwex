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

    <section className="awe-evidence-layers" aria-labelledby="evidence-layers-heading">
      <div><p>THREE LAYERS · THREE DIFFERENT CLAIMS</p><h2 id="evidence-layers-heading">What this node remembers.<br />What the lab reproduced.<br />What the network supports.</h2></div>
      <div className="awe-evidence-layer-grid">
        <article><span>01 · PRIVATE</span><h3>Private local recall</h3><p>Recent minimized outcomes on this computer can prevent a repeated dead end even when the exchange is offline. They stay local and do not establish shared support.</p></article>
        <article><span>02 · PROVISIONAL</span><h3>First-party lab reproduction</h3><p>Separate lab machines can reproduce a route, but one disclosed controller still counts as one controller. This is useful evidence, not independent network corroboration.</p></article>
        <article><span>03 · SHARED</span><h3>Network-supported evidence</h3><p>A public cell appears supported only after fresh accepted evidence reaches the required distinct-controller threshold. The returned route still needs the caller&apos;s policy gate.</p></article>
      </div>
      <p className="awe-evidence-caveat">An installation does not establish support. More installs, keys, runtimes, or retries under one controller cannot manufacture an independent vote.</p>
    </section>

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
