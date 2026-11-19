import { useQuery } from "@tanstack/react-query";
import { luggageTypesQuery } from "@/api/queries.ts";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";

const CABINS = [
  {
    name: "Economy",
    detail:
      "Cabina principal: asientos en filas de 3-3-3 (o 3-3 en aviones nacionales y regionales).",
  },
  {
    name: "Business",
    detail:
      "Asientos con más espacio: 1-2-1. Solo en esta cabina se pueden elegir las tarifas Business.",
  },
] as const;

/**
 * Categorías y equipajes (solo visualización): las dos cabinas y las tarifas de equipaje, con su recargo sobre
 * el precio del asiento y en qué cabina se pueden elegir.
 */
export function CategoriesPage() {
  const query = useQuery(luggageTypesQuery());
  const types = [...(query.data?.luggageTypes ?? [])].sort((a, b) => a.rank - b.rank);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Categorías y equipajes</h2>
        <p className="text-muted-foreground text-sm">
          Cabinas y tarifas de equipaje. Por ahora es solo de consulta.
        </p>
      </div>

      <section aria-label="Cabinas" className="grid gap-4 sm:grid-cols-2">
        {CABINS.map((cabin) => (
          <Card key={cabin.name}>
            <CardHeader>
              <CardDescription>Cabina</CardDescription>
              <CardTitle className="text-xl">{cabin.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">{cabin.detail}</CardContent>
          </Card>
        ))}
      </section>

      <section aria-label="Tarifas y equipaje" className="flex flex-col gap-3">
        <div>
          <h3 className="text-lg font-medium">Tarifas y equipaje</h3>
          <p className="text-muted-foreground text-sm">
            El recargo se calcula como un porcentaje del precio del asiento y se suma al total.
          </p>
        </div>
        {query.isError ? (
          <p role="alert" className="text-destructive text-sm">
            No se pudieron cargar las tarifas. {query.error.message}
          </p>
        ) : null}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Orden</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Nombre en español</TableHead>
                <TableHead>Disponible en</TableHead>
                <TableHead className="text-right">Recargo sobre el asiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground h-20 text-center">
                    {query.data === undefined ? "Cargando tarifas…" : "No hay tarifas registradas."}
                  </TableCell>
                </TableRow>
              ) : (
                types.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="tabular-nums">{type.rank}</TableCell>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>{type.nameEs}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {type.businessOnly ? "Solo Business" : "Economy y Business"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {type.feePercentage} %
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
