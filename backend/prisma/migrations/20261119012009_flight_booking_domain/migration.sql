-- CreateEnum
CREATE TYPE "AircraftRange" AS ENUM ('DOMESTIC', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "AircraftStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "RouteType" AS ENUM ('DOMESTIC', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'DELAYED', 'SOLD_OUT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "SeatClass" AS ENUM ('ECONOMY', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('FREE', 'BLOCKED', 'PAYMENT_PENDING', 'RESERVED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PAYMENT_PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PassengerType" AS ENUM ('ADULT', 'CHILD');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MASCULINO', 'FEMENINO');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "countries" (
    "id" SERIAL NOT NULL,
    "isoCode" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" SERIAL NOT NULL,
    "countryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "airports" (
    "id" SERIAL NOT NULL,
    "cityId" INTEGER NOT NULL,
    "iataCode" CHAR(3) NOT NULL,

    CONSTRAINT "airports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aircraft" (
    "id" SERIAL NOT NULL,
    "internalIdentifier" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "typeRange" "AircraftRange" NOT NULL,
    "rangeMiles" INTEGER NOT NULL,
    "maxNumberSeats" INTEGER NOT NULL,
    "businessSeats" INTEGER NOT NULL,
    "seatColumns" TEXT NOT NULL DEFAULT 'ABCDEF',
    "status" "AircraftStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "aircraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "luggage_type" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "feePercentage" DECIMAL(5,2) NOT NULL,
    "businessOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "luggage_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_routes" (
    "id" SERIAL NOT NULL,
    "routeType" "RouteType" NOT NULL,
    "fromAirportId" INTEGER NOT NULL,
    "destinationAirportId" INTEGER NOT NULL,

    CONSTRAINT "flight_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_flights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flightRouteId" INTEGER NOT NULL,
    "aircraftId" INTEGER NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "arrivalDate" TIMESTAMP(3) NOT NULL,
    "numMaxSeats" INTEGER NOT NULL,
    "numAvailableSeats" INTEGER NOT NULL,
    "occupancyRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "basePriceDefault" DECIMAL(10,2) NOT NULL,
    "averagePriceEconomy" DECIMAL(10,2) NOT NULL,
    "averagePriceBusiness" DECIMAL(10,2) NOT NULL,
    "status" "FlightStatus" NOT NULL DEFAULT 'ACTIVE',
    "eventVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_flights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flights_seat_availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scheduledFlightId" UUID NOT NULL,
    "seatIdentifier" TEXT NOT NULL,
    "seatRow" INTEGER NOT NULL,
    "seatColumn" CHAR(1) NOT NULL,
    "seatClass" "SeatClass" NOT NULL,
    "seatPrice" DECIMAL(10,2) NOT NULL,
    "seatStatus" "SeatStatus" NOT NULL DEFAULT 'FREE',
    "heldBySession" TEXT,
    "holdExpiresAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "flights_seat_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderNumber" TEXT NOT NULL,
    "reservationNumber" TEXT NOT NULL,
    "scheduledFlightId" UUID NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "flightPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "idempotencyHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passengers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "seatId" UUID,
    "fullName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "dateBirth" DATE NOT NULL,
    "nationalityCountryId" INTEGER NOT NULL,
    "passengerType" "PassengerType" NOT NULL DEFAULT 'ADULT',
    "luggageTypeId" INTEGER,

    CONSTRAINT "passengers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "passengerId" UUID NOT NULL,
    "seatId" UUID NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "checkInAvailable" BOOLEAN NOT NULL DEFAULT false,
    "checkIn" BOOLEAN NOT NULL DEFAULT false,
    "checkInDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_luggage" (
    "id" SERIAL NOT NULL,
    "ticketId" UUID NOT NULL,
    "luggageTypeId" INTEGER NOT NULL,
    "feeAppliedPercentage" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "ticket_luggage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "cardBrand" TEXT NOT NULL,
    "cardLast4" CHAR(4) NOT NULL,
    "gatewayReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_isoCode_key" ON "countries"("isoCode");

-- CreateIndex
CREATE UNIQUE INDEX "cities_countryId_name_key" ON "cities"("countryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "airports_iataCode_key" ON "airports"("iataCode");

-- CreateIndex
CREATE UNIQUE INDEX "aircraft_internalIdentifier_key" ON "aircraft"("internalIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "luggage_type_name_key" ON "luggage_type"("name");

-- CreateIndex
CREATE UNIQUE INDEX "flight_routes_fromAirportId_destinationAirportId_key" ON "flight_routes"("fromAirportId", "destinationAirportId");

-- CreateIndex
CREATE INDEX "scheduled_flights_flightRouteId_departureDate_idx" ON "scheduled_flights"("flightRouteId", "departureDate");

-- CreateIndex
CREATE INDEX "scheduled_flights_departureDate_idx" ON "scheduled_flights"("departureDate");

-- CreateIndex
CREATE INDEX "flights_seat_availability_scheduledFlightId_seatStatus_idx" ON "flights_seat_availability"("scheduledFlightId", "seatStatus");

-- CreateIndex
CREATE INDEX "flights_seat_availability_seatStatus_holdExpiresAt_idx" ON "flights_seat_availability"("seatStatus", "holdExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "flights_seat_availability_scheduledFlightId_seatIdentifier_key" ON "flights_seat_availability"("scheduledFlightId", "seatIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orders_reservationNumber_key" ON "orders"("reservationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "orders_scheduledFlightId_idx" ON "orders"("scheduledFlightId");

-- CreateIndex
CREATE INDEX "passengers_orderId_idx" ON "passengers"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_passengerId_key" ON "tickets"("passengerId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_seatId_key" ON "tickets"("seatId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticketCode_key" ON "tickets"("ticketCode");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "outbox_events_status_nextAttemptAt_idx" ON "outbox_events"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "airports" ADD CONSTRAINT "airports_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_routes" ADD CONSTRAINT "flight_routes_fromAirportId_fkey" FOREIGN KEY ("fromAirportId") REFERENCES "airports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_routes" ADD CONSTRAINT "flight_routes_destinationAirportId_fkey" FOREIGN KEY ("destinationAirportId") REFERENCES "airports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_flights" ADD CONSTRAINT "scheduled_flights_flightRouteId_fkey" FOREIGN KEY ("flightRouteId") REFERENCES "flight_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_flights" ADD CONSTRAINT "scheduled_flights_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "aircraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flights_seat_availability" ADD CONSTRAINT "flights_seat_availability_scheduledFlightId_fkey" FOREIGN KEY ("scheduledFlightId") REFERENCES "scheduled_flights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_scheduledFlightId_fkey" FOREIGN KEY ("scheduledFlightId") REFERENCES "scheduled_flights"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "passengers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "flights_seat_availability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_luggage" ADD CONSTRAINT "ticket_luggage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_luggage" ADD CONSTRAINT "ticket_luggage_luggageTypeId_fkey" FOREIGN KEY ("luggageTypeId") REFERENCES "luggage_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
