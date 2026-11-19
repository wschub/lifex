import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { createQueryClient } from "@/api/query-client.ts";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { LoginPage } from "./login/LoginPage.tsx";
import "./styles/admin.css";

/**
 * Raíz del panel. Es el único lugar que importa `admin.css` (Tailwind): se carga en un trozo aparte y
 * a él se entra con navegación completa, así su CSS nunca convive con `lifex.css` de la web pública.
 */
export default function AdminApp() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/admin/login" element={<LoginPage />} />
            <Route path="/admin" element={<p>Panel (Tarea 13)</p>} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
