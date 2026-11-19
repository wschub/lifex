import type { ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

/** Contenedor de una gráfica con alto fijo y etiqueta accesible (las gráficas son SVG). */
export function ChartBox({ label, children }: { label: string; children: ReactElement }) {
  return (
    <div role="img" aria-label={label} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
