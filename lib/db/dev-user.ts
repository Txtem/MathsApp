import "server-only";

import { prisma } from "./client";

/**
 * M0 hat kein Auth. Alle Sessions hängen an dieser einen Zeile, damit die
 * Fremdschlüssel stimmen und die Autorisierungsprüfungen in den Routen schon
 * jetzt an der richtigen Stelle stehen.
 *
 * Mit M2 kommt Auth.js; dann ersetzt die echte User-ID aus der Session diesen
 * Wert, und die Prüfungen in den Routen bleiben, wie sie sind.
 */
export const DEV_USER_ID = "dev-user";
const DEV_USER_EMAIL = "dev@localhost";

/**
 * Legt den Dummy-User an, falls er fehlt. Idempotent, läuft auf einer frischen DB.
 *
 * `now` kommt von außen, weil `createdAt` keinen Datenbank-Default mehr hat und
 * jeder Zeitstempel einer Anfrage aus derselben Uhr stammt (D-20). Mit M2c
 * verschwindet die Funktion samt Parameter.
 */
export async function ensureDevUser(now: Date): Promise<string> {
  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: {},
    create: { id: DEV_USER_ID, email: DEV_USER_EMAIL, createdAt: now },
  });
  return DEV_USER_ID;
}
