import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { parse as parseYaml } from "yaml";

import { checkAll, type ContentIssue, formatIssues, type LoadedTemplate } from "./checks";
import { TemplateSchema, TopicsSchema, type Topics, type ValidatedTemplate } from "./schema";

/**
 * Liest den `content/`-Ordner: YAML parsen, gegen die Zod-Schemata validieren,
 * die statischen Prüfungen laufen lassen.
 *
 * Bewusst **ohne** `import "server-only"`: Dieses Modul wird auch von
 * `scripts/check-templates.ts` und von Tests benutzt, und `server-only` wirft
 * außerhalb einer React-Server-Umgebung. Den Schutz für die Anwendung
 * übernimmt `load.ts`, das als einziges Modul von `app/` importiert wird.
 * Siehe DECISIONS.md, D-12.
 */

export const CONTENT_ROOT = join(process.cwd(), "content");
const TEMPLATES_DIR = join(CONTENT_ROOT, "templates");
const TOPICS_FILE = join(CONTENT_ROOT, "topics.yaml");

export class ContentError extends Error {
  constructor(
    message: string,
    readonly issues: readonly ContentIssue[] = [],
  ) {
    super(message);
    this.name = "ContentError";
  }
}

export interface ContentBundle {
  readonly topics: Topics;
  readonly templates: readonly ValidatedTemplate[];
}

function yamlFilesIn(directory: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...yamlFilesIn(path));
    } else if (entry.name.endsWith(".yaml") && !entry.name.startsWith("_")) {
      found.push(path);
    }
  }
  // Sortiert, damit die Reihenfolge nicht vom Dateisystem abhängt.
  return found.sort();
}

export function readTopics(file: string = TOPICS_FILE): Topics {
  const parsed = TopicsSchema.safeParse(parseYaml(readFileSync(file, "utf8")));
  if (!parsed.success) {
    throw new ContentError(`${file} ist kein gültiger Themenbaum: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** Eine einzelne Datei — auch von den Negativ-Fixtures der Tests benutzt. */
export function readTemplateFile(file: string): LoadedTemplate {
  const source = relative(process.cwd(), file).split(sep).join("/");
  const parsed = TemplateSchema.safeParse(parseYaml(readFileSync(file, "utf8")));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(wurzel)"}: ${issue.message}`)
      .join("; ");
    throw new ContentError(`${source} passt nicht zum Template-Schema: ${detail}`);
  }
  return { template: parsed.data, source };
}

/**
 * Liest den gesamten Content und prüft ihn. Wirft bei jedem Befund — ein
 * fehlerhaftes Template darf nicht in eine Aufgabe geraten.
 */
export function readContent(
  templatesDir: string = TEMPLATES_DIR,
  topicsFile: string = TOPICS_FILE,
): ContentBundle {
  const topics = readTopics(topicsFile);
  const entries = yamlFilesIn(templatesDir).map(readTemplateFile);
  const issues = checkAll(entries, topics);

  if (issues.length > 0) {
    throw new ContentError(
      `${issues.length} Problem(e) im Content:\n${formatIssues(issues)}`,
      issues,
    );
  }

  return { topics, templates: entries.map((entry) => entry.template) };
}
