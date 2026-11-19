import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { PublicLayout } from "./public/PublicLayout.tsx";

const page = (load: () => Promise<Record<string, unknown>>, name: string) => async () => {
  const mod = await load();
  return { Component: mod[name] as React.ComponentType };
};

/** Rutas de la web pública (en inglés). El panel admin vive aparte y se abre con navegación completa. */
export const publicRoutes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: "/", lazy: page(() => import("./public/pages/Home.tsx"), "Home") },
      { path: "/results", lazy: page(() => import("./public/pages/Results.tsx"), "Results") },
      { path: "/fares", lazy: page(() => import("./public/pages/Fares.tsx"), "Fares") },
      { path: "/summary", lazy: page(() => import("./public/pages/Summary.tsx"), "Summary") },
      {
        path: "/passengers",
        lazy: page(() => import("./public/pages/Passengers.tsx"), "Passengers"),
      },
      { path: "/customize", lazy: page(() => import("./public/pages/Customize.tsx"), "Customize") },
      { path: "/seats", lazy: page(() => import("./public/pages/Seats.tsx"), "Seats") },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(publicRoutes);
