/**
 * Wie ein Übungstermin ausgesprochen wird.
 *
 * Relativ, nicht als Kalenderdatum. Ein Datum entsteht erst durch eine
 * Zeitzone, und die des Servers ist nicht die des Übenden: Derselbe Termin
 * stand unter `Europe/Berlin` als 19.10. und unter `UTC` als 18.10. auf der
 * Seite — gemessen, nicht vermutet. Eine Differenz hat keine Zeitzone, damit
 * kann der Fehler nicht wiederkehren.
 *
 * Dazu kommt die Bedeutung von `dueAt`: Die Intervalle sind 1, 2, 4, 8 Tage bis
 * zur Deckelung. Ein Datum auf den Tag genau behauptet eine Genauigkeit, die
 * das Verfahren nicht besitzt. Handlungsrelevant ist ein Zustand — fällig oder
 * nicht — und sonst eine Größenordnung. Siehe D-22.
 *
 * Rein, mit `now` als Parameter (D-20). Kein `Intl`, kein Gebietsschema.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Ab hier wird in Tagen gezählt statt „morgen" gesagt. */
const MORGEN_BIS_MS = 2 * MS_PER_DAY;

export function dueLabel(dueAt: Date | null, now: Date): string {
  // Ohne Termin ist fällig: Ein nie geübtes Thema steht an.
  if (dueAt === null) return "fällig";

  const abstand = dueAt.getTime() - now.getTime();
  if (abstand <= 0) return "fällig";
  if (abstand < MORGEN_BIS_MS) return "morgen";

  // Aufgerundet, damit ein angebrochener Tag nicht unterschlagen wird und
  // „in 1 Tag" nie zu „heute" wird.
  return `in ${Math.ceil(abstand / MS_PER_DAY)} Tagen`;
}
