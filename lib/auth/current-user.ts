import "server-only";

import { ensureDevUser } from "@/lib/db/dev-user";

/**
 * Wer ist der Nutzer dieses Requests?
 *
 * Diese Funktion ist die **einzige** Stelle, an der das beantwortet wird. Jede
 * Route und jede Server Component, die einen Nutzer braucht, ruft sie auf —
 * nie direkt den Dev-User. Genau deshalb bleibt M2b klein: Dort wird nur der
 * Rumpf ersetzt (Auth.js-Session lesen, bei fehlender Anmeldung werfen), und
 * kein einziger Aufrufer muss angefasst werden.
 *
 * In M2a gibt sie den Dummy-User zurück und legt ihn an, falls er fehlt. Der
 * Upsert läuft bei jedem Aufruf, nicht einmal pro Prozess: Er ist idempotent
 * und trifft eine Tabelle mit einer Zeile, und ein Cache würde lügen, sobald
 * die lokale Datenbank zwischendurch zurückgesetzt wird. In M2c verschwindet
 * er ohnehin.
 *
 * `now` ist die Uhr der Anfrage (D-20). Sie steht hier nur, weil das Anlegen
 * des Dummy-Users ein `createdAt` schreibt; die Antwort hängt nicht davon ab.
 */
export async function getCurrentUserId(now: Date): Promise<string> {
  return ensureDevUser(now);
}
