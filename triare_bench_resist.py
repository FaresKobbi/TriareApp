#!/usr/bin/env python3
"""
triare_bench_resist.py — sessão interativa de BANCADA para os modos de fisioterapia.

Fica conectado (ao contrário do triare_host_ble.py, que conecta, manda um comando e sai).
Isso importa: com um modo ativo, perder o link faz o firmware soltar em rampa e DESARMAR.

Uso:
    python triare_bench_resist.py --address 00:80:E1:2C:10:8F
    python triare_bench_resist.py                 # procura TRI-xxxxxx
    python triare_bench_resist.py --log bancada.csv

Comandos (digite `help` na sessão):
    enable | disable | stop | gear <relação>      sistema (use gear 10 para a caixa 10:1)
    zone <idx> <início°> <fim°> <% auxílio> [borda°]   monta rascunho de zona (nada muda ainda)
    commit | clear | get                          publica / limpa / lê as zonas ativas
    mode <0|1>                                    0 = nenhum, 1 = vale de assistência (A)
    rpm <ERPM>                                    cadência-alvo do modo A (em ERPM do motor)
    hold <A> | release                            retenção estática (C) / soltar
    tune <kp_vel> <ki_vel> <kp_pos> <kd_pos>      ajuste de ganhos
    cal                                           zera o ângulo do pedivela na posição atual
    stream on|off                                 telemetria contínua (20 Hz)
    quit

Dependência: pip install bleak
"""
import argparse
import asyncio
import struct
import sys
import time
from typing import Optional

from bleak import BleakClient, BleakScanner

SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0"
CHAR_TX_UUID = "12345678-1234-5678-1234-56789abcdef1"
CHAR_RX_UUID = "12345678-1234-5678-1234-56789abcdef2"

CMD = dict(
    ENABLE=0x10, DISABLE=0x11, SET_RPM=0x12, STOP=0x16, CAL=0x17, GEAR=0x18, STREAM=0x1C,
    RESIST_MODE=0x20, ZONE=0x21, COMMIT=0x22, CLEAR=0x23, HOLD=0x24, RELEASE=0x25, GET=0x26, TUNE=0x27,
)
OP_ACK, OP_STREAM, OP_STATUS, OP_NACK, OP_RESIST_FRAME = 0x14, 0x1D, 0x1E, 0x1F, 0x29
NACK_REASON = {
    1: "NOT_ARMED (arme antes: enable)",
    2: "EMERGENCY (botão B3 / emergência travada)",
    3: "FAULT (VESC em falha)",
    4: "INVALID (valor fora de faixa, ou retenção com relação < 3: use `gear 10`)",
    5: "NO_REGEN_PATH (freio sem caminho de retorno de energia)",
}
MODE = {0: "-", 1: "A", 2: "B", 3: "C"}
PHASE = {0: "ocioso", 1: "ativo", 2: "espera parar", 3: "segurando", 4: "soltando"}
STATUS_BITS = [(0x01, "ARMADO"), (0x02, "EMERGÊNCIA"), (0x04, "ATIVO"), (0x08, "FISIO"), (0x10, "LIMITANDO")]


def f32(v: float) -> bytes:
    return struct.pack("<f", v)


def status_text(b: int) -> str:
    return "|".join(n for m, n in STATUS_BITS if b & m) or "desarmado"


