import type { DashboardOverview } from "@lifex/shared";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Tooltip as ChartTooltip } from "recharts";
import { dashboardOverviewQuery } from "@/api/queries.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useStaffSession } from "@/stores/staff-session.ts";
import { formatPercent, statusLabel } from "../dashboard/status.ts";
import { ChartBox } from "./ChartBox.tsx";

const COLORS = {
  domestic: "#334155",
  international: "#C8102E",
  economy: "#334155",
  business: "#C8102E",
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "#1B7A45",
  DELAYED: "#B7791F",
  CANCELLED: "#C53030",
  SOLD_OUT: "#64748B",
  FINALIZED: "#94A3B8",
};

const integer = new Intl.NumberFormat("es-CO");
const usd = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </CardHeader>
    </Card>
  );
}

/** Indicadores y gráficas de los vuelos que salen en el día elegido. */
export function OverviewSection({ date }: { date: string }) {
  const token = useStaffSession((state) => state.accessToken) ?? "";
  const query = useQuery({ ...dashboardOverviewQuery(date, token), enabled: token !== "" });

  if (query.isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        No se pudo cargar el resumen del día. {query.error.message}
      </p>
    );
  }
  if (!query.data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-busy="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
    );
  }
  return <OverviewContent overview={query.data.overview} />;
}

export function OverviewContent({ overview }: { overview: DashboardOverview }) {
  const { flights, seats, sales } = overview;
  const status = Object.entries(flights.byStatus).map(([key, value]) => ({
    key,
    name: statusLabel(key),
    value,
  }));
  const occupancy = [
    { name: "Nacionales", value: seats.byRouteType.domestic.occupancyRate, fill: COLORS.domestic },
    {
      name: "Internacionales",
      value: seats.byRouteType.international.occupancyRate,
      fill: COLORS.international,
    },
    { name: "Economy", value: seats.byClass.economy.occupancyRate, fill: COLORS.economy },
    { name: "Business", value: seats.byClass.business.occupancyRate, fill: COLORS.business },
  ];
  const hours = overview.byHour.filter((item) => item.domestic + item.international > 0);

  return (
    <section aria-label="Resumen del día" className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Kpi
          label="Vuelos del día"
          value={integer.format(flights.total)}
          hint={`${integer.format(flights.domestic)} nacionales · ${integer.format(flights.international)} internacionales`}
        />
        <Kpi
          label="Ocupación"
          value={formatPercent(seats.occupancyRate)}
          hint={`${integer.format(seats.sold)} de ${integer.format(seats.total)} asientos`}
        />
        <Kpi
          label="Tickets vendidos"
          value={integer.format(sales.ticketsSold)}
          hint={`${integer.format(seats.available)} asientos disponibles`}
        />
        <Kpi
          label="Ingresos"
          value={`USD ${usd.format(sales.revenueUsd)}`}
          hint="Reservas pagadas de estos vuelos"
        />
        <Kpi
          label="Con novedades"
          value={integer.format(overview.disruptions)}
          hint="Cancelados o retrasados"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Vuelos por hora</CardTitle>
            <CardDescription>Salidas del día, hora de Colombia</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartBox label="Vuelos por hora de salida, nacionales e internacionales">
              <BarChart data={hours} margin={{ left: -16, right: 4 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={(hour: number) => `${hour}h`} fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <ChartTooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="domestic" name="Nacionales" stackId="a" fill={COLORS.domestic} />
                <Bar
                  dataKey="international"
                  name="Internacionales"
                  stackId="a"
                  fill={COLORS.international}
                />
              </BarChart>
            </ChartBox>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ocupación</CardTitle>
            <CardDescription>Asientos vendidos por tipo de ruta y clase (%)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartBox label="Ocupación por tipo de ruta y por clase">
              <BarChart data={occupancy} layout="vertical" margin={{ left: 16, right: 56 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} unit="%" fontSize={12} />
                <YAxis type="category" dataKey="name" width={104} fontSize={12} />
                <ChartTooltip formatter={(value) => `${formatPercent(Number(value))}`} />
                <Bar dataKey="value" name="Ocupación" radius={4}>
                  {occupancy.map((item) => (
                    <Cell key={item.name} fill={item.fill} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    fontSize={12}
                    formatter={(value) => formatPercent(Number(value))}
                  />
                </Bar>
              </BarChart>
            </ChartBox>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vuelos por estado</CardTitle>
            <CardDescription>
              Cómo están hoy los {integer.format(flights.total)} vuelos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartBox label="Vuelos por estado">
              <PieChart>
                <Pie data={status} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84}>
                  {status.map((item) => (
                    <Cell key={item.key} fill={STATUS_COLOR[item.key] ?? "#94A3B8"} />
                  ))}
                </Pie>
                <ChartTooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ChartBox>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
