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
    "createdAt" DATETIME NOT NULL,
    "answeredAt" DATETIME,
    CONSTRAINT "Attempt_practiceSessionId_fkey" FOREIGN KEY ("practiceSessionId") REFERENCES "PracticeSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attempt" ("answerType", "answeredAt", "createdAt", "difficulty", "durationMs", "expectedAnswer", "id", "imageUrl", "isCorrect", "params", "practiceSessionId", "questionText", "reviewVerdict", "seed", "status", "templateId", "templateVersion", "topic", "transcript", "userAnswer", "userId") SELECT "answerType", "answeredAt", "createdAt", "difficulty", "durationMs", "expectedAnswer", "id", "imageUrl", "isCorrect", "params", "practiceSessionId", "questionText", "reviewVerdict", "seed", "status", "templateId", "templateVersion", "topic", "transcript", "userAnswer", "userId" FROM "Attempt";
DROP TABLE "Attempt";
ALTER TABLE "new_Attempt" RENAME TO "Attempt";
CREATE INDEX "Attempt_practiceSessionId_idx" ON "Attempt"("practiceSessionId");
CREATE INDEX "Attempt_userId_topic_answeredAt_idx" ON "Attempt"("userId", "topic", "answeredAt");
CREATE TABLE "new_PracticeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "topicFilter" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    CONSTRAINT "PracticeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PracticeSession" ("endedAt", "id", "startedAt", "topicFilter", "userId") SELECT "endedAt", "id", "startedAt", "topicFilter", "userId" FROM "PracticeSession";
DROP TABLE "PracticeSession";
ALTER TABLE "new_PracticeSession" RENAME TO "PracticeSession";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id") SELECT "createdAt", "email", "id" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Bestandsdaten normalisieren
-- Zeitstempel gibt es ab hier nur noch aus dem Anwendungscode, in einer
-- einzigen Schreibweise. Aus der Zeit davor stehen zwei andere in der
-- Datenbank: "...Z" und "2026-08-30 18:31:27" aus CURRENT_TIMESTAMP. SQLite
-- vergleicht Text, und das Leerzeichen sortiert vor dem "T" — deshalb wird
-- hier alles auf dieselbe Form gebracht. Fuer bereits kanonische Werte und
-- fuer NULL ist das ein Nulldurchgang.
UPDATE "User" SET "createdAt" = strftime('%Y-%m-%dT%H:%M:%f+00:00', "createdAt");
UPDATE "PracticeSession" SET
    "startedAt" = strftime('%Y-%m-%dT%H:%M:%f+00:00', "startedAt"),
    "endedAt" = strftime('%Y-%m-%dT%H:%M:%f+00:00', "endedAt");
UPDATE "Attempt" SET
    "createdAt" = strftime('%Y-%m-%dT%H:%M:%f+00:00', "createdAt"),
    "answeredAt" = strftime('%Y-%m-%dT%H:%M:%f+00:00', "answeredAt");
UPDATE "TopicMastery" SET
    "lastSeenAt" = strftime('%Y-%m-%dT%H:%M:%f+00:00', "lastSeenAt"),
    "dueAt" = strftime('%Y-%m-%dT%H:%M:%f+00:00', "dueAt");
