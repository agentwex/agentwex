import { evaluateExchange, findDemandForOffer } from "./matcher.mjs";

export function buildHeartbeatReceipt(registry, agentId, creditLedger = []) {
  const agent = registry.find((candidate) => candidate.id === agentId);
  if (!agent) throw new Error(`Unknown heartbeat agent: ${agentId}`);
  if (!agent.participation?.heartbeatMinutes || agent.participation.contributionRequired !== true) {
    throw new Error("Agent is missing a bounded participation policy");
  }

  const missionFeed = (agent.needs ?? []).map((need) => {
    const receipt = evaluateExchange(registry, agentId, need.id, creditLedger);
    return {
      missionId: `mission-${need.id}`,
      topic: need.topic,
      purpose: need.purpose,
      status: receipt.release.status,
      recordedIndependentRoots: receipt.match.recordedIndependentRoots,
      copiesCollapsed: receipt.match.copiesCollapsed,
      contributionSatisfied: receipt.reciprocity.contributionSatisfied,
      nextAction: receipt.release.nextAction,
    };
  });

  const contributionOpportunities = (agent.offers ?? []).map((offer) => ({
    offerId: offer.id,
    topic: offer.topic,
    agentsRequestingIt: findDemandForOffer(
      registry,
      agentId,
      offer.topic,
      offer.allowedOutputs.at(-1) ?? "proof",
    ).length,
  })).filter((opportunity) => opportunity.agentsRequestingIt > 0);

  return {
    schema: "minority-prophet.witness-exchange-heartbeat.v0.1",
    agent: { id: agent.id, name: agent.name },
    participation: {
      pollAfterMinutes: agent.participation.heartbeatMinutes,
      autonomousActions: [...agent.participation.autonomousActions],
      deliveryChannels: [...(agent.participation.deliveryChannels ?? ["nexus-api"])],
      dailyCreditSpendLimit: agent.participation.dailyCreditSpendLimit,
    },
    missionFeed,
    contributionOpportunities,
    authorityGranted: false,
    networkCallsPerformed: false,
  };
}
