-- CreateTable
CREATE TABLE "inspection_sequences" (
    "branchCode" VARCHAR(3) NOT NULL,
    "datePrefix" VARCHAR(8) NOT NULL,
    "nextSequence" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "inspection_sequences_pkey" PRIMARY KEY ("branchCode","datePrefix")
);
