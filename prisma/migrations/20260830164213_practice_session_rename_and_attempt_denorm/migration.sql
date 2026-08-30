/*
  Warnings:

  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `sessionId` on the `Attempt` table. All the data in the column will be lost.
  - Added the required column `difficulty` to the `Attempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `practiceSessionId` to the `Attempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `topic` to the `Attempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Attempt` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Session";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "topicFilter" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "PracticeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" DATETIME,
    CONSTRAINT "Attempt_practiceSessionId_fkey" FOREIGN KEY ("practiceSessionId") REFERENCES "PracticeSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attempt" ("answerType", "answeredAt", "createdAt", "durationMs", "expectedAnswer", "id", "imageUrl", "isCorrect", "params", "questionText", "reviewVerdict", "seed", "status", "templateId", "templateVersion", "transcript", "userAnswer") SELECT "answerType", "answeredAt", "createdAt", "durationMs", "expectedAnswer", "id", "imageUrl", "isCorrect", "params", "questionText", "reviewVerdict", "seed", "status", "templateId", "templateVersion", "transcript", "userAnswer" FROM "Attempt";
DROP TABLE "Attempt";
ALTER TABLE "new_Attempt" RENAME TO "Attempt";
CREATE INDEX "Attempt_practiceSessionId_idx" ON "Attempt"("practiceSessionId");
CREATE INDEX "Attempt_userId_topic_answeredAt_idx" ON "Attempt"("userId", "topic", "answeredAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
