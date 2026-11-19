import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DashboardApp from "./app/admin/AdminApp.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DashboardApp />
  </StrictMode>,
);
