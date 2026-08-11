/**
 * TRIARE GATT profile (WBA65 firmware).
 *
 * Source of truth: firmware `p2p_server.h`, mirrored by the reference host
 * script `triare_host_ble.py`. These supersede the old
 * `00000000-...` UUIDs used by the STM32WB0 echo-test board.
 */
export const TRIARE_SERVICE_UUID  = "12345678-1234-5678-1234-56789abcdef0";
/** Write without response (host → device). Carries command frames. */
export const TX_CHAR_UUID         = "12345678-1234-5678-1234-56789abcdef1";
/** Notify (device → host). Carries ACK / data response frames. */
export const RX_CHAR_UUID         = "12345678-1234-5678-1234-56789abcdef2";
/** Read-only. Returns the 8-byte DevEUI. */
export const DEVEUI_CHAR_UUID     = "12345678-1234-5678-1234-56789abcdef3";
export const CCCD_DESCRIPTOR_UUID = "00002902-0000-1000-8000-00805f9b34fb";

export const TRIARE_UUIDS = {
  service: TRIARE_SERVICE_UUID,
  tx:      TX_CHAR_UUID,
  rx:      RX_CHAR_UUID,
  devEui:  DEVEUI_CHAR_UUID,
  cccd:    CCCD_DESCRIPTOR_UUID,
} as const;
