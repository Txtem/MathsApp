import { describe, expect, it } from "vitest";

import { TemplateConfigError } from "../errors";
import type { ParamSpec } from "../types";
import { makeRng } from "./rng";
import { sampleParams } from "./sample";

const spec: Readonly<Record<string, ParamSpec>> = {
  n: { type: "int", min: 3, max: 9 },
  ordered: { type: "const", value: true },
  label: { type: "choice", values: ["rot", "blau"] },
  rate: { type: "float", min: 0, max: 1, decimals: 2 },
};

describe("sampleParams", () => {
  it("würfelt jeden Parameter im vorgegebenen Bereich", () => {
    for (let i = 0; i < 200; i++) {
      const params = sampleParams(spec, makeRng(`seed-${i}`));
      expect(Object.keys(params).sort()).toEqual(["label", "n", "ordered", "rate"]);
      expect(params.n).toBeGreaterThanOrEqual(3);
      expect(params.n).toBeLessThanOrEqual(9);
      expect(params.ordered).toBe(true);
      expect(["rot", "blau"]).toContain(params.label);
      expect(params.rate).toBeGreaterThanOrEqual(0);
      expect(params.rate).toBeLessThanOrEqual(1);
    }
  });

  it("ist bei gleichem Seed reproduzierbar", () => {
    expect(sampleParams(spec, makeRng("wiederholbar"))).toEqual(
      sampleParams(spec, makeRng("wiederholbar")),
    );
  });

  it("hängt nicht von der Schlüsselreihenfolge im Template ab", () => {
    const reordered: Readonly<Record<string, ParamSpec>> = {
      rate: { type: "float", min: 0, max: 1, decimals: 2 },
      label: { type: "choice", values: ["rot", "blau"] },
      ordered: { type: "const", value: true },
      n: { type: "int", min: 3, max: 9 },
    };
    expect(sampleParams(reordered, makeRng("order"))).toEqual(sampleParams(spec, makeRng("order")));
  });

  it("rundet float auf die geforderten Nachkommastellen", () => {
    const rounded = sampleParams(
      { x: { type: "float", min: 0, max: 10, decimals: 1 } },
      makeRng("decimals"),
    );
    expect(String(rounded.x)).toMatch(/^\d+(\.\d)?$/);
  });

  it("nutzt 2 Nachkommastellen als Vorgabe", () => {
    const value = sampleParams({ x: { type: "float", min: 0, max: 1 } }, makeRng("default"));
    expect(String(value.x)).toMatch(/^\d+(\.\d{1,2})?$/);
  });

  it("meldet kaputte Wertebereiche als Template-Fehler", () => {
    const rng = makeRng("broken");
    expect(() => sampleParams({ n: { type: "int", min: 9, max: 3 } }, rng)).toThrow(
      TemplateConfigError,
    );
    expect(() => sampleParams({ x: { type: "float", min: 9, max: 3 } }, rng)).toThrow(
      TemplateConfigError,
    );
    expect(() => sampleParams({ c: { type: "choice", values: [] } }, rng)).toThrow(
      TemplateConfigError,
    );
    expect(() => sampleParams({ n: { type: "int", min: 1.5, max: 3 } }, rng)).toThrow(
      TemplateConfigError,
    );
  });

  it("gibt const-Werte unverändert weiter", () => {
    const params = sampleParams(
      {
        a: { type: "const", value: false },
        b: { type: "const", value: "text" },
        c: { type: "const", value: 42 },
      },
      makeRng("const"),
    );
    expect(params).toEqual({ a: false, b: "text", c: 42 });
  });
});
