import { z } from "zod";
import { FLIGHT_STATUSES } from "../../domain/entities/scheduled-flight.entity.ts";

export const changeFlightStatusSchema = z.object({ status: z.enum(FLIGHT_STATUSES) }).strict();
