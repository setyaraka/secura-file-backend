-- CreateTable
CREATE TABLE "FileShareDownloadLog" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileShareDownloadLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FileShareDownloadLog" ADD CONSTRAINT "FileShareDownloadLog_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
