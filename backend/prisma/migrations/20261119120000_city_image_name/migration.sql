-- La BD guarda solo el nombre del archivo; las imágenes viven en frontend/public/img/destinations/.
ALTER TABLE "cities" RENAME COLUMN "imageUrl" TO "imageName";
UPDATE "cities"
SET "imageName" = regexp_replace("imageName", '^/img/destinations/', '')
WHERE "imageName" IS NOT NULL;
