/*
  Warnings:

  - Added the required column `bucket` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `key` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- ALTER TABLE "File" ADD COLUMN     "bucket" TEXT NOT NULL,
-- ADD COLUMN     "key" TEXT NOT NULL;
ALTER TABLE "File" ADD COLUMN "bucket" TEXT;
ALTER TABLE "File" ADD COLUMN "key" TEXT;

UPDATE "File" SET "bucket" = 'default-bucket', "key" = 'default-key';

ALTER TABLE "File" ALTER COLUMN "bucket" SET NOT NULL;
ALTER TABLE "File" ALTER COLUMN "key" SET NOT NULL;

