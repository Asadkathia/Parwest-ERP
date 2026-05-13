-- CreateTable: GuardJudicialCase
-- Stores judicial / criminal case records linked to a guard. Replaces the
-- ad-hoc JSON blob approach used for nearest-relatives / family / employment
-- so judicial data is searchable, indexable, and audit-friendly.
CREATE TABLE "GuardJudicialCase" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "caseNo" TEXT,
    "caseDate" TIMESTAMP(3),
    "policeStation" TEXT,
    "investigationResult" TEXT,
    "courtResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardJudicialCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardJudicialCase_guardId_idx" ON "GuardJudicialCase"("guardId");
CREATE INDEX "GuardJudicialCase_caseDate_idx" ON "GuardJudicialCase"("caseDate");

-- AddForeignKey
ALTER TABLE "GuardJudicialCase"
  ADD CONSTRAINT "GuardJudicialCase_guardId_fkey"
  FOREIGN KEY ("guardId") REFERENCES "Guard"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
