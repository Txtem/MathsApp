import { describe, expect, it } from "vitest";

import { makeRng } from "@/lib/engine/generate/rng";
import { instantiate } from "@/lib/engine/instantiate";
import type { Template } from "@/lib/engine/types";
import { drawQuestion } from "@/lib/selection/next-question";
import type { TopicStats } from "@/lib/selection/scoring";

import { MIN_PARAMETER_SPACE } from "./checks";
import { ENUMERATION_LIMIT, parameterSpace } from "./parameter-space";
import { readContent } from "./read";

/**
 * Die Zählung ist nur so viel wert, wie sie mit dem Generator übereinstimmt.
 * Der schärfste Test hier ist deshalb nicht der auf eine Zahl, sondern der
 * Abgleich: Was `instantiate` über viele Seeds hervorbringt, muss in der
 * gezählten Menge liegen — und bei kleinen Räumen sie ausschöpfen.
 */

const base = {
  version: 1,
  topic: "kombinatorik.permutation",
  difficulty: 1,
  target_time_seconds: 30,
  answer_type: "integer",
  solution_text: undefined,
} satisfies Omit<Template, "id" | "compute_ref" | "param_spec" | "constraints" | "question_text">;

function template(overrides: Partial<Template>): Template {
  return {
    ...base,
    id: "aufg_90000",
    compute_ref: "kombinatorik.permutation.factorial",
    param_spec: { n: { type: "int", min: 4, max: 9 } },
    constraints: [],
    question_text: "{{n}} Personen",
    ...overrides,
  } as Template;
}

describe("parameterSpace — abzählbare Bereiche", () => {
  it("zählt einen einzelnen int-Bereich", () => {
    const space = parameterSpace(template({}));
    expect(space).toEqual({ size: 6, raw: 6, exact: true });
  });

  it("multipliziert mehrere Bereiche", () => {
    const space = parameterSpace(
      template({
        compute_ref: "kombinatorik.kombination.mit_wdh",
        param_spec: {
          n: { type: "int", min: 4, max: 10 },
          k: { type: "int", min: 2, max: 5 },
        },
        question_text: "{{n}} und {{k}}",
      }),
    );
    expect(space).toEqual({ size: 28, raw: 28, exact: true });
  });

  it("zählt const als genau einen Wert", () => {
    const space = parameterSpace(
      template({ param_spec: { n: { type: "const", value: 5 } }, question_text: "{{n}}" }),
    );
    expect(space).toEqual({ size: 1, raw: 1, exact: true });
  });

  it("zählt choice über seine Werte", () => {
    const space = parameterSpace(
      template({ param_spec: { n: { type: "choice", values: [3, 5, 7] } } }),
    );
    expect(space.size).toBe(3);
  });

  it("zieht ab, was ein Constraint verwirft", () => {
    // 9! = 362880, 8! = 40320 — die Schranke lässt n bis 8 durch.
    const space = parameterSpace(template({ constraints: ["result <= 100000"] }));
    expect(space).toEqual({ size: 5, raw: 6, exact: true });
  });

  it("zieht ab, was das Eingabeschema verwirft", () => {
    // `ohne_wdh` verlangt k <= n; das Template lässt auch k > n zu.
    const space = parameterSpace(
      template({
        compute_ref: "kombinatorik.kombination.ohne_wdh",
        param_spec: {
          n: { type: "int", min: 2, max: 3 },
          k: { type: "int", min: 1, max: 4 },
        },
        question_text: "{{n}} und {{k}}",
      }),
    );
    // n=2: k∈{1,2}; n=3: k∈{1,2,3} — fünf von acht.
    expect(space).toEqual({ size: 5, raw: 8, exact: true });
  });

  it("gibt null zurück, wenn nichts durchkommt", () => {
    const space = parameterSpace(template({ constraints: ["result <= 1"] }));
    expect(space.size).toBe(0);
  });
});

describe("parameterSpace — Schätzung", () => {
  const mitFloat = template({
    compute_ref: "arithmetik.add",
    param_spec: {
      a: { type: "int", min: 1, max: 9 },
      b: { type: "float", min: 0, max: 1, decimals: 1 },
    },
    question_text: "{{a}} und {{b}}",
  });

  it("kennzeichnet einen float-Bereich als geschätzt", () => {
    // `arithmetik.add` verlangt zwei Ganzzahlen und verwirft jeden Wurf mit
    // gebrochenem b — hier geht es nur darum, dass nicht aufgezählt wird.
    expect(parameterSpace(mitFloat).exact).toBe(false);
  });

  it("nennt den rohen Raum über das Raster", () => {
    // b läuft in Zehntelschritten von 0 bis 1, also elf Werte.
    expect(parameterSpace(mitFloat).raw).toBe(9 * 11);
  });

  it("liefert bei gleichem Template dieselbe Schätzung", () => {
    expect(parameterSpace(mitFloat).size).toBe(parameterSpace(mitFloat).size);
  });

  it("zählt exakt, solange der rohe Raum unter der Grenze bleibt", () => {
    expect(parameterSpace(template({})).exact).toBe(true);
    expect(ENUMERATION_LIMIT).toBeGreaterThan(1000);
  });
});

