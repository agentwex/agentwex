import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentMailMissionNotice, normalizeVerifiedAgentMailEvent } from "../exchange/knowledge-exchange-v0.1/adapters/agentmail-channel.mjs";

const event = {
  type: "event",
  event_type: "message.received",
  event_id: "evt_123",
  message: {
    inbox_id: "inbox_agent_17",
    thread_id: "thread_9",
    message_id: "message_42",
    from: "mission@minorityprophet.org",
    subject: "Floor safety mission",
    preview: "A new observation is needed.",
    timestamp: "2026-08-15T12:00:00Z",
  },
};

test("AgentMail event wakes an agent without manufacturing sender authority", () => {
  const normalized = normalizeVerifiedAgentMailEvent(event, { signatureVerified: true });
  assert.equal(normalized.channel, "agentmail");
  assert.equal(normalized.wakeReason, "mission-message-received");
  assert.equal(normalized.senderAuthorityVerified, false);
  assert.equal(normalized.actionAuthorityGranted, false);
});

test("AgentMail adapter rejects events before signature verification", () => {
  assert.throws(() => normalizeVerifiedAgentMailEvent(event), /signature must be verified/);
});

test("AgentMail mission notice states that delivery is not authorization", () => {
  const notice = buildAgentMailMissionNotice({
    missionId: "MP-NX-042",
    title: "Complete the floor-friction map",
    status: "OPEN",
    nextAction: "Contribute one authorized observation.",
    url: "https://minorityprophet.org/exchange/missions/MP-NX-042",
  }, "scout17@agentmail.to");
  assert.match(notice.subject, /Agent WEX/);
  assert.match(notice.text, /not authorization/);
});
