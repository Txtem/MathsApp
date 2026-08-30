/**
 * Lädt den gesamten Content und prüft ihn. Beendet mit Exit-Code 1, sobald
 * etwas nicht stimmt — läuft als `pretest` und gehört vor jeden Commit.
 *
 * Zusätzlich zur Prüfung gibt das Skript je Template die Größe des
 * Parameterraums aus: wie viele verschiedene Aufgaben es überhaupt hervorbringen
 * kann. Ein zu enger Raum ist eine Warnung, kein Fehler — er macht ein Template
 * langweilig, nicht ungültig.
 */
import { formatIssues } from "../lib/content/checks";
import { parameterSpace } from "../lib/content/parameter-space";
import { ContentError, readContent } from "../lib/content/read";

try {
  const { templates, topics, warnings } = readContent();
  const leaves = new Set(templates.map((template) => template.topic));

  const zeilen = [...templates]
    .sort((a, b) => a.topic.localeCompare(b.topic) || a.id.localeCompare(b.id))
    .map((template) => {
      const space = parameterSpace(template);
      return {
        id: template.id,
        topic: template.topic,
        size: space.exact ? String(space.size) : `~${space.size}`,
      };
    });

  const idBreite = Math.max(...zeilen.map((zeile) => zeile.id.length));
  const topicBreite = Math.max(...zeilen.map((zeile) => zeile.topic.length));

  console.log("Parameterraum je Template (gültige Kombinationen):");
  for (const zeile of zeilen) {
    console.log(
      `  ${zeile.id.padEnd(idBreite)}  ${zeile.topic.padEnd(topicBreite)}  ${zeile.size.padStart(7)}`,
    );
  }

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} Warnung(en):`);
    console.log(formatIssues(warnings));
  }

  console.log(
    `\nOK — ${templates.length} Template(s) auf ${leaves.size} Blättern in ${Object.keys(topics).length} Themenbereichen.`,
  );
} catch (error) {
  if (error instanceof ContentError) {
    console.error(`FEHLER — ${error.message}`);
    process.exit(1);
  }
  throw error;
}
