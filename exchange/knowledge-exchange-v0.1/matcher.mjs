const outputOrder = ["proof", "aggregate", "derived", "raw"];

const byId = (items, id) => items.find((item) => item.id === id);

export function evaluateExchange(registry, requesterId, needId, creditLedger = []) {
  const requester = byId(registry, requesterId);
  if (!requester) throw new Error(`Unknown requester: ${requesterId}`);
  const need = byId(requester.needs ?? [], needId);
  if (!need) throw new Error(`Unknown need: ${needId}`);

  const candidates = registry.flatMap((agent) => agent.id === requesterId ? [] : (agent.offers ?? []).map((offer) => ({ agent, offer })))
    .filter(({ offer }) => offer.topic === need.topic)
    .filter(({ offer }) => offer.allowedPurposes.includes(need.purpose))
    .filter(({ offer }) => offer.allowedOutputs.includes(need.requestedOutput));

  const roots = new Map();
  for (const candidate of candidates) {
    const root = candidate.offer.provenanceRootId;
    if (!roots.has(root)) roots.set(root, candidate);
  }

  const independentRoots = [...roots.values()].filter(({ offer }) => offer.independenceBasis !== "unknown");
  const acceptedContributions = creditLedger.filter((entry) => entry.agentId === requesterId && entry.status === "accepted");
  const earnedCredits = acceptedContributions.reduce((total, entry) => total + entry.credits, 0);
  const spentCredits = acceptedContributions.reduce((total, entry) => total + (entry.spentCredits ?? 0), 0);
  const availableCredits = Math.max(0, earnedCredits - spentCredits);
  const resultCostCredits = 1;
  const contributionSatisfied = availableCredits >= resultCostCredits;
  const minimumCohort = candidates.length ? Math.max(...candidates.map(({ offer }) => offer.minimumCohort)) : 0;
  const cohortSatisfied = candidates.length >= minimumCohort;
  const rootsSatisfied = independentRoots.length >= need.minimumIndependentRoots;
  const status = candidates.length === 0
    ? "OPEN_REQUEST"
    : !contributionSatisfied
      ? "CONTRIBUTION_REQUIRED"
      : cohortSatisfied && rootsSatisfied
      ? "READY_FOR_BOUND_AUTHORIZATION"
      : "REQUEST_MORE_EVIDENCE";

  return {
    schema: "minority-prophet.knowledge-exchange-receipt.v0.1",
    requester: { id: requester.id, name: requester.name },
    need: {
      id: need.id,
      topic: need.topic,
      label: need.label,
      purpose: need.purpose,
      requestedOutput: need.requestedOutput,
    },
    match: {
      compatibleContributions: candidates.length,
      recordedIndependentRoots: independentRoots.length,
      copiesCollapsed: candidates.length - roots.size,
      minimumIndependentRoots: need.minimumIndependentRoots,
      minimumCohort,
      cohortSatisfied,
      rootsSatisfied,
    },
    reciprocity: {
      policy: "GIVE_TO_GET",
      contributionRequired: true,
      acceptedContributions: acceptedContributions.length,
      earnedCredits,
      spentCredits,
      availableCredits,
      resultCostCredits,
      contributionSatisfied,
      note: contributionSatisfied
        ? "An accepted, independently additive contribution earned access to this result."
        : "Discovery remains visible, but the result stays sealed until the requester contributes accepted evidence.",
    },
    release: {
      status,
      output: status === "READY_FOR_BOUND_AUTHORIZATION" ? need.requestedOutput : null,
      rawDataTransferred: false,
      authorityGranted: false,
      nextAction: status === "READY_FOR_BOUND_AUTHORIZATION"
        ? "Send the exact exchange to Border and Gate for participant authorization."
        : status === "CONTRIBUTION_REQUIRED"
          ? "Accept an independently additive contribution from the requester before revealing the result."
        : status === "REQUEST_MORE_EVIDENCE"
          ? "Keep the request open and seek another compatible evidence root."
          : "Keep the request open until a compatible contributor appears.",
    },
    evidenceFamilies: contributionSatisfied ? [...roots.entries()].map(([rootId, { agent, offer }]) => ({
      rootId,
      contributor: agent.name,
      basis: offer.independenceBasis,
      freshnessDays: offer.freshnessDays,
      eligibleCredit: offer.independenceBasis === "unknown" ? 0 : offer.freshnessDays <= 30 ? 2 : 1,
    })) : [],
  };
}

export function findDemandForOffer(registry, contributorId, topic, output) {
  return registry.flatMap((agent) => agent.id === contributorId ? [] : (agent.needs ?? []).map((need) => ({ agent, need })))
    .filter(({ need }) => need.topic === topic)
    .filter(({ need }) => outputOrder.indexOf(output) >= outputOrder.indexOf(need.requestedOutput));
}

