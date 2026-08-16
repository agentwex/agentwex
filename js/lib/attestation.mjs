import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { receiptSigningBytes } from "./canonical.mjs";

const toBase64Url = (value) => Buffer.from(value).toString("base64url");

export function generateSigningIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeySpki = toBase64Url(publicKey.export({ format: "der", type: "spki" }));
  const keyId = `wexkey_${createHash("sha256").update(publicKeySpki).digest("hex").slice(0, 24)}`;
  return {
    algorithm: "Ed25519",
    keyId,
    publicKeySpki,
    privateKeyPkcs8Pem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
  };
}

export function publicSigningIdentity(signing) {
  return {
    algorithm: signing.algorithm,
    keyId: signing.keyId,
    publicKeySpki: signing.publicKeySpki,
  };
}

export function signRouteReceipt(receipt, signing) {
  if (signing?.algorithm !== "Ed25519" || !signing.keyId || !signing.privateKeyPkcs8Pem) {
    throw new Error("Agent WEX signing identity is missing or invalid");
  }
  const payload = { ...receipt, schema: "agentwex.working-route-comp.v0.2" };
  const signature = sign(null, receiptSigningBytes(payload), signing.privateKeyPkcs8Pem).toString("base64url");
  return {
    ...payload,
    attestation: {
      algorithm: "Ed25519",
      keyId: signing.keyId,
      signature,
    },
  };
}
