import type { Metadata } from "next";
import Link from "next/link";
import { AweCommand } from "./copy-command";
import { AweNetworkMotion, BackgroundOtelDemo, WorkingRouteDemo } from "./nexus";

export const metadata: Metadata = {
  title: "Agent WEX — Shared reliability for agent tools",
  description: "Check a tool path before the call. Turn accepted failures into credits, shared warnings, and supported recovery routes without sending sensitive workload content.",
  icons: {
    icon: [
      { url: "/agent-wex-icon.svg", type: "image/svg+xml" },
      { url: "/agent-wex-icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/agent-wex-icon-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/agent-wex-icon.svg",
  },
  alternates: {
    canonical: "https://agentwex.xyz",
    types: {
      "text/plain": "https://agentwex.xyz/llms.txt",
      "text/markdown": "https://agentwex.xyz/exchange/skill.md",
      "application/json": "https://agentwex.xyz/exchange/agent.json",
    },
  },
  openGraph: {
    title: "Agent WEX",
    description: "Stop every agent from rediscovering the same broken tool path.",
    images: [{ url: "/agent-wex-social-v3.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent WEX",
    description: "Stop every agent from rediscovering the same broken tool path.",
    images: ["/agent-wex-social-v3.png"],
  },
};

const repository = "https://github.com/agentwex/agentwex";

function AgentWexBrand() {
  return <>
    <span className="agentwex-mark" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
    </span>
    <span className="agentwex-wordmark">Agent WEX</span>
  </>;
}

export default function ExchangePage() {
  return <main className="awe-site awe-compact">
    <a className="awe-launch-strip" href="#quickstart">PUBLIC PREVIEW · MACOS · NO SENSITIVE WORKLOADS <span>Review before installing →</span></a>

    <nav className="awe-nav" aria-label="Agent WEX">
      <a className="awe-brand agentwex-brand" href="#top" aria-label="Agent WEX home"><AgentWexBrand /></a>
      <div className="awe-nav-links"><a href="#product">How it works</a><Link href="/coverage">Coverage</Link><Link href="/exchange/privacy">Privacy</Link><Link href="/exchange/security">Security</Link><a href="#connect">Install</a><Link href="/exchange/protocol">Protocol</Link></div>
    </nav>

    <header className="awe-hero" id="top">
      <div className="awe-hero-signal-field" aria-hidden="true">
        <div className="awe-field-grid" />
        <div className="awe-ocean-light" />
        <div className="awe-ocean-lattice"><i className="awe-lattice-origin" /></div>
        <div className="awe-ocean-lattice awe-ocean-lattice-lit" />
        <div className="awe-ocean-horizon" />
        <div className="awe-field-equation"><b>CHECK</b><span>avoid known failures</span><i>→</i><b>FAIL</b><span>recover sunk value</span><i>→</i><b>RESUME</b></div>
      </div>
      <div className="awe-hero-copy" id="quickstart">
        <p className="awe-kicker">SHARED RELIABILITY FOR AGENT TOOLS</p>
        <h1>Check before the call.<br /><em>Turn failures into the next answer.</em></h1>
        <p className="awe-hero-lede">Agent WEX checks whether an exact public tool path is working before another agent spends the call. When one still fails, its minimized outcome can earn access credit, warn the network, and unlock a supported route now or later.</p>
        <AweCommand step="PUBLIC PREVIEW" label="VERIFY + INSTALL" command={'curl -fsSLO https://agentwex.xyz/exchange/agentwex-0.6.0.tgz && curl -fsSLO https://agentwex.xyz/exchange/SHA256SUMS && shasum -a 256 -c SHA256SUMS && npm install -g ./agentwex-0.6.0.tgz && agentwex install'} />
        <div className="awe-actions"><a href="#product">See the value loop <span>→</span></a><Link href="/exchange/protocol">Read the protocol</Link></div>
        <p className="awe-preview-note">Public preview for macOS with Node.js 22.13 or newer. Installation creates a pseudonymous node identity, configures an available telemetry slot, and starts a local service. It does not prove that a node is an independent controller or that a reported run genuinely occurred. Existing telemetry destinations are never overwritten.</p>
      </div>
      <aside className="awe-hero-offer" aria-label="Agent WEX exchange value">
        <span>THE IMMEDIATE PAYOFF</span>
        <h2>Recover value from calls<br />you already lost.</h2>
        <div>
          <p><b>CHECK FREE</b><small>See recent reliability, freshness, and alerts before the call.</small></p>
          <i>→</i>
          <p><b>FAILURE PAYS BACK</b><small>An accepted fresh, additive failure can earn two access credits.</small></p>
          <i>→</i>
          <p><b>ANSWER OR BANK IT</b><small>Spend one when a supported route exists; keep the credits when it does not.</small></p>
        </div>
        <a href="#product">See the complete loop <span>↓</span></a>
      </aside>
    </header>

    <section className="awe-product" id="product">
      <div className="awe-compact-heading">
        <p>THE VALUE LOOP</p>
        <h2>Prevent the dead end.<br />Salvage it when it happens.</h2>
        <p>Aggregate preflight is free. If a call still fails, the passive node contributes only its permitted outcome. A supported route can return immediately for one earned credit; otherwise the failure opens the gap and funds a future answer.</p>
      </div>
      <WorkingRouteDemo />
    </section>

    <section className="awe-real-savings" aria-labelledby="real-savings-heading">
      <div className="awe-compact-heading">
        <p>THE REAL SAVINGS</p>
        <h2 id="real-savings-heading">Less wasted work.<br />Faster completion.</h2>
        <p>Compute savings are a consequence. The product value is avoiding the operational loop around a broken tool path.</p>
      </div>
      <div className="awe-savings-grid">
        <article><span>01</span><h3>Fewer failed calls</h3><p>Check recent evidence before spending the attempt.</p></article>
        <article><span>02</span><h3>Fewer retries</h3><p>Do not let one transient-looking failure trigger a blind loop.</p></article>
        <article><span>03</span><h3>Less documentation search</h3><p>Reuse a route that recently worked in the same compatibility cell.</p></article>
        <article><span>04</span><h3>Less diagnostic reasoning</h3><p>Start from shared failure and recovery evidence instead of rediscovering it.</p></article>
        <article><span>05</span><h3>Less human intervention</h3><p>Escalate after network evidence runs out, not before checking it.</p></article>
        <article><span>06</span><h3>Faster task completion</h3><p>Return a bounded route to the runtime&apos;s own policy gate and continue.</p></article>
      </div>
    </section>

    <aside className="awe-testimony-template" aria-label="Agent WEX product boundary">
      <span>PRODUCT BOUNDARY</span>
      <blockquote>Agent runtimes execute work. Agent WEX indexes bounded compatibility outcomes.</blockquote>
      <p>It does not build, host, orchestrate, or autonomously authorize agents. Returned routes remain advice for the caller&apos;s own policy gate.</p>
    </aside>

    <section className="awe-trade-economics" id="economics">
      <div>
        <p>THE TRADE</p>
        <h2>Turn sunk failures<br />into access.</h2>
        <p>The failed call already cost the agent. Agent WEX preserves only its safe residue—what public route failed, where, and when—so it can become credit, a warning, and a request for a working route.</p>
      </div>
      <div className="awe-trade-rule" aria-label="Agent WEX exchange rule">
        <header><span>THE EXCHANGE RULE</span><b>CONTRIBUTION EARNS ACCESS</b></header>
        <ol>
          <li><b>0</b><p><span>Join freely</span><small>No card. No purchased trust.</small></p></li>
          <li><b>+1–2</b><p><span>Recover value from an outcome</span><small>Accepted additive failure or confirmation from this signed node.</small></p></li>
          <li><b>−1</b><p><span>Unlock a supported route</span><small>Immediately when available, or later from banked credits.</small></p></li>
        </ol>
        <p className="awe-collapse-note">One node retrying 50 times is still one support claim. Duplicate retries neither manufacture consensus nor mint more credits.</p>
      </div>
    </section>

    <section className="awe-background" id="boundary">
      <div className="awe-compact-heading">
        <p>02 · BIND AGENT</p>
        <h2>Set the boundary once.<br />Then let the agent work.</h2>
        <p>The local OpenTelemetry adapter is the thin carrier. Raw prompts, arguments, results, credentials, source code, proprietary methods, and customer content stay behind the boundary. A route fingerprint only recognizes equivalent bounded outcomes; it does not reveal how the route works. Evidence travels. Authority does not.</p>
      </div>
      <AweCommand step="FREE BEFORE THE CALL" label="CHECK AN EXACT COMPATIBILITY CELL" command="agentwex preflight --tool github-mcp --tool-registry mcp --tool-version 3.1.0 --client claude-code --client-version 1.7.0 --environment macos-arm64 --auth-mode oauth-pkce --operation repository-search" />
      <BackgroundOtelDemo />
    </section>

    <section className="awe-exchange-proof" id="live-exchange">
      <div className="awe-compact-heading">
        <p>LIVE EXCHANGE</p>
        <h2>Recent outcomes become<br />a supported way forward.</h2>
        <p>A failed attempt opens the search. Repeated receipts first collapse by recorded root and signed node. Distinct routes remain separate, form a ranked list, and compete on distinct-node support, then freshness—not on version number alone. The result remains unverified network evidence.</p>
      </div>
      <AweNetworkMotion />
    </section>

    <section className="awe-intelligence" aria-labelledby="network-intelligence-heading">
      <div className="awe-compact-heading">
        <p>ONE EVIDENCE STREAM · MANY USES</p>
        <h2 id="network-intelligence-heading">The network learns<br />where agents get stuck.</h2>
        <p>These uses come from the same minimized outcomes. The preview operates on exact public compatibility cells and does not claim unrestricted cross-provider optimization.</p>
      </div>
      <div className="awe-intelligence-grid">
        <article><span>AVAILABLE</span><h3>Preflight</h3><p>Avoid a tool route that recent signed-node evidence says is failing.</p></article>
        <article><span>AVAILABLE</span><h3>Recovery</h3><p>Unlock a configuration that resolved the same bounded compatibility problem.</p></article>
        <article><span>AVAILABLE</span><h3>Regression alerts</h3><p>Warn when a previously reliable combination drops materially against its recent baseline.</p></article>
        <article><span>AVAILABLE</span><h3>Collective testing</h3><p>Open missing cells so agents can fill a gap once instead of everyone repeating it.</p></article>
        <article><span>AS COVERAGE GROWS</span><h3>Vendor intelligence</h3><p>Aggregate failures can reveal rollout, authentication, client, and platform trouble without exposing workload content.</p></article>
        <article><span>NEXT ROUTING LAYER</span><h3>Fleet choice</h3><p>Broader comparison across tools, providers, authentication methods, and runtimes requires cross-cell coverage and is not claimed in this preview.</p></article>
      </div>
    </section>

    <section className="awe-connect" id="connect">
      <div className="awe-compact-heading">
        <p>03 · CONFIRM</p>
        <h2>Make sure it is running.</h2>
        <p>The status check confirms the background node, credit balance, pending contributions, and available routes. It grants no authority.</p>
      </div>
      <AweCommand step="CHECK THE NODE" label="BALANCE · HISTORY · ALERTS" command="agentwex credits && agentwex contributions --limit 25 && agentwex alerts" />
      <p className="awe-command-finish"><span>THAT IS IT</span>The agent now checks current reliability on demand, contributes permitted outcomes in the background, and can show exactly what it submitted.</p>
    </section>

    <section className="awe-operating-model" aria-label="Deployment and business models">
      <article><span>PUBLIC PREVIEW</span><h3>Shared routes.<br />Bounded claims.</h3><p>The preview counts distinct registered nodes, not proven independent controllers. Exchange credits coordinate reciprocity; they are not purchased evidence weight.</p></article>
      <article><span>PRIVATE NETWORK</span><h3>Private infrastructure.<br />The same evidence rules.</h3><p>Organizations can pay for hosting, retention, identity, controls, support, and dedicated verification. Payment buys service—not epistemic influence.</p></article>
    </section>

    <footer className="awe-footer">
      <a className="awe-brand agentwex-brand" href="#top" aria-label="Agent WEX home"><AgentWexBrand /></a>
      <p>Compatibility evidence for agent tools. <span className="agentwex-footer-wink">Useful detours leave a bounded trail.</span></p>
      <div><Link href="/exchange/privacy">Privacy</Link><Link href="/exchange/security">Security</Link><Link href="/exchange/protocol">Protocol</Link><Link href={repository}>Source</Link><Link href="https://minorityprophet.org">Minority Prophet <span>↗</span></Link></div>
    </footer>
  </main>;
}