export const sampleRegistry = [
  {
    id: "atlas-agent",
    name: "Scout 17",
    controller: "principal-atlas",
    participation: { heartbeatMinutes: 15, autonomousActions: ["discover", "post-mission", "back-mission", "contribute", "collect-receipt"], deliveryChannels: ["nexus-api", "moltbook", "agentmail"], contributionRequired: true, dailyCreditSpendLimit: 10 },
    offers: [{ id: "offer-atlas-1", recordKind: "observation", topic: "aisle-obstructions", label: "Aisle obstruction observations", provenanceRootId: "scout-17-camera-run-842", independenceBasis: "attested", allowedPurposes: ["route-safety", "maintenance"], allowedOutputs: ["proof", "aggregate"], freshnessDays: 1, minimumCohort: 3 }],
    needs: [{ id: "need-atlas-1", topic: "floor-friction", label: "Floor friction map", purpose: "route-safety", requestedOutput: "aggregate", minimumIndependentRoots: 2 }],
  },
  {
    id: "broker-east",
    name: "Maintenance Rover East",
    controller: "principal-broker-east",
    participation: { heartbeatMinutes: 30, autonomousActions: ["discover", "back-mission", "contribute", "collect-receipt"], deliveryChannels: ["nexus-api"], contributionRequired: true, dailyCreditSpendLimit: 6 },
    offers: [{ id: "offer-east-1", recordKind: "measurement", topic: "floor-friction", label: "Wheel-slip observations", provenanceRootId: "rover-east-slip-run-118", independenceBasis: "attested", allowedPurposes: ["route-safety"], allowedOutputs: ["proof", "aggregate"], freshnessDays: 2, minimumCohort: 3 }],
    needs: [{ id: "need-east-1", topic: "aisle-obstructions", label: "Aisle obstruction map", purpose: "route-safety", requestedOutput: "aggregate", minimumIndependentRoots: 2 }],
  },
  {
    id: "appraiser-west",
    name: "Pallet Mover West",
    controller: "principal-appraiser-west",
    participation: { heartbeatMinutes: 30, autonomousActions: ["discover", "back-mission", "contribute", "collect-receipt"], deliveryChannels: ["nexus-api", "agentmail"], contributionRequired: true, dailyCreditSpendLimit: 6 },
    offers: [{ id: "offer-west-1", recordKind: "measurement", topic: "floor-friction", label: "Traction observations", provenanceRootId: "mover-west-traction-run-51", independenceBasis: "declared", allowedPurposes: ["route-safety", "maintenance"], allowedOutputs: ["proof", "aggregate"], freshnessDays: 4, minimumCohort: 3 }],
    needs: [{ id: "need-west-1", topic: "aisle-obstructions", label: "Occlusion-safe route", purpose: "maintenance", requestedOutput: "aggregate", minimumIndependentRoots: 2 }],
  },
  {
    id: "syndicated-analyst",
    name: "Fleet Relay",
    controller: "principal-syndicated",
    participation: { heartbeatMinutes: 60, autonomousActions: ["discover", "contribute"], deliveryChannels: ["nexus-api"], contributionRequired: true, dailyCreditSpendLimit: 2 },
    offers: [{ id: "offer-syndicated-1", recordKind: "observation", topic: "floor-friction", label: "Relayed wheel-slip summary", provenanceRootId: "rover-east-slip-run-118", independenceBasis: "declared", allowedPurposes: ["route-safety"], allowedOutputs: ["proof", "aggregate"], freshnessDays: 1, minimumCohort: 3 }],
    needs: [],
  },
  {
    id: "operator-central",
    name: "Cleaning Robot Central",
    controller: "principal-operator-central",
    participation: { heartbeatMinutes: 15, autonomousActions: ["discover", "post-mission", "back-mission", "contribute", "collect-receipt"], deliveryChannels: ["nexus-api", "agentmail"], contributionRequired: true, dailyCreditSpendLimit: 10 },
    offers: [{ id: "offer-central-1", recordKind: "measurement", topic: "floor-friction", label: "Post-cleaning friction scan", provenanceRootId: "cleaner-central-friction-run-310", independenceBasis: "attested", allowedPurposes: ["route-safety", "maintenance"], allowedOutputs: ["proof", "aggregate", "derived"], freshnessDays: 3, minimumCohort: 3 }],
    needs: [{ id: "need-central-1", topic: "aisle-obstructions", label: "Occupied aisle windows", purpose: "route-safety", requestedOutput: "aggregate", minimumIndependentRoots: 2 }],
  },
];

export const sampleCreditLedger = [
  {
    receiptId: "kx-receipt-scout-17-842",
    agentId: "atlas-agent",
    contributionId: "offer-atlas-1",
    status: "accepted",
    credits: 2,
    spentCredits: 0,
  },
];
