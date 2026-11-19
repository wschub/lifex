import type {
  AircraftRow,
  CustomerRow,
  PurchaseRow,
  PurchaseStatus,
} from "../entities/backoffice.ts";

export interface Page<T> {
  rows: T[];
  /** Total que cumple los filtros (todas las páginas). */
  total: number;
}

export interface CustomerQuery {
  /** Busca en nombre, correo o teléfono. */
  search?: string;
  page: number;
  pageSize: number;
}

export interface PurchaseQuery {
  /** Busca en reserva, correo, teléfono o nombre de un pasajero. */
  search?: string;
  status?: PurchaseStatus;
  /** Correo exacto del cliente (las compras de un cliente). */
  email?: string;
  /** Compras hechas desde (incluida) y hasta (excluida). */
  createdFrom?: Date;
  createdTo?: Date;
  /** Códigos IATA del vuelo comprado. */
  origin?: string;
  destination?: string;
  page: number;
  pageSize: number;
}

/** Lecturas de administración: flota, clientes y compras. */
export interface BackofficeRepository {
  listAircraft(now: Date): Promise<AircraftRow[]>;
  listCustomers(query: CustomerQuery): Promise<Page<CustomerRow>>;
  listPurchases(query: PurchaseQuery): Promise<Page<PurchaseRow>>;
}
