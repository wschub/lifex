import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const queryClient = new QueryClient();

// El router y las páginas llegan en la Tarea 7; esto deja la app arrancando.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div id="app" />
    </QueryClientProvider>
  </StrictMode>,
);
