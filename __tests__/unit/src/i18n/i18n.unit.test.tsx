import { en } from "@/src/i18n/en";
import { ptBR } from "@/src/i18n/pt-BR";
import {
  configureLanguageStorage,
  detectDeviceLanguage,
  getLanguage,
  hasTranslation,
  initLanguage,
  resetLanguageForTests,
  setLanguage,
  t,
  tp,
  translate,
  useI18n,
} from "@/src/i18n";
import { describeCommandError, blockedFeedback } from "@/src/features/bluetooth/utils/commandFeedback";
import { describeFault } from "@/src/features/telemetry/telemetryInfo";
import { AckTimeoutError } from "@/src/features/bluetooth/services/TriareCommandService";
import React, { act } from "react";
import { create } from "react-test-renderer";

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

afterEach(() => resetLanguageForTests());

describe("dictionaries", () => {
  const keys = Object.keys(en) as (keyof typeof en)[];

  it("have the same keys in both languages", () => {
    expect(Object.keys(ptBR).sort()).toEqual([...keys].sort());
  });

  it("have no empty strings", () => {
    for (const key of keys) {
      expect(en[key].trim()).not.toBe("");
      expect(ptBR[key].trim()).not.toBe("");
    }
  });

  it("use the same {placeholders} in both languages", () => {
    for (const key of keys) {
      expect({ key, p: placeholders(ptBR[key]) }).toEqual({ key, p: placeholders(en[key]) });
    }
  });

  it("have a plural form for every _one key, and the reverse", () => {
    const ones = keys.filter((k) => k.endsWith("_one")).map((k) => k.slice(0, -4));
    const others = keys.filter((k) => k.endsWith("_other")).map((k) => k.slice(0, -6));
    expect(ones.sort()).toEqual(others.sort());
  });

  it("name every fault code from 1 to 13 in both languages", () => {
    for (let code = 1; code <= 13; code++) {
      expect(hasTranslation(`fault.${code}.name`)).toBe(true);
      expect(hasTranslation(`fault.${code}.hint`)).toBe(true);
    }
  });
});

describe("translate", () => {
  it("fills {placeholders}", () => {
    expect(translate("en", "motor.dutySet", { duty: "0.50" })).toBe("Duty set to 0.50");
    expect(translate("pt-BR", "motor.dutySet", { duty: "0.50" })).toBe("Duty definido em 0.50");
  });

  it("leaves an unknown {placeholder} visible instead of printing undefined", () => {
    expect(translate("en", "motor.dutySet")).toBe("Duty set to {duty}");
  });

  it("picks the singular and plural forms", () => {
    expect(translate("en", "home.devicesFound_one", { count: 1 })).toBe("1 found");
    expect(tp("home.devicesFound", 1)).toBe("1 found");
    setLanguage("pt-BR");
    expect(tp("home.devicesFound", 1)).toBe("1 encontrado");
    expect(tp("home.devicesFound", 3)).toBe("3 encontrados");
    expect(tp("home.devicesFound", 0)).toBe("0 encontrados");
  });

  it("falls back to English, then to the key, for a key missing at run time", () => {
    expect(translate("pt-BR", "does.not.exist" as never)).toBe("does.not.exist");
  });
});

describe("detectDeviceLanguage", () => {
  it.each(["pt-BR", "pt_BR", "pt", "pt-PT", "PT-br"])("maps %s to Portuguese", (tag) => {
    expect(detectDeviceLanguage(tag)).toBe("pt-BR");
  });

  it.each(["en-US", "en_GB", "es-ES", "fr", "", "ptolemy"])("maps %s to English", (tag) => {
    expect(detectDeviceLanguage(tag)).toBe("en");
  });

  it("starts in English when nothing is configured (tests rely on it)", () => {
    expect(getLanguage()).toBe("en");
  });

  it("initLanguage applies the device language", () => {
    expect(initLanguage("pt_BR")).toBe("pt-BR");
    expect(t("tabs.speed")).toBe("Velocidade");
  });
});

describe("language state", () => {
  it("changes what t() returns", () => {
    expect(t("tabs.settings")).toBe("Settings");
    setLanguage("pt-BR");
    expect(t("tabs.settings")).toBe("Ajustes");
  });

  it("re-renders components that use useI18n", () => {
    const seen: string[] = [];
    function Probe() {
      const { t: tr } = useI18n();
      seen.push(tr("speed.enable"));
      return null;
    }
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(React.createElement(Probe));
    });
    act(() => setLanguage("pt-BR"));
    expect(seen[0]).toBe("Enable");
    expect(seen[seen.length - 1]).toBe("Habilitar");
    act(() => renderer.unmount());
  });

  it("saves the choice and loads a saved one", async () => {
    const save = jest.fn();
    await configureLanguageStorage({ load: async () => "pt-BR", save });
    expect(getLanguage()).toBe("pt-BR");
    setLanguage("en");
    expect(save).toHaveBeenCalledWith("en");
  });

  it("ignores a saved value that is not a language, and a failing store", async () => {
    await configureLanguageStorage({
      load: async () => "klingon",
      save: () => {
        throw new Error("disk full");
      },
    });
    expect(getLanguage()).toBe("en");
    expect(() => setLanguage("pt-BR")).not.toThrow();
    expect(getLanguage()).toBe("pt-BR");
  });
});

describe("messages built outside React follow the language", () => {
  it("command feedback", () => {
    expect(blockedFeedback("disarmed")?.title).toBe("System is disarmed");
    setLanguage("pt-BR");
    expect(blockedFeedback("disarmed")?.title).toBe("O sistema está desarmado");
    expect(describeCommandError(new AckTimeoutError(0x10), "enable").title).toBe(
      "Sem resposta da placa",
    );
  });

  it("fault descriptions, including codes without a name", () => {
    setLanguage("pt-BR");
    expect(describeFault(0).name).toBe("Sem falha");
    expect(describeFault(2).name).toBe("Subtensão");
    expect(describeFault(17).name).toBe("Código de falha 17");
  });
});
