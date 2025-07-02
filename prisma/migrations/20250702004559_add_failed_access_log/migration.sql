-- CreateTable
CREATE TABLE "FailedAccessLog" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailedAccessLog_pkey" PRIMARY KEY ("id")
);
