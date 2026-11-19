import type { DashboardFlightRow, FlightStatus } from "@lifex/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { changeFlightStatus } from "@/api/dashboard.ts";
import { isApiError } from "@/api/errors.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import { MANUAL_STATUSES, NOTIFIES_PASSENGERS, STATUS_LABEL, statusLabel } from "./status.ts";

export function FlightStatusDialog({
  flight,
  token,
  onClose,
  onChanged,
}: {
  flight: DashboardFlightRow | null;
  token: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<FlightStatus | null>(null);

  const mutation = useMutation({
    mutationFn: (status: FlightStatus) => changeFlightStatus(flight!.flightId, status, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboardFlights"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboardFlight"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboardOverview"] });
      // El diálogo no se cierra solo: muestra a cuántas reservas se les envió el aviso.
      onChanged();
    },
  });

  function close() {
    setTarget(null);
    mutation.reset();
    onClose();
  }

  const options = MANUAL_STATUSES.filter((status) => status !== flight?.status);
  const notifies = target !== null && NOTIFIES_PASSENGERS.includes(target);
  const error = mutation.error;
  const reservations = flight?.reservations ?? 0;
  const sent = mutation.data?.flight.notifiedOrders;

  return (
    <Dialog open={flight !== null} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar estado del vuelo</DialogTitle>
          <DialogDescription>
            {flight ? `${flight.from} → ${flight.to} · hoy ${statusLabel(flight.status)}` : ""}
          </DialogDescription>
        </DialogHeader>
        {mutation.isSuccess ? (
          <div role="status" className="bg-muted rounded-md p-3 text-sm">
            <p className="font-medium">
              Estado actualizado a {statusLabel(mutation.data.flight.status)}.
            </p>
            <p className="text-muted-foreground mt-1">
              {NOTIFIES_PASSENGERS.includes(mutation.data.flight.status)
                ? sent
                  ? `Se envió el aviso por correo a ${sent} ${sent === 1 ? "reserva pagada" : "reservas pagadas"} de este vuelo.`
                  : "Este vuelo no tiene reservas pagadas: no se envió ningún correo."
                : "Este cambio no envía correos."}
            </p>
          </div>
        ) : null}
        <RadioGroup
          hidden={mutation.isSuccess}
          value={target ?? ""}
          onValueChange={(value) => setTarget(value as FlightStatus)}
          className="gap-3"
        >
          {options.map((status) => (
            <div key={status} className="flex items-center gap-2">
              <RadioGroupItem value={status} id={`status-${status}`} />
              <Label htmlFor={`status-${status}`}>{STATUS_LABEL[status]}</Label>
            </div>
          ))}
        </RadioGroup>
        {notifies && !mutation.isSuccess ? (
          <p className="bg-muted rounded-md p-3 text-sm">
            {reservations > 0
              ? `Se enviará un correo a las ${reservations} ${reservations === 1 ? "reserva pagada" : "reservas pagadas"} de este vuelo (cada cambio de estado envía un aviso).`
              : "Este vuelo no tiene reservas pagadas: no se enviará ningún correo."}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {isApiError(error) ? error.message : "No se pudo cambiar el estado."}
          </p>
        ) : null}
        <DialogFooter>
          {mutation.isSuccess ? (
            <Button onClick={close}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button
                disabled={target === null || mutation.isPending}
                onClick={() => target && mutation.mutate(target)}
              >
                Confirmar cambio
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
