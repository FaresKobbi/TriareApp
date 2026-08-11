#!/usr/bin/env python3
"""
triare_host_ble.py — Triare Host via BLE (substitui triare_host.py para WBA65)

Escaneia um dispositivo TRI-XXXXXX, conecta via BLE e envia os mesmos
comandos do triare_host.py, mas sobre GATT em vez de UART.

Uso:
    python triare_host_ble.py enable
    python triare_host_ble.py disable
    python triare_host_ble.py stop
    python triare_host_ble.py rpm --value 1000
    python triare_host_ble.py duty --value 0.08
    python triare_host_ble.py monitor
    python triare_host_ble.py validate          # GET_DEVEUI + ECHO (como ble_validate.py)

    # Pula o scan — conexão instantânea:
    python triare_host_ble.py enable --address 00:80:E1:2C:10:8F

Dependências:
    pip install bleak matplotlib
"""

import asyncio
import struct
import argparse
import platform
import sys
from typing import Optional

from bleak import BleakClient, BleakScanner

# ---------------------------------------------------------------------------
# UUIDs do serviço Triare (devem bater com p2p_server.h)
# ---------------------------------------------------------------------------
SERVICE_UUID     = "12345678-1234-5678-1234-56789abcdef0"
CHAR_TX_UUID     = "12345678-1234-5678-1234-56789abcdef1"  # Write (host → device)
CHAR_RX_UUID     = "12345678-1234-5678-1234-56789abcdef2"  # Notify (device → host)
CHAR_DEVEUI_UUID = "12345678-1234-5678-1234-56789abcdef3"  # Read (DevEUI)

# ---------------------------------------------------------------------------
# Comandos — infraestrutura (Danilo)
# ---------------------------------------------------------------------------
CMD_GET_DEVEUI    = 0x01
CMD_ECHO          = 0x02

# ---------------------------------------------------------------------------
# Comandos — VESC / Triare (namespace 0x10+)
# ---------------------------------------------------------------------------
CMD_SYSTEM_ENABLE  = 0x10
CMD_SYSTEM_DISABLE = 0x11
CMD_SET_RPM        = 0x12
CMD_REQ_TELEMETRY  = 0x13
CMD_ACK            = 0x14
CMD_SET_DUTY       = 0x15
CMD_STOP           = 0x16

DEFAULT_NAME_PREFIX = "TRI-"
SCAN_TIMEOUT        = 15.0
ACK_TIMEOUT         = 3.0


# ---------------------------------------------------------------------------
# Helpers de scan — para quando encontrar, conecta imediatamente
# ---------------------------------------------------------------------------
async def find_device(name: Optional[str] = None, address: Optional[str] = None):
    if address:
        print(f"[ble]  Conectando diretamente a {address}...")
        device = await BleakScanner.find_device_by_address(address, timeout=SCAN_TIMEOUT)
    else:
        target = name or DEFAULT_NAME_PREFIX
        print(f"[ble]  Buscando dispositivo com prefixo '{target}'...")
        # find_device_by_filter para no instante que encontra — não espera timeout
        device = await BleakScanner.find_device_by_filter(
            lambda d, adv: d.name is not None and d.name.upper().startswith(target.upper()),
            timeout=SCAN_TIMEOUT,
        )

    if device is None:
        raise RuntimeError(f"Dispositivo '{DEFAULT_NAME_PREFIX}XXXXXX' não encontrado.")
    print(f"[ble]  Encontrado: {device.name} ({device.address})")
    return device


async def request_windows_pairing(timeout: float = 20.0) -> None:
    print(f"[pair] Conclua o pareamento no Windows em até {timeout:.0f}s.")
    print("[pair] Pressione Enter após concluir o popup do Windows:")
    await asyncio.wait_for(
        asyncio.to_thread(input, "[pair] Enter: "),
        timeout=timeout,
    )


