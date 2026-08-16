function headers(config, body) {
  return {
    authorization: `Bearer ${config.apiKey}`,
    ...(body ? { "content-type": "application/json" } : {}),
  };
}

async function exchangeRequest(config, path, { method = "GET", body, authenticated = true } = {}) {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: authenticated ? headers(config, body) : (body ? { "content-type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({ error: "invalid_exchange_response" }));
  if (!response.ok) {
    const error = new Error(payload.error ?? `Agent WEX request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function signup(baseUrl, body) {
  return exchangeRequest({ baseUrl }, "/api/exchange/signup", { method: "POST", body, authenticated: false });
}

export const getAccount = (config) => exchangeRequest(config, "/api/exchange/account");
export const getLedger = (config) => exchangeRequest(config, "/api/exchange/ledger");
export const registerSigningKey = (config, signingKey) => exchangeRequest(config, "/api/exchange/signing-keys", { method: "POST", body: signingKey });
export const revokeSigningKey = (config, keyId) => exchangeRequest(config, "/api/exchange/signing-keys/revoke", { method: "POST", body: { keyId } });
export const rotateApiKey = (config) => exchangeRequest(config, "/api/exchange/api-keys/rotate", { method: "POST" });
export const deactivateAccount = (config) => exchangeRequest(config, "/api/exchange/account", { method: "DELETE" });
export const getContribution = (config, id) => exchangeRequest(config, `/api/exchange/contributions/${encodeURIComponent(id)}`);
export const submitRouteOutcome = (config, receipt) => exchangeRequest(config, "/api/exchange/working-route-comps", { method: "POST", body: receipt });
export const createRouteQuery = (config, query) => exchangeRequest(config, "/api/exchange/queries", { method: "POST", body: query });
export const getRouteQuery = (config, id) => exchangeRequest(config, `/api/exchange/queries/${encodeURIComponent(id)}`);
export const unlockRoute = (config, resultId) => exchangeRequest(config, "/api/exchange/unlock", { method: "POST", body: { resultId } });
export const listBounties = (config) => exchangeRequest(config, "/api/exchange/bounties");
