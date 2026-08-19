import { z } from "zod";

/**
 * Zod-Schemata für den Content. Rein deklarativ: keine Dateizugriffe, keine
 * Registry — damit sie sowohl im Loader als auch im Prüfskript und in Tests
 * benutzt werden können.
 *
 * Die inhaltlichen Prüfungen (existiert die `compute_ref`? ist `topic` ein
 * Blatt?) stehen in `checks.ts`; hier geht es nur um die Form.
 */

/** Ein Pfadsegment: klein, ohne Bindestrich, damit es als Bezeichner taugt. */
const SEGMENT = /^[a-z][a-z0-9_]*$/;
/** Ein Pfad aus Segmenten: `kombinatorik.permutation`. */
const DOTTED = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

export const ParamSpecSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("int"), min: z.number().int(), max: z.number().int() }),
  z.object({
    type: z.literal("choice"),
    values: z.array(z.union([z.string(), z.number(), z.boolean()])).min(2),
  }),
  z.object({ type: z.literal("const"), value: z.union([z.string(), z.number(), z.boolean()]) }),
]);

export const ANSWER_TYPES = ["integer", "numeric", "fraction", "choice"] as const;

export const TemplateSchema = z.object({
  id: z.string().regex(/^aufg_\d{5}$/),
  version: z.number().int().positive(),
  topic: z.string().regex(DOTTED),
  difficulty: z.number().int().min(1).max(5),
  target_time_seconds: z.number().int().positive(),
  compute_ref: z.string().regex(DOTTED),
  answer_type: z.enum(ANSWER_TYPES),
  /** Nur bei `numeric`: Auf so viele Nachkommastellen wird beidseitig gerundet. */
  round_to: z.number().int().min(0).max(10).optional(),
  param_spec: z.record(z.string().regex(SEGMENT), ParamSpecSchema),
  constraints: z.array(z.string()).default([]),
  // .trim(): YAML-Blockskalare (|) haengen einen Zeilenumbruch an, der sonst in
  // der Aufgabe landet.
  question_text: z.string().trim().min(1),
  solution_text: z.string().trim().optional(),
  tags: z.array(z.string()).default([]),
});

export type TemplateInput = z.input<typeof TemplateSchema>;
export type ValidatedTemplate = z.output<typeof TemplateSchema>;

/**
 * Themenbaum. Zwei Ebenen reichen heute; die Rekursion ist trotzdem allgemein
 * formuliert, damit eine dritte Ebene kein Schema-Umbau wird.
 */
export interface TopicNode {
  readonly label: string;
  readonly children?: Readonly<Record<string, TopicNode>>;
}

export const TopicNodeSchema: z.ZodType<TopicNode> = z.lazy(() =>
  z.object({
    label: z.string().min(1),
    children: z.record(z.string().regex(SEGMENT), TopicNodeSchema).optional(),
  }),
);

export const TopicsSchema = z.record(z.string().regex(SEGMENT), TopicNodeSchema);

export type Topics = z.output<typeof TopicsSchema>;

/** Alle Blattpfade des Baums — nur auf die darf ein Template zeigen. */
export function leafTopics(topics: Topics): ReadonlySet<string> {
  const leaves = new Set<string>();

  const walk = (node: TopicNode, path: string): void => {
    const children = node.children;
    if (!children || Object.keys(children).length === 0) {
      leaves.add(path);
      return;
    }
    for (const [segment, child] of Object.entries(children)) {
      walk(child, `${path}.${segment}`);
    }
  };

  for (const [segment, node] of Object.entries(topics)) walk(node, segment);
  return leaves;
}

/** Alle gültigen Filterpfade: Blätter *und* Zwischenknoten. */
export function allTopicPaths(topics: Topics): ReadonlySet<string> {
  const paths = new Set<string>();

  const walk = (node: TopicNode, path: string): void => {
    paths.add(path);
    for (const [segment, child] of Object.entries(node.children ?? {})) {
      walk(child, `${path}.${segment}`);
    }
  };

  for (const [segment, node] of Object.entries(topics)) walk(node, segment);
  return paths;
}

/** Beschriftung eines Pfads, oder `undefined`, wenn er nicht im Baum steht. */
export function topicLabel(topics: Topics, path: string): string | undefined {
  let current: TopicNode | undefined;
  let level: Readonly<Record<string, TopicNode>> | undefined = topics;

  for (const segment of path.split(".")) {
    current = level?.[segment];
    if (!current) return undefined;
    level = current.children;
  }
  return current?.label;
}

/**
 * Ein Thema, wie es die Auswahlseite braucht: Pfad, Beschriftung, die Zahl der
 * Aufgaben darunter und die Unterthemen.
 */
export interface TopicOffer {
  readonly path: string;
  readonly label: string;
  readonly templateCount: number;
  readonly children: readonly TopicOffer[];
}

export function topicOffers(
  topics: Topics,
  templates: readonly { readonly topic: string }[],
): readonly TopicOffer[] {
  const countFor = (path: string): number =>
    templates.filter(
      (template) => template.topic === path || template.topic.startsWith(`${path}.`),
    ).length;

  const build = (path: string, node: TopicNode): TopicOffer => ({
    path,
    label: node.label,
    templateCount: countFor(path),
    children: Object.entries(node.children ?? {}).map(([segment, child]) =>
      build(`${path}.${segment}`, child),
    ),
  });

  return Object.entries(topics).map(([segment, node]) => build(segment, node));
}
