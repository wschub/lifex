import { createBrowserRouter, Navigate, type RouteObject } from "react-router";
import { RouteError } from "./RouteError.tsx";
import { PublicLayout } from "./public/PublicLayout.tsx";

const page = (load: () => Promise<Record<string, unknown>>, name: string) => async () => {
  const mod = await load();
  return { Component: mod[name] as React.ComponentType };
};

/** Rutas de la web pública (en inglés). El dashboard (login + panel) vive aparte, en /dashboard, y se abre con navegación completa. */
export const publicRoutes: RouteObject[] = [
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
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
      { path: "/payment", lazy: page(() => import("./public/pages/Payment.tsx"), "Payment") },
      {
        path: "/confirmation",
        lazy: page(() => import("./public/pages/Confirmation.tsx"), "Confirmation"),
      },
      { path: "/credits", lazy: page(() => import("./public/pages/Credits.tsx"), "Credits") },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(publicRoutes);