class Bench:
    def __init__(self, client: BleakClient, log_path: Optional[str]):
        self.client = client
        self.responses: asyncio.Queue = asyncio.Queue()
        self.show_stream = False
        self.last_stream = None
        self.last_resist = None
        self.log = open(log_path, "w", encoding="utf-8") if log_path else None
        if self.log:
            self.log.write("t_s,tick_ms,erpm,i_motor,v_in,temp,crank_deg,fault,status,"
                           "i_cmd,assist,mode,phase,limits,thermal_pct\n")
        self.t0 = time.time()

    def on_notify(self, _, data: bytearray):
        p = bytes(data)
        if not p:
            return
        if p[0] == OP_STREAM and len(p) >= 27:
            # [0x1D][u32 tick][rpm][corrente][v_in][temp][ângulo][fault][status]
            self.last_stream = struct.unpack_from("<Ifffff", p, 1) + (p[25], p[26])
            return
        if p[0] == OP_RESIST_FRAME and len(p) >= 20:
            tick, i_cmd, factor = struct.unpack_from("<Iff", p, 1)
            mode, phase, lim = p[13], p[14], p[15]
            thermal = struct.unpack_from("<f", p, 16)[0]
            self.last_resist = (tick, i_cmd, factor, mode, phase, lim, thermal)
            self._emit()
            return
        if p[0] == OP_STATUS and len(p) >= 2:
            print(f"\n[evento] estado: {status_text(p[1])}")
            return
        self.responses.put_nowait(p)

    def _emit(self):
        s, r = self.last_stream, self.last_resist
        if s is None or r is None:
            return
        tick, rpm, cur, vin, temp, ang, fault, status = s
        if self.log:
            self.log.write(f"{time.time()-self.t0:.3f},{tick},{rpm:.1f},{cur:.3f},{vin:.2f},{temp:.1f},{ang:.2f},"
                           f"{fault},{status},{r[1]:.3f},{r[2]:.3f},{r[3]},{r[4]},{r[5]},{r[6]:.1f}\n")
        if self.show_stream:
            flags = ("T" if r[5] & 1 else "") + ("Y" if r[5] & 2 else "") + ("M" if r[5] & 4 else "")
            print(f"\r  pedivela {ang:6.1f}°  ERPM {rpm:7.0f}  I_cmd {r[1]:+6.3f} A  I_motor {cur:+6.3f} A  "
                  f"aux {r[2]*100:3.0f}%  modo {MODE.get(r[3], '?')}/{PHASE.get(r[4], '?'):<12} "
                  f"térmico {r[6]:3.0f}% {flags:<3}", end="", flush=True)

    async def send(self, op: int, payload: bytes = b"", expect_data: bool = False, timeout: float = 3.0):
        while not self.responses.empty():
            self.responses.get_nowait()
        await self.client.write_gatt_char(CHAR_TX_UUID, bytes([op]) + payload, response=False)
        try:
            resp = await asyncio.wait_for(self.responses.get(), timeout)
        except asyncio.TimeoutError:
            print(f"[-] sem resposta ao comando 0x{op:02X} (firmware antigo? link caiu?)")
            return None
        if resp[0] == OP_NACK:
            print(f"[-] RECUSADO (0x{resp[1]:02X}): {NACK_REASON.get(resp[2], resp[2])}")
            return None
        if resp[0] == OP_ACK:
            return resp
        return resp if expect_data else resp

    # ---- comandos ----
    async def cmd(self, line: str) -> bool:
        a = line.split()
        if not a:
            return True
        c, args = a[0].lower(), a[1:]
        try:
            if c in ("quit", "exit", "q"):
                return False
            if c == "help":
                print(__doc__)
            elif c == "enable":
                await self.ok(CMD["ENABLE"], b"", "armado — motor em roda livre")
            elif c == "disable":
                await self.ok(CMD["DISABLE"], b"", "desarmado")
            elif c == "stop":
                await self.ok(CMD["STOP"], b"", "parado (modo ativo solta em rampa)")
            elif c == "cal":
                await self.ok(CMD["CAL"], b"", "ângulo do pedivela zerado aqui")
            elif c == "gear":
                await self.ok(CMD["GEAR"], f32(float(args[0])), f"relação {args[0]} (ângulo zerado)")
            elif c == "zone":
                idx, s, e, pct = int(args[0]), float(args[1]), float(args[2]), float(args[3])
                edge = int(args[4]) if len(args) > 4 else 15
                await self.ok(CMD["ZONE"], bytes([idx]) + f32(s) + f32(e) + bytes([0]) + f32(pct) + bytes([edge]),
                              f"rascunho zona {idx}: {s:g}°→{e:g}°, {pct:g}% de auxílio, borda {edge}° (use `commit`)")
            elif c == "commit":
                await self.ok(CMD["COMMIT"], b"", "zonas publicadas")
            elif c == "clear":
                await self.ok(CMD["CLEAR"], b"", "zonas limpas")
            elif c == "get":
                await self.get_zones()
            elif c == "mode":
                m = int(args[0])
                await self.ok(CMD["RESIST_MODE"], bytes([m]), f"modo {MODE.get(m, m)}")
            elif c == "rpm":
                await self.ok(CMD["SET_RPM"], f32(float(args[0])), f"cadência-alvo {args[0]} ERPM")
            elif c == "hold":
                await self.ok(CMD["HOLD"], f32(float(args[0])),
                              f"retenção pedida: {args[0]} A (espera o pedal parar; `release` solta)")
            elif c == "release":
                await self.ok(CMD["RELEASE"], b"", "soltando em rampa")
            elif c == "tune":
                v = [float(x) for x in args[:4]]
                if len(v) != 4:
                    raise ValueError("faltam valores")
                await self.ok(CMD["TUNE"], b"".join(f32(x) for x in v), "ganhos atualizados")
            elif c == "stream":
                on = args[0].lower() == "on"
                await self.ok(CMD["STREAM"], bytes([1 if on else 0]), "stream " + ("ligado" if on else "desligado"))
                self.show_stream = on
                if not on:
                    print()
            else:
                print("comando desconhecido — digite `help`")
        except (IndexError, ValueError) as ex:
            print(f"[!] argumentos inválidos ({ex}) — digite `help`")
        return True

    async def ok(self, op: int, payload: bytes, msg: str):
        r = await self.send(op, payload)
        if r is not None:
            print(f"[+] {msg}")

    async def get_zones(self):
        while not self.responses.empty():
            self.responses.get_nowait()
        await self.client.write_gatt_char(CHAR_TX_UUID, bytes([CMD["GET"]]), response=False)
        zones, total = [], None
        end = time.time() + 2.0
        while time.time() < end and (total is None or len(zones) < total):
            try:
                p = await asyncio.wait_for(self.responses.get(), 0.5)
            except asyncio.TimeoutError:
                continue
            if p[0] != CMD["GET"]:
                continue
            if p[1] == 0xFF:
                print("(nenhuma zona ativa)")
                return
            idx, total = p[1], p[2]
            s, e = struct.unpack_from("<ff", p, 3)
            val = struct.unpack_from("<f", p, 12)[0]
            zones.append((idx, s, e, p[11], val, p[16]))
        for idx, s, e, typ, val, edge in sorted(zones):
            print(f"  zona {idx}: {s:6.1f}° → {e:6.1f}°  auxílio mantido {val:5.1f}%  borda {edge}°")


