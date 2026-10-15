import { getAccount, preflight } from "./client.mjs";
import { readState } from "./config.mjs";
import { assessLocalRecall } from "./local-recall.mjs";

function evidenceFromExchange(assessment, query) {
  const recommendation = assessment?.recommendation ?? {};
  const releasedRoute = assessment?.routeAccess?.routeReceipt?.workingRoute ?? null;
  const labAvailable = recommendation.firstPartyLabAlternativeAvailable === true
    || assessment?.routeQuery?.status === "LAB_RESULT_AVAILABLE"
    || releasedRoute?.supportStatus === "lab-observed";
  const networkAvailable = recommendation.currentRouteSupported === true
    || recommendation.supportedAlternativeAvailable === true
    || assessment?.routeQuery?.status === "RESULT_AVAILABLE"
    || releasedRoute?.supportStatus === "supported";
  return {
    labEvidence: {
      source: "first-party-laboratory",
      available: labAvailable,
      supportStatus: labAvailable ? "lab-observed" : "none",
      distinctParticipants: Number(releasedRoute?.distinctParticipantCount ?? 0),
      distinctControllerGroups: Number(releasedRoute?.distinctControllerGroupCount ?? (labAvailable ? 1 : 0)),
      establishesNetworkSupport: false,
      authorityGranted: false,
    },
    networkEvidence: {
      source: "shared-exchange",
      available: networkAvailable,
      supportStatus: networkAvailable ? "network-supported" : "none",
      distinctControllerGroups: Number(releasedRoute?.distinctControllerGroupCount
        ?? (recommendation.currentRouteSupported ? assessment?.currentRoute?.distinctControllerGroupCount : 0)
        ?? 0),
      minimumDistinctControllerGroups: Number(query.minimumIndependentRoots ?? 2),
      authorityGranted: false,
    },
  };
}

export async function runLayeredPreflight({
  configPath,
  config,
  query,
  remotePreflight = preflight,
  remoteAccount = getAccount,
  evaluatedAt = new Date().toISOString(),
}) {
  let state = null;
  try { state = await readState(configPath); } catch {}
  const localRecall = assessLocalRecall(state?.localOutcomes, query, evaluatedAt);
  const [assessmentResult, accountResult] = await Promise.allSettled([
    remotePreflight(config, query),
    remoteAccount(config),
  ]);
  const exchangeAssessment = assessmentResult.status === "fulfilled" ? assessmentResult.value : null;
  const exchangeStatus = exchangeAssessment ? "available" : "unavailable";
  const { labEvidence, networkEvidence } = exchangeAssessment
    ? evidenceFromExchange(exchangeAssessment, query)
    : evidenceFromExchange(null, query);
  const routeAvailable = exchangeStatus === "available" && (networkEvidence.available || labEvidence.available);
  const supportLevel = networkEvidence.available ? "network-supported" : labEvidence.available ? "lab-observed" : "none";
  const balance = Number(accountResult.status === "fulfilled"
    ? accountResult.value?.creditBalance ?? state?.creditBalance ?? 0
    : state?.creditBalance ?? 0);
  const unlockCost = routeAvailable ? Number(exchangeAssessment?.recommendation?.creditRequiredToUnlock ?? 1) : 0;
  const recommendation = exchangeAssessment?.recommendation ?? {
    action: localRecall.sampleCount > 0 ? "REVIEW_LOCAL_HISTORY" : "NO_EVIDENCE",
    routeDetailsSealed: false,
    creditRequiredToUnlock: 0,
    gateRequired: true,
    authorityGranted: false,
  };

  return {
    schema: "agentwex.layered-preflight-assessment.v0.1",
    evaluatedAt,
    cell: Object.fromEntries(Object.entries(query).filter(([key]) => !["schema", "unlock"].includes(key))),
    exchangeStatus,
    localRecall,
    labEvidence,
    networkEvidence,
    creditUtility: {
      balance,
      unlockCost,
      routeAvailable,
      supportLevel,
      canUnlock: routeAvailable && unlockCost > 0 && balance >= unlockCost,
      transferable: false,
      monetaryValueClaimed: false,
    },
    recommendation,
    ...(exchangeAssessment ? { exchangeAssessment } : {}),
    gateRequired: true,
    authorityGranted: false,
  };
}