describe("parameterSpace stimmt mit dem Generator überein", () => {
  const { templates } = readContent();

  /** Die verschiedenen Fragetexte, die `instantiate` über viele Seeds liefert. */
  function gezogeneFragen(tpl: Template, seeds: number): Set<string> {
    const fragen = new Set<string>();
    for (let i = 0; i < seeds; i++) fragen.add(instantiate(tpl, `abgleich-${i}`).questionText);
    return fragen;
  }

  it.each(templates.map((tpl) => [tpl.id, tpl] as const))(
    "%s zieht nie mehr verschiedene Aufgaben, als gezählt wurden",
    (_id, tpl) => {
      const space = parameterSpace(tpl);
      expect(gezogeneFragen(tpl, 300).size).toBeLessThanOrEqual(space.size);
    },
  );

  it("schöpft einen kleinen Raum über genügend Seeds auch aus", () => {
    // Die Gegenprobe zur Zeile darüber: Wäre die Zählung zu großzügig, käme
    // der Generator nie an die Zahl heran.
    const klein = templates.filter((tpl) => parameterSpace(tpl).size <= 36);
    expect(klein.length).toBeGreaterThan(0);

    for (const tpl of klein) {
      expect(gezogeneFragen(tpl, 2000).size).toBe(parameterSpace(tpl).size);
    }
  });
});

describe("was die Schwelle bedeutet — und was nicht", () => {
  /**
   * `MIN_PARAMETER_SPACE` ist eine Untergrenze, keine Zusage. Gezogen wird mit
   * Zurücklegen: Ein Template mit genau zwanzig Kombinationen liefert in einer
   * Sitzung von zwanzig Aufgaben **nicht** zwanzig verschiedene.
   *
   * Gemessen mit dem echten `drawQuestion`, also inklusive der bis zu fünf
   * Nachziehversuche aus D-25, für ein Thema mit einem einzigen Template.
   */
  const NOW = new Date("2026-08-30T12:00:00.000Z");
  const SITZUNG = 20;
  const LAEUFE = 200;

  const stats: TopicStats = {
    topic: "kombinatorik.permutation",
    recentCorrect: 5,
    recentAnswered: 10,
    dueAt: null,
    lastSeenAt: null,
  };

  /** Ein Template mit genau `size` verschiedenen Aufgaben. */
  function mitRaum(size: number): Template {
    return template({
      id: `raum-${size}`,
      param_spec: { n: { type: "int", min: 1, max: size } },
      question_text: "Auf wie viele Arten können {{n}} Personen anstehen?",
    });
  }

  /** Mittlere Zahl verschiedener Aufgaben in einer Sitzung von zwanzig. */
  function verschiedeneJeSitzung(size: number): number {
    const tpl = mitRaum(size);
    let summe = 0;

    for (let lauf = 0; lauf < LAEUFE; lauf++) {
      const rng = makeRng(`raum-${size}-${lauf}`);
      const asked: string[] = [];
      let counter = 0;

      for (let i = 0; i < SITZUNG; i++) {
        const drawn = drawQuestion(
          [tpl],
          { now: NOW, stats: [stats], askedQuestionTexts: asked },
          rng.next,
          () => `raum-${size}-${lauf}-${counter++}`,
        );
        if (drawn === undefined) throw new Error("Die Auswahl hat nichts geliefert.");
        asked.push(drawn.instance.questionText);
      }

      summe += new Set(asked).size;
    }

    return summe / LAEUFE;
  }

  it("liefert bei genau der Schwelle weniger als zwanzig verschiedene", () => {
    const gemessen = verschiedeneJeSitzung(MIN_PARAMETER_SPACE);
    // Gemessen 17,7 — die Schranke hier ist bewusst locker, geprüft wird die
    // Aussage „deutlich unter zwanzig", nicht die dritte Stelle.
    expect(gemessen).toBeLessThan(18.5);
    expect(gemessen).toBeGreaterThan(16.5);
  });

  it("braucht rund ein Viertel mehr Raum für 18 von 20", () => {
    // Das Abnahmekriterium für M2d lautet 18 verschiedene von 20. Dafür reicht
    // die Warnschwelle nicht ganz — bei 25 ist es erfüllt.
    expect(verschiedeneJeSitzung(25)).toBeGreaterThan(18);
  });

  it("schöpft einen Raum unter der Sitzungslänge vollständig aus", () => {
    // Bei zehn Kombinationen sieht der Übende alle zehn und dann nichts Neues.
    expect(verschiedeneJeSitzung(10)).toBe(10);
  });
});