# ---------------------------------------------------------------------------
# Classe principal de comunicação BLE
# ---------------------------------------------------------------------------
class TriareBLE:
    def __init__(self, device, timeout: float = ACK_TIMEOUT):
        self.device  = device
        self.timeout = timeout
        self.client  = BleakClient(device, timeout=max(timeout, 15.0))
        self._notifications = []
        self._event = asyncio.Event()

    def _on_notify(self, _, data: bytearray):
        payload = bytes(data)
        self._notifications.append(payload)
        self._event.set()

    async def connect(self):
        await self.client.connect()
        await self.client.start_notify(CHAR_RX_UUID, self._on_notify)
        print(f"[ble]  Conectado. Notificações ativas.")

    async def disconnect(self):
        if self.client.is_connected:
            await self.client.stop_notify(CHAR_RX_UUID)
            await self.client.disconnect()

    async def write(self, payload: bytes) -> bytes:
        """Envia Write e aguarda Notify de resposta."""
        self._event.clear()
        await self.client.write_gatt_char(CHAR_TX_UUID, payload, response=False)
        try:
            await asyncio.wait_for(self._event.wait(), timeout=self.timeout)
        except asyncio.TimeoutError:
            raise TimeoutError(f"Sem resposta para CMD 0x{payload[0]:02X}")
        return self._notifications[-1]

    async def read_deveui(self) -> bytes:
        return bytes(await self.client.read_gatt_char(CHAR_DEVEUI_UUID))


# ---------------------------------------------------------------------------
# Ações
# ---------------------------------------------------------------------------
async def action_validate(ble: TriareBLE):
    """Equivale ao ble_validate.py — GET_DEVEUI + ECHO."""
    deveui = await ble.read_deveui()
    print(f"[info] DevEUI : {':'.join(f'{b:02X}' for b in deveui)}")

    resp = await ble.write(bytes([CMD_GET_DEVEUI]))
    if len(resp) >= 9 and resp[0] == CMD_GET_DEVEUI:
        print(f"[info] DevEUI (cmd): {':'.join(f'{b:02X}' for b in resp[1:9])}")
        print("[test] GET_DEVEUI OK")
    else:
        raise RuntimeError(f"Resposta inesperada: {resp.hex()}")

    echo_payload = b"triare-ble"
    resp = await ble.write(bytes([CMD_ECHO]) + echo_payload)
    if resp[0] == CMD_ECHO and resp[1:1+len(echo_payload)] == echo_payload:
        print("[test] ECHO OK")
    else:
        raise RuntimeError(f"Echo falhou: {resp.hex()}")

    print("\n=== Validação PASSED ===")


async def action_enable(ble: TriareBLE):
    resp = await ble.write(bytes([CMD_SYSTEM_ENABLE]))
    if resp[0] == CMD_ACK and resp[1] == CMD_SYSTEM_ENABLE:
        print("[+] SUCESSO! Sistema TRIARE Armado — motor em roda livre.")
    else:
        print(f"[-] FALHA! Resposta: {resp.hex()}")


async def action_disable(ble: TriareBLE):
    resp = await ble.write(bytes([CMD_SYSTEM_DISABLE]))
    if resp[0] == CMD_ACK and resp[1] == CMD_SYSTEM_DISABLE:
        print("[+] SUCESSO! Sistema TRIARE Desarmado.")
    else:
        print(f"[-] FALHA! Resposta: {resp.hex()}")


async def action_stop(ble: TriareBLE):
    resp = await ble.write(bytes([CMD_STOP]))
    if resp[0] == CMD_ACK and resp[1] == CMD_STOP:
        print("[+] SUCESSO! Motor em roda livre — sistema continua ARMADO.")
    else:
        print(f"[-] FALHA! O sistema está em ENABLE?")


async def action_rpm(ble: TriareBLE, value: float):
    payload = bytes([CMD_SET_RPM]) + struct.pack('<f', value)
    resp = await ble.write(payload)
    if resp[0] == CMD_ACK and resp[1] == CMD_SET_RPM:
        print(f"[+] SUCESSO! Modo RPM — alvo: {value:.0f} ERPM")
    else:
        print(f"[-] FALHA! O sistema está em ENABLE? Resposta: {resp.hex()}")


async def action_duty(ble: TriareBLE, value: float):
    if not (-1.0 <= value <= 1.0):
        print(f"[!] ERRO: duty deve estar entre -1.0 e 1.0 (recebido: {value})")
        return
    if value < 0:
        print(f"[!] AVISO: duty negativo — motor girará ao contrário ({value*100:.1f}%)")
    payload = bytes([CMD_SET_DUTY]) + struct.pack('<f', value)
    resp = await ble.write(payload)
    if resp[0] == CMD_ACK and resp[1] == CMD_SET_DUTY:
        direction = "REVERSO" if value < 0 else "NORMAL"
        print(f"[+] SUCESSO! Modo DUTY {direction} — {value:.3f} ({value*100:.1f}%)")
    else:
        print(f"[-] FALHA! O sistema está em ENABLE? Resposta: {resp.hex()}")


