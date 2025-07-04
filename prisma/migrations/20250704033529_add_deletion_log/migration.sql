-- CreateTable
CREATE TABLE "FileDeletionFailureLog" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileDeletionFailureLog_pkey" PRIMARY KEY ("id")
);
