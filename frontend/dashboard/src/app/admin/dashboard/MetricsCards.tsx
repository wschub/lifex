import type { FlightMetrics, SeatCounts } from "@lifex/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { formatPercent, statusLabel } from "./status.ts";

const SEAT_STATES: { key: keyof SeatCounts; label: string }[] = [
  { key: "free", label: "Libres" },
  { key: "blocked", label: "Bloqueados" },
  { key: "paymentPending", label: "Pago pendiente" },
  { key: "reserved", label: "Reservados" },
];

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

/** Conteos reales de la tabla de asientos del vuelo seleccionado, por estado y por clase. */
export function MetricsCards({ metrics }: { metrics: FlightMetrics }) {
  return (
    <section aria-label="Métricas del vuelo" className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">
        {metrics.from} → {metrics.to} · {statusLabel(metrics.status)} · ocupación{" "}
        {formatPercent(metrics.occupancyRate)}
      </h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SEAT_STATES.map(({ key, label }) => (
          <CountCard key={key} label={label} value={metrics.seats[key]} />
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por clase</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {(["economy", "business"] as const).map((cabin) => (
            <div key={cabin} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{cabin === "economy" ? "Economy" : "Business"}</span>
              {SEAT_STATES.map(({ key, label }) => (
                <span key={key} className="text-muted-foreground flex justify-between">
                  {label}
                  <span className="text-foreground tabular-nums">
                    {metrics.byClass[cabin][key]}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
