import type {
  AircraftRow,
  CustomerRow,
  PurchaseRow,
  PurchaseStatus,
} from "../../domain/entities/backoffice.ts";
import type { BackofficeRepository } from "../../domain/repositories/backoffice.repository.ts";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const clampPage = (page?: number): number => Math.max(1, Math.floor(page ?? 1));
const clampSize = (size?: number): number =>
  Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(size ?? DEFAULT_PAGE_SIZE)));
const clean = (text?: string): string | undefined => {
  const value = text?.trim();
  return value ? value : undefined;
};

export class ListAircraft {
  private readonly repository: BackofficeRepository;
  private readonly now: () => Date;

  constructor(deps: { repository: BackofficeRepository; now?: () => Date }) {
    this.repository = deps.repository;
    this.now = deps.now ?? (() => new Date());
  }

  execute(): Promise<AircraftRow[]> {
    return this.repository.listAircraft(this.now());
  }
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export class ListCustomers {
  private readonly repository: BackofficeRepository;

  constructor(deps: { repository: BackofficeRepository }) {
    this.repository = deps.repository;
  }

  async execute(options: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Paged<CustomerRow>> {
    const page = clampPage(options.page);
    const pageSize = clampSize(options.pageSize);
    const search = clean(options.search);
    const { rows, total } = await this.repository.listCustomers({
      ...(search ? { search } : {}),
      page,
      pageSize,
    });
    return { items: rows, page, pageSize, total };
  }
}

export class ListPurchases {
  private readonly repository: BackofficeRepository;

  constructor(deps: { repository: BackofficeRepository }) {
    this.repository = deps.repository;
  }

  /** Sin estado, las compras confirmadas (las pagadas). */
  async execute(options: {
    search?: string;
    status?: PurchaseStatus | "ALL";
    email?: string;
    createdFrom?: Date;
    createdTo?: Date;
    origin?: string;
    destination?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Paged<PurchaseRow>> {
    const page = clampPage(options.page);
    const pageSize = clampSize(options.pageSize);
    const search = clean(options.search);
    const status = options.status === "ALL" ? undefined : (options.status ?? "CONFIRMED");
    const { rows, total } = await this.repository.listPurchases({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(options.email ? { email: options.email } : {}),
      ...(options.createdFrom ? { createdFrom: options.createdFrom } : {}),
      ...(options.createdTo ? { createdTo: options.createdTo } : {}),
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.destination ? { destination: options.destination } : {}),
      page,
      pageSize,
    });
    return { items: rows, page, pageSize, total };
  }
}
