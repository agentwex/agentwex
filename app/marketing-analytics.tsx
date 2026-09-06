"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const agentWexMeasurementId = "G-D91GKT9Y5H";
const consentKey = "agentwex_measurement_consent_v1";

type ConsentChoice = "granted" | "denied";
type EventParameters = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function ensureGoogleTag(choice: ConsentChoice | null) {
  window.dataLayer ||= [];
  window.gtag ||= (...args: unknown[]) => window.dataLayer.push(args);
  window.gtag("consent", "default", {
    analytics_storage: choice === "granted" ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });
  window.gtag("js", new Date());
  window.gtag("config", agentWexMeasurementId, {
    send_page_view: false,
    allow_google_signals: false,
  });

  if (!document.querySelector(`script[data-agentwex-ga4="${agentWexMeasurementId}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${agentWexMeasurementId}`;
    script.dataset.agentwexGa4 = agentWexMeasurementId;
    document.head.appendChild(script);
  }
}

export function trackMarketingEvent(name: string, parameters: EventParameters = {}) {
  if (typeof window === "undefined") return;
  window.gtag?.("event", name, parameters);
}

export default function MarketingAnalytics() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(consentKey);
    const current = stored === "granted" || stored === "denied" ? stored : null;
    ensureGoogleTag(current);
    queueMicrotask(() => {
      setChoice(current);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    trackMarketingEvent("page_view", {
      page_location: window.location.href,
      page_path: `${pathname}${window.location.search}`,
      page_title: document.title,
    });
  }, [pathname, ready]);

  function choose(next: ConsentChoice) {
    window.localStorage.setItem(consentKey, next);
    setChoice(next);
    window.gtag?.("consent", "update", {
      analytics_storage: next,
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    if (next === "granted") {
      trackMarketingEvent("page_view", {
        page_location: window.location.href,
        page_path: `${window.location.pathname}${window.location.search}`,
        page_title: document.title,
      });
    }
  }

  return <>
    {ready && choice === null ? <aside className="awe-consent" aria-label="Analytics preference">
      <p><b>Help us improve AgentWEX.</b> Allow privacy-minimized analytics so we can learn which campaigns lead to useful, verified participation. We do not send prompts, agent output, wallet addresses, or node credentials to analytics. <Link href="/exchange/privacy">Privacy details</Link></p>
      <div>
        <button type="button" onClick={() => choose("denied")}>Essential only</button>
        <button type="button" onClick={() => choose("granted")}>Allow analytics</button>
      </div>
    </aside> : null}
  </>;
}
