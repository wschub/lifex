-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'es';

-- AlterTable
ALTER TABLE "passengers" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;
