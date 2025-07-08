-- AlterTable
ALTER TABLE "File" ADD COLUMN     "downloadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "downloadLimit" INTEGER;