async def action_monitor(ble: TriareBLE):
    """Dashboard em tempo real — mesmo visual do triare_host.py."""
    import matplotlib.pyplot as plt
    from collections import deque

    print("Iniciando dashboard BLE (feche a janela para sair)...")

    plt.ion()
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 6))
    fig.canvas.manager.set_window_title("Triare BLE Live Dashboard")

    rpm_y  = deque([0.0] * 100, maxlen=100)
    curr_y = deque([0.0] * 100, maxlen=100)

    line_rpm,  = ax1.plot(rpm_y,  "b-", linewidth=2)
    line_curr, = ax2.plot(curr_y, "r-", linewidth=2)
    ax1.set_ylabel("Motor (ERPM)")
    ax2.set_ylabel("Corrente (A)")
    ax1.grid(True)
    ax2.grid(True)

    RPM_MIN_RANGE  = 300.0
    CURR_MIN_RANGE = 1.0
    MARGIN         = 0.15

    def dynamic_ylim(data, min_range):
        lo, hi = min(data), max(data)
        span = max(hi - lo, min_range)
        pad  = span * MARGIN
        return lo - pad, hi + pad

    try:
        while plt.fignum_exists(fig.number):
            try:
                resp = await asyncio.wait_for(
                    ble.write(bytes([CMD_REQ_TELEMETRY])),
                    timeout=2.0
                )
                if len(resp) >= 18 and resp[0] == CMD_REQ_TELEMETRY:
                    rpm, current, voltage, temp = struct.unpack_from('<ffff', resp, 1)
                    fault = resp[17]

                    rpm_y.append(rpm)
                    curr_y.append(current)

                    line_rpm.set_ydata(rpm_y)
                    line_curr.set_ydata(curr_y)
                    ax1.set_ylim(*dynamic_ylim(rpm_y,  RPM_MIN_RANGE))
                    ax2.set_ylim(*dynamic_ylim(curr_y, CURR_MIN_RANGE))
                    ax1.set_title(
                        f"Bateria: {voltage:4.1f}V | "
                        f"Temp FET: {temp:4.1f}°C | "
                        f"Fault: {fault}"
                    )
                    fig.canvas.draw()
                    fig.canvas.flush_events()
            except (TimeoutError, Exception):
                pass

            await asyncio.sleep(0.1)
    except KeyboardInterrupt:
        pass
    finally:
        print("\nMonitoramento encerrado.")
        plt.ioff()
        plt.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
async def main_async(args):
    device = await find_device(getattr(args, "name", None), getattr(args, "address", None))

    # Lê DevEUI para mostrar o PIN (caso precise parear)
    async with BleakClient(device, timeout=15.0) as client:
        try:
            deveui = bytes(await client.read_gatt_char(CHAR_DEVEUI_UUID))
            import binascii
            pin = (binascii.crc32(deveui) & 0xFFFFFFFF) % 1_000_000
            print(f"[info] DevEUI : {':'.join(f'{b:02X}' for b in deveui)}")
            print(f"[info] PIN    : {pin:06d}")
            # Mostra o address para uso futuro com --address
            print(f"[dica] Próxima vez use: --address {device.address}")
        except Exception:
            pass

    if getattr(args, "pair", False) and platform.system() == "Windows":
        await request_windows_pairing()
        device = await find_device(
            getattr(args, "name", None),
            getattr(args, "address", None),
        )

    ble = TriareBLE(device)
    await ble.connect()

    try:
        if   args.action == "validate": await action_validate(ble)
        elif args.action == "enable":   await action_enable(ble)
        elif args.action == "disable":  await action_disable(ble)
        elif args.action == "stop":     await action_stop(ble)
        elif args.action == "rpm":      await action_rpm(ble, args.value)
        elif args.action == "duty":     await action_duty(ble, args.value)
        elif args.action == "monitor":  await action_monitor(ble)
    finally:
        await ble.disconnect()


def main():
    parser = argparse.ArgumentParser(
        description="Triare Host via BLE — substitui triare_host.py para WBA65"
    )
    parser.add_argument(
        "action",
        choices=["validate", "enable", "disable", "stop", "rpm", "duty", "monitor"],
        help="Comando a enviar"
    )
    parser.add_argument("--value",   type=float, default=0.0,
                        help="Valor do RPM ou duty cycle")
    parser.add_argument("--name",    default=None,
                        help="Prefixo do nome BLE (padrão: TRI-)")
    parser.add_argument("--address", default=None,
                        help="MAC address — pula o scan completamente")
    parser.add_argument("--pair",    action="store_true",
                        help="Inicia pareamento Windows antes de conectar")

    args = parser.parse_args()

    try:
        asyncio.run(main_async(args))
    except Exception as e:
        print(f"\n[FAIL] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()