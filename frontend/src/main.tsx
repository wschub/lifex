import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = createRoot(document.getElementById("root")!);

if (location.pathname === "/admin" || location.pathname.startsWith("/admin/")) {
  // El panel se carga aparte (con su Tailwind). Se llega a él con navegación completa desde la web.
  void import("./app/admin/AdminApp.tsx").then(({ default: AdminApp }) => {
    root.render(
      <StrictMode>
        <AdminApp />
      </StrictMode>,
    );
  });
} else {
  const queryClient = new QueryClient();
  // El router y las páginas públicas llegan en la Tarea 7; esto deja la app arrancando.
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <div id="app" />
      </QueryClientProvider>
    </StrictMode>,
  );
}
