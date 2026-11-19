import { definePermissions } from "../../../shared/permissions/permission.ts";

export const DASHBOARD_PERMISSION = {
  read: "dashboard:read",
} as const;

export const DASHBOARD_PERMISSIONS = definePermissions("dashboard", {
  [DASHBOARD_PERMISSION.read]: {
    es: "Ver el dashboard de vuelos",
    en: "View the flights dashboard",
  },
});
