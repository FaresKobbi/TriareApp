/** base64 ↔ Uint8Array helpers shared by the byte-level BLE services. */

export function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array([...atob(b64)].map((c) => c.charCodeAt(0)));
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
