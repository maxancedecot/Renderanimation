// src/lib/klingAuth.ts
// Génère le Bearer JWT pour Kling à partir de KLING_ACCESS_KEY / KLING_SECRET_KEY
// Cache le token jusqu’à ~1 min avant son expiration (30 min par défaut)

import jwt from "jsonwebtoken";

let cachedToken: string | null = null;
let cachedExp = 0; // epoch seconds

export function getKlingToken(): string {
  const ak = process.env.KLING_ACCESS_KEY;
  const sk = process.env.KLING_SECRET_KEY;

  if (!ak || !sk) {
    throw new Error("Env manquantes : KLING_ACCESS_KEY et KLING_SECRET_KEY.");
  }

  const now = Math.floor(Date.now() / 1000);

  // Reutilise le token s'il est encore valide (> 60s de marge)
  if (cachedToken && now < cachedExp - 60) {
    return cachedToken;
  }

  const payload = {
    iss: ak,
    exp: now + 1800, // 30 min
    nbf: now - 5,
  };

  const token = jwt.sign(payload, sk, {
    algorithm: "HS256",
    header: { alg: "HS256", typ: "JWT" },
  });

  cachedToken = token;
  cachedExp = payload.exp;

  return token;
}

// (facultatif) export default aussi pour éviter les soucis d'import
export default getKlingToken;