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
 * die lokale Datenbank zwischendurch zurückgesetzt wird. In M2b verschwindet
 * er ohnehin.
 */
export async function getCurrentUserId(): Promise<string> {
  return ensureDevUser();
}
