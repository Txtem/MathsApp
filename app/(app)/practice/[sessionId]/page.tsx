import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";

import { PracticeLoop } from "./practice-loop";

/**
 * Der Aufgaben-Loop einer Session.
 *
 * Die Seite selbst holt keine Aufgabe — sie prüft nur, dass die Session
 * existiert und zum eingeloggten User gehört. Alles Weitere läuft über die
 * Routen aus SPEC.md Abschnitt 8, damit es genau einen Weg zu einer Aufgabe gibt.
 */
export default async function PracticeSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const userId = await getCurrentUserId();

  const session = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, topicFilter: true },
  });

  if (!session || session.userId !== userId) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          {session.topicFilter ?? "Alle Themen"}
        </h1>
        <Link
          href="/practice"
          className="text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          Sitzung beenden
        </Link>
      </div>

      <PracticeLoop sessionId={session.id} />
    </div>
  );
}
