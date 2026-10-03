-- M2f: Versuche, Tipps, Aufgeben (SPEC-M2f Abschnitt C).
-- Neue Spalten tries, hintsUsed, firstAnswer, firstDurationMs auf Attempt.
-- Kein Feld outcome: der Ausgang wird aus status, isCorrect und tries abgeleitet.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "practiceSessionId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "seed" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "questionText" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "expectedAnswer" JSONB NOT NULL,
    "answerType" TEXT NOT NULL,
    "userAnswer" TEXT,
    "imageUrl" TEXT,
    "transcript" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "isCorrect" BOOLEAN,
    "reviewVerdict" JSONB,
    "durationMs" INTEGER,
    "tries" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "firstAnswer" TEXT,
    "firstDurationMs" INTEGER,
    "createdAt" DATETIME NOT NULL,
    "answeredAt" DATETIME,
    CONSTRAINT "Attempt_practiceSessionId_fkey" FOREIGN KEY ("practiceSessionId") REFERENCES "PracticeSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attempt" ("answerType", "answeredAt", "createdAt", "difficulty", "durationMs", "expectedAnswer", "id", "imageUrl", "isCorrect", "params", "practiceSessionId", "questionText", "reviewVerdict", "seed", "status", "templateId", "templateVersion", "topic", "transcript", "userAnswer", "userId") SELECT "answerType", "answeredAt", "createdAt", "difficulty", "durationMs", "expectedAnswer", "id", "imageUrl", "isCorrect", "params", "practiceSessionId", "questionText", "reviewVerdict", "seed", "status", "templateId", "templateVersion", "topic", "transcript", "userAnswer", "userId" FROM "Attempt";
DROP TABLE "Attempt";
ALTER TABLE "new_Attempt" RENAME TO "Attempt";
-- Bestand: Jeder bisher beantwortete Attempt hatte im alten Ablauf genau einen
-- bewerteten Versuch und keinen Tipp. Das ist die wahre Beschreibung, keine
-- Annahme. hintsUsed = 0 kommt aus dem Default; offene Attempts bleiben bei 0.
UPDATE "Attempt" SET "tries" = 1 WHERE "status" = 'ANSWERED';
CREATE INDEX "Attempt_practiceSessionId_idx" ON "Attempt"("practiceSessionId");
CREATE INDEX "Attempt_userId_topic_answeredAt_idx" ON "Attempt"("userId", "topic", "answeredAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
