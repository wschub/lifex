import type { RequestHandler } from "express";
import { AppError } from "../../../../shared/errors/app-error.ts";
import type {
  ListAircraft,
  ListCustomers,
  ListPurchases,
} from "../../application/use-cases/backoffice.use-cases.ts";
import type { PurchaseStatus } from "../../domain/entities/backoffice.ts";
import { airportCode, dayAfter, dayStart, positiveInt, searchText } from "../query.ts";

export interface BackofficeControllerDeps {
  listAircraft: ListAircraft;
  listCustomers: ListCustomers;
  listPurchases: ListPurchases;
}

const STATUSES = ["ALL", "PAYMENT_PENDING", "CONFIRMED", "CANCELLED", "EXPIRED"] as const;

function purchaseStatus(value: unknown): PurchaseStatus | "ALL" | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !(STATUSES as readonly string[]).includes(value)) {
    throw new AppError("validation", { code: "INVALID_PURCHASE_STATUS" });
  }
  return value as PurchaseStatus | "ALL";
}

function emailFilter(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || value.length > 320) {
    throw new AppError("validation", { code: "INVALID_SEARCH" });
  }
  return value;
}

export function createBackofficeController(deps: BackofficeControllerDeps) {
  const aircraft: RequestHandler = async (_req, res) => {
    res.json({ aircraft: await deps.listAircraft.execute() });
  };

  const customers: RequestHandler = async (req, res) => {
    const result = await deps.listCustomers.execute({
      search: searchText(req.query.search),
      page: positiveInt(req.query.page, "INVALID_PAGE"),
      pageSize: positiveInt(req.query.pageSize, "INVALID_PAGE"),
    });
    res.json({
      customers: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  };

  const purchases: RequestHandler = async (req, res) => {
    const result = await deps.listPurchases.execute({
      search: searchText(req.query.search),
      status: purchaseStatus(req.query.status),
      email: emailFilter(req.query.email),
      createdFrom: dayStart(req.query.dateFrom),
      createdTo: dayAfter(req.query.dateTo),
      origin: airportCode(req.query.origin),
      destination: airportCode(req.query.destination),
      page: positiveInt(req.query.page, "INVALID_PAGE"),
      pageSize: positiveInt(req.query.pageSize, "INVALID_PAGE"),
    });
    res.json({
      purchases: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  };

  return { aircraft, customers, purchases };
}
