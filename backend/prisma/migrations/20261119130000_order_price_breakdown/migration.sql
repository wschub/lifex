-- Desglose de la compra: asientos y equipaje por separado (flightPrice = seatsPrice + luggagePrice).
ALTER TABLE "orders" ADD COLUMN "seatsPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "luggagePrice" DECIMAL(10,2) NOT NULL DEFAULT 0;
-- Órdenes existentes: sin desglose guardado, todo el valor cuenta como asientos.
UPDATE "orders" SET "seatsPrice" = "flightPrice";