async def amain(args):
    if args.address:
        dev = await BleakScanner.find_device_by_address(args.address, timeout=15)
    else:
        pre = (args.name or "TRI-").upper()
        dev = await BleakScanner.find_device_by_filter(lambda d, adv: d.name and d.name.upper().startswith(pre), timeout=15)
    if dev is None:
        raise RuntimeError("dispositivo não encontrado")
    print(f"[ble] {dev.name} ({dev.address})")
    async with BleakClient(dev, timeout=15) as client:
        bench = Bench(client, args.log)
        await client.start_notify(CHAR_RX_UUID, bench.on_notify)
        print("Conectado. Digite `help`. Sequência típica: enable → gear 10 → zone → commit → mode 1 → rpm 400")
        loop = asyncio.get_running_loop()
        try:
            while True:
                line = await loop.run_in_executor(None, lambda: input("triare> "))
                if not await bench.cmd(line):
                    break
        except (EOFError, KeyboardInterrupt):
            pass
        finally:
            try:
                await bench.send(CMD["RELEASE"])   # solta antes de sair
            except Exception:
                pass
            print("\nSaindo (o firmware desarma sozinho ao perder o link).")


def main():
    ap = argparse.ArgumentParser(description="Sessão de bancada dos modos de fisioterapia")
    ap.add_argument("--address", default=None)
    ap.add_argument("--name", default=None)
    ap.add_argument("--log", default=None, help="grava CSV com as telemetrias")
    args = ap.parse_args()
    try:
        asyncio.run(amain(args))
    except Exception as ex:
        print(f"[FAIL] {ex}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
