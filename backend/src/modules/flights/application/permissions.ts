import { definePermissions } from "../../../shared/permissions/permission.ts";

export const FLIGHTS_PERMISSION = {
  read: "flights:read",
  manage: "flights:manage",
} as const;

export const FLIGHTS_PERMISSIONS = definePermissions("flights", {
  [FLIGHTS_PERMISSION.read]: { es: "Ver vuelos", en: "View flights" },
  [FLIGHTS_PERMISSION.manage]: { es: "Gestionar vuelos", en: "Manage flights" },
});
