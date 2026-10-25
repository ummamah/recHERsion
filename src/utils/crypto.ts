// ============================================================
// Web Crypto API helpers for PIN security
// ============================================================

/** Generate a random hex salt */
export async function generateSalt(): Promise<string> {
  const buf = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 hash of (salt + pin), returned as hex */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + pin);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Compare a supplied PIN against a stored (salt, hash) pair */
export async function verifyPin(pin: string, salt: string, storedHash: string): Promise<boolean> {
  const hash = await hashPin(pin, salt);
  return hash === storedHash;
}
