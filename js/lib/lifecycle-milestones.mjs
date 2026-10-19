export async function emitLifecycleMilestone(state, eventName, send, key = eventName) {
  state.sentMilestones = Array.isArray(state.sentMilestones) ? state.sentMilestones : [];
  if (state.sentMilestones.includes(key)) return false;
  try {
    await send(eventName, {});
    state.sentMilestones.push(key);
    return true;
  } catch {
    return false;
  }
}
