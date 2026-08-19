/**
 * Lädt den gesamten Content und prüft ihn. Beendet mit Exit-Code 1, sobald
 * etwas nicht stimmt — läuft als `pretest` und gehört vor jeden Commit.
 */
import { ContentError, readContent } from "../lib/content/read";

try {
  const { templates, topics } = readContent();
  const leaves = new Set(templates.map((template) => template.topic));
  console.log(
    `OK — ${templates.length} Template(s) in ${leaves.size} von ${Object.keys(topics).length} Themenbereichen.`,
  );
} catch (error) {
  if (error instanceof ContentError) {
    console.error(`FEHLER — ${error.message}`);
    process.exit(1);
  }
  throw error;
}
