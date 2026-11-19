import { PrismaPg } from "@prisma/adapter-pg";
import pino from "pino";
import { createApp } from "./app.ts";
import type { Env } from "./config/env.ts";
import { PrismaClient } from "./generated/prisma/client.ts";
import { AuthenticateUser } from "./modules/auth/application/use-cases/authenticate-user.use-case.ts";
import { IssueSession } from "./modules/auth/application/use-cases/issue-session.use-case.ts";
import type { PasswordResetNotifier } from "./modules/auth/application/ports/password-reset-notifier.ts";
import { PurgeExpiredPasswordResets } from "./modules/auth/application/use-cases/purge-expired-password-resets.use-case.ts";
import { PurgeExpiredRefreshTokens } from "./modules/auth/application/use-cases/purge-expired-refresh-tokens.use-case.ts";
import { RefreshSession } from "./modules/auth/application/use-cases/refresh-session.use-case.ts";
import { RegisterUser } from "./modules/auth/application/use-cases/register-user.use-case.ts";
import { RequestPasswordReset } from "./modules/auth/application/use-cases/request-password-reset.use-case.ts";
import { ResetPassword } from "./modules/auth/application/use-cases/reset-password.use-case.ts";
import { RevokeSession } from "./modules/auth/application/use-cases/revoke-session.use-case.ts";
import { PrismaPasswordResetRepository } from "./modules/auth/infrastructure/database/prisma-password-reset.repository.ts";
import { PrismaRefreshTokenRepository } from "./modules/auth/infrastructure/database/prisma-refresh-token.repository.ts";
import { LogPasswordResetNotifier } from "./modules/auth/infrastructure/notifications/log-password-reset-notifier.ts";
import { Argon2PasswordHasher } from "./modules/auth/infrastructure/security/argon2-password-hasher.ts";
import { JoseAccessTokenService } from "./modules/auth/infrastructure/security/jose-access-token-service.ts";
import { createAuthRouter } from "./modules/auth/presentation/routes/auth.routes.ts";
import { createPasswordRouter } from "./modules/auth/presentation/routes/password.routes.ts";
import { createSessionRouter } from "./modules/auth/presentation/routes/session.routes.ts";
import { PrismaReadinessProbe } from "./modules/health/infrastructure/database/prisma-readiness-probe.ts";
import { PrismaUserRepository } from "./modules/users/infrastructure/database/prisma-user.repository.ts";
import { AUTH_PERMISSIONS } from "./modules/auth/application/permissions.ts";
import { AssignUserRoles } from "./modules/auth/application/use-cases/assign-user-roles.use-case.ts";
import { CreateSuperAdmin } from "./modules/auth/application/use-cases/create-super-admin.use-case.ts";
import { GetUserAccess } from "./modules/auth/application/use-cases/get-user-access.use-case.ts";
import { ManageRoles } from "./modules/auth/application/use-cases/manage-roles.use-case.ts";
import { ProtectSuperAdmins } from "./modules/auth/application/use-cases/protect-super-admins.use-case.ts";
import { PrismaRoleRepository } from "./modules/auth/infrastructure/database/prisma-role.repository.ts";
import {
  authenticatedUser,
  requireAuth,
} from "./modules/auth/presentation/middlewares/require-auth.ts";
import { createPermissionGuard } from "./modules/auth/presentation/middlewares/require-permission.ts";
import { createRolesRouter } from "./modules/auth/presentation/routes/roles.routes.ts";
import { USERS_PERMISSIONS } from "./modules/users/application/permissions.ts";
import { ChangeUserStatus } from "./modules/users/application/use-cases/change-user-status.use-case.ts";
import { GetUser } from "./modules/users/application/use-cases/get-user.use-case.ts";
import { ListUsers } from "./modules/users/application/use-cases/list-users.use-case.ts";
import { createUsersRouter } from "./modules/users/presentation/routes/users.routes.ts";
import { PermissionRegistry } from "./shared/permissions/permission.ts";
import { GetBooking } from "./modules/bookings/application/use-cases/get-booking.use-case.ts";
import { SetPassengers } from "./modules/bookings/application/use-cases/set-passengers.use-case.ts";
import { StartBooking } from "./modules/bookings/application/use-cases/start-booking.use-case.ts";
import { PrismaOrderRepository } from "./modules/bookings/infrastructure/database/prisma-order.repository.ts";
import {
  requireBookingOwner,
  requireGuest,
} from "./modules/bookings/presentation/middlewares/require-guest.ts";
import { createBookingsRouter } from "./modules/bookings/presentation/routes/bookings.routes.ts";
import {
  GetPublicConfig,
  ListCities,
  ListCountries,
  ListLuggageTypes,
} from "./modules/catalog/application/use-cases/catalog.use-cases.ts";
import { PrismaCatalogRepository } from "./modules/catalog/infrastructure/database/prisma-catalog.repository.ts";
import { createCatalogRouter } from "./modules/catalog/presentation/routes/catalog.routes.ts";
import {
  DASHBOARD_PERMISSION,
  DASHBOARD_PERMISSIONS,
} from "./modules/dashboard/application/permissions.ts";
import {
  GetDashboardOverview,
  GetFlightDashboard,
  ListDashboardFlights,
  ListFlightPassengers,
  SetPassengerCheckIn,
} from "./modules/dashboard/application/use-cases/dashboard.use-cases.ts";
import {
  ListAircraft,
  ListCustomers,
  ListPurchases,
} from "./modules/dashboard/application/use-cases/backoffice.use-cases.ts";
import { PrismaBackofficeRepository } from "./modules/dashboard/infrastructure/database/prisma-backoffice.repository.ts";
import { createBackofficeRouter } from "./modules/dashboard/presentation/routes/backoffice.routes.ts";
import { PrismaDashboardRepository } from "./modules/dashboard/infrastructure/database/prisma-dashboard.repository.ts";
import { createDashboardRouter } from "./modules/dashboard/presentation/routes/dashboard.routes.ts";
import { FLIGHTS_PERMISSIONS } from "./modules/flights/application/permissions.ts";
import { ChangeFlightStatus } from "./modules/flights/application/use-cases/change-flight-status.use-case.ts";
import { GetFlight } from "./modules/flights/application/use-cases/get-flight.use-case.ts";
import { ListOfferFlights } from "./modules/flights/application/use-cases/list-offer-flights.use-case.ts";
import { SearchFlights } from "./modules/flights/application/use-cases/search-flights.use-case.ts";
import { PrismaScheduledFlightRepository } from "./modules/flights/infrastructure/database/prisma-scheduled-flight.repository.ts";
import { createFlightsRouter } from "./modules/flights/presentation/routes/flights.routes.ts";
import { GetSeatMap } from "./modules/inventory/application/use-cases/get-seat-map.use-case.ts";
import { HoldSeat } from "./modules/inventory/application/use-cases/hold-seat.use-case.ts";
import { ReleaseExpiredHolds } from "./modules/inventory/application/use-cases/release-expired-holds.use-case.ts";
import { ReleaseSeat } from "./modules/inventory/application/use-cases/release-seat.use-case.ts";
import { PrismaSeatRepository } from "./modules/inventory/infrastructure/database/prisma-seat.repository.ts";
import { createSeatsRouter } from "./modules/inventory/presentation/routes/seats.routes.ts";
import type { PaymentGatewayPort } from "./modules/payments/application/ports/payment-gateway.ts";
import { ProcessPaymentRequest } from "./modules/payments/application/use-cases/process-payment-request.use-case.ts";
import { RequestPayment } from "./modules/payments/application/use-cases/request-payment.use-case.ts";
import { PrismaPaymentRepository } from "./modules/payments/infrastructure/database/prisma-payment.repository.ts";
import { FakePaymentGateway } from "./modules/payments/infrastructure/gateway/fake-payment-gateway.ts";
import { createPaymentsRouter } from "./modules/payments/presentation/routes/payments.routes.ts";
import { BroadcastFlightEvent } from "./modules/realtime/application/use-cases/broadcast-flight-event.use-case.ts";
import {
  type OutboxHandler,
  ProcessOutbox,
} from "./modules/realtime/application/use-cases/process-outbox.use-case.ts";
import { PrismaOutboxRepository } from "./modules/realtime/infrastructure/database/prisma-outbox.repository.ts";
import { WsGateway } from "./modules/realtime/infrastructure/ws/ws-gateway.ts";
import type { NotificationPort } from "./modules/tickets/application/ports/notification.port.ts";
import { IssueTickets } from "./modules/tickets/application/use-cases/issue-tickets.use-case.ts";
import { ListOrderTickets } from "./modules/tickets/application/use-cases/list-order-tickets.use-case.ts";
import { GetTicketQr } from "./modules/tickets/application/use-cases/get-ticket-qr.use-case.ts";
import { SendFlightDisruptionEmail } from "./modules/tickets/application/use-cases/send-flight-disruption-email.use-case.ts";
import { SendTicketConfirmation } from "./modules/tickets/application/use-cases/send-ticket-confirmation.use-case.ts";
import { PrismaTicketRepository } from "./modules/tickets/infrastructure/database/prisma-ticket.repository.ts";
import { BrevoNotificationAdapter } from "./modules/tickets/infrastructure/notifications/brevo-notification.adapter.ts";
import { LogNotificationAdapter } from "./modules/tickets/infrastructure/notifications/log-notification.adapter.ts";
import { QrcodeGenerator } from "./modules/tickets/infrastructure/qr/qrcode-generator.ts";
import { createTicketsRouter } from "./modules/tickets/presentation/routes/tickets.routes.ts";
import { FLIGHT_EVENT, INTERNAL_EVENT } from "./shared/outbox/flight-events.ts";
// start-stack:imports

/** El código de 6 dígitos caduca antes que el enlace: es más fácil de adivinar. */
const MAX_RESET_CODE_SECONDS = 10 * 60;

/** Raíz de composición: el único lugar donde se conectan los adaptadores con los casos de uso. */
export interface CompositionOverrides {
  /** Sustituye al adaptador que escribe en el log (por ejemplo, por uno que envíe correo). */
  passwordResetNotifier?: PasswordResetNotifier;
  /** Sustituye la pasarela de pago simulada (por ejemplo, por una real o por un doble de pruebas). */
  paymentGateway?: PaymentGatewayPort;
  /** Sustituye al adaptador del correo del ticket (Brevo, o el log si no hay API key). */
  notifier?: NotificationPort;
  /** Reloj inyectable para las pruebas de expiración. */
  now?: () => Date;
  /** Aleatoriedad inyectable (0 ≤ n < 1) para elegir las ofertas en las pruebas. */
  random?: () => number;
}

export function composeApp(env: Env, overrides: CompositionOverrides = {}) {
  const logger = pino({ level: env.LOG_LEVEL });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

  const users = new PrismaUserRepository(prisma);
  const refreshTokens = new PrismaRefreshTokenRepository(prisma);
  const passwordResets = new PrismaPasswordResetRepository(prisma);
  const hasher = new Argon2PasswordHasher();
  const accessTokens = new JoseAccessTokenService({
    secret: env.JWT_ACCESS_SECRET,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    ttlSeconds: env.ACCESS_TOKEN_EXPIRATION_TIME,
  });

  // Catálogo de permisos: cada módulo declara los suyos y aquí se reúnen. Un módulo nuevo solo
  // tiene que añadir su lista para que aparezca en la gestión de roles.
  const permissions = new PermissionRegistry([
    ...AUTH_PERMISSIONS,
    ...USERS_PERMISSIONS,
    ...FLIGHTS_PERMISSIONS,
    ...DASHBOARD_PERMISSIONS,
    // start-stack:permissions
  ]);
  const roles = new PrismaRoleRepository(prisma);
  const getUserAccess = new GetUserAccess({ roles, registry: permissions });
  const authenticate = requireAuth({ accessTokens, users });
  const authorize = createPermissionGuard({ registry: permissions, getUserAccess });

  const issueSession = new IssueSession({
    tokens: refreshTokens,
    accessTokens,
    refreshTtlSeconds: env.REFRESH_TOKEN_EXPIRATION_TIME,
  });
  const refreshCookie = {
    secure: env.NODE_ENV === "production",
    sameSite: env.COOKIE_SAME_SITE,
  } as const;

  const authRouter = createAuthRouter({
    registerUser: new RegisterUser({ users, hasher }),
    authenticateUser: new AuthenticateUser({ users, hasher }),
    issueSession,
    getUserAccess,
    accessTokens,
    users,
    publicRegistration: env.PUBLIC_REGISTRATION,
    refreshCookie,
  });
  const sessionRouter = createSessionRouter({
    refreshSession: new RefreshSession({ tokens: refreshTokens, users, issueSession }),
    revokeSession: new RevokeSession({ tokens: refreshTokens }),
    refreshCookie,
    allowedOrigins: env.CORS_ORIGINS,
  });

  const passwordRouter = createPasswordRouter({
    requestPasswordReset: new RequestPasswordReset({
      users,
      resets: passwordResets,
      // Adaptador de desarrollo: escribe el enlace o el código en el log. Sustitúyelo por uno
      // que envíe correo antes de salir a producción (allí no revela nada).
      notifier:
        overrides.passwordResetNotifier ??
        new LogPasswordResetNotifier({
          logger,
          resetUrl: env.PASSWORD_RESET_URL,
          revealSecret: env.NODE_ENV !== "production",
        }),
      linkTtlSeconds: env.PASSWORD_RESET_EXPIRATION_TIME,
      codeTtlSeconds: Math.min(env.PASSWORD_RESET_EXPIRATION_TIME, MAX_RESET_CODE_SECONDS),
    }),
    resetPassword: new ResetPassword({ users, resets: passwordResets, refreshTokens, hasher }),
  });

  const rolesRouter = createRolesRouter({
    authenticate,
    authorize,
    registry: permissions,
    manageRoles: new ManageRoles({ roles, registry: permissions }),
    getUserAccess,
    assignUserRoles: new AssignUserRoles({ users, roles, getUserAccess }),
    users,
  });
  const usersRouter = createUsersRouter({
    authenticate,
    authorize,
    currentUserId: (res) => authenticatedUser(res).publicId,
    listUsers: new ListUsers({ users }),
    getUser: new GetUser({ users }),
    changeUserStatus: new ChangeUserStatus({
      users,
      guard: new ProtectSuperAdmins({ getUserAccess }),
    }),
  });

  // ── Dominio de reservas de vuelos ──
  const clock = overrides.now ?? (() => new Date());
  const catalog = new PrismaCatalogRepository(prisma);
  const flights = new PrismaScheduledFlightRepository(prisma);
  const seats = new PrismaSeatRepository(prisma);
  const orders = new PrismaOrderRepository(prisma);
  const paymentRepository = new PrismaPaymentRepository(prisma);
  const ticketRepository = new PrismaTicketRepository(prisma);
  const dashboard = new PrismaDashboardRepository(prisma);
  const outbox = new PrismaOutboxRepository(prisma);

  // La sesión de invitado es otro JWT, con otra audiencia: un token de staff no sirve como sesión de
  // reserva ni al revés.
  const guestTokens = new JoseAccessTokenService({
    secret: env.JWT_ACCESS_SECRET,
    issuer: env.JWT_ISSUER,
    audience: `${env.JWT_AUDIENCE}-guest`,
    ttlSeconds: env.BOOKING_TOKEN_EXPIRATION_TIME,
  });
  const authenticateGuest = requireGuest({ guestTokens });
  const authenticateBooking = requireBookingOwner({ guestTokens });

  const paymentGateway = overrides.paymentGateway ?? new FakePaymentGateway();
  const notifier =
    overrides.notifier ??
    (env.BREVO_API_KEY
      ? new BrevoNotificationAdapter({
          apiKey: env.BREVO_API_KEY,
          senderEmail: env.BREVO_SENDER_EMAIL,
          senderName: env.BREVO_SENDER_NAME,
          publicApiUrl: env.PUBLIC_API_URL,
          appUrl: env.APP_URL,
          usdToCop: env.IATA_TRM,
        })
      : new LogNotificationAdapter((message: string, fields: Record<string, unknown>) => {
          logger.warn(fields, message);
        }));

  /** Reglas del precio dinámico y de las ofertas (leídas del entorno solo aquí). */
  const pricing = {
    businessBaseMultiplier: env.BUSINESS_BASE_MULTIPLIER,
    offerDiscountPercentage: env.OFFER_DISCOUNT_PERCENTAGE,
  };

  const holdSeat = new HoldSeat({
    seats,
    pricing,
    lockMinutes: env.MAX_SEAT_LOCK_TIME,
    maxHeldPerSession: env.MAX_HELD_SEATS_PER_SESSION,
    now: clock,
  });
  const releaseExpiredHolds = new ReleaseExpiredHolds({ seats, now: clock });

  const catalogRouter = createCatalogRouter({
    listCountries: new ListCountries({ catalog }),
    listCities: new ListCities({ catalog }),
    listLuggageTypes: new ListLuggageTypes({ catalog }),
    getPublicConfig: new GetPublicConfig({
      config: {
        iataTrm: env.IATA_TRM,
        taxPercentage: env.TAX_PERCENTAGE,
        maxSeatLockMinutes: env.MAX_SEAT_LOCK_TIME,
        idleTimeoutMinutes: env.WEB_IDLE_TIMEOUT_MINUTES,
        maxHeldSeatsPerSession: env.MAX_HELD_SEATS_PER_SESSION,
      },
    }),
  });
  const flightsRouter = createFlightsRouter({
    authenticate,
    authorize,
    searchFlights: new SearchFlights({ flights, pricing, now: clock }),
    getFlight: new GetFlight({ flights, pricing, now: clock }),
    listOfferFlights: new ListOfferFlights({
      flights,
      pricing,
      now: clock,
      ...(overrides.random ? { random: overrides.random } : {}),
    }),
    changeFlightStatus: new ChangeFlightStatus({ flights }),
  });
  const seatsRouter = createSeatsRouter({
    authenticateGuest,
    holdSeat,
    releaseSeat: new ReleaseSeat({ seats }),
    getSeatMap: new GetSeatMap({ seats, pricing, now: clock }),
  });
  const bookingsRouter = createBookingsRouter({
    authenticateBooking,
    startBooking: new StartBooking({
      orders,
      flights,
      guestTokens,
      ttlSeconds: env.BOOKING_TOKEN_EXPIRATION_TIME,
      now: clock,
    }),
    setPassengers: new SetPassengers({
      orders,
      seats,
      catalog,
      taxPercentage: env.TAX_PERCENTAGE,
      maxPassengers: env.MAX_HELD_SEATS_PER_SESSION,
      now: clock,
    }),
    getBooking: new GetBooking({ orders }),
  });
  const paymentsRouter = createPaymentsRouter({
    authenticateBooking,
    fingerprintSecret: env.JWT_ACCESS_SECRET,
    requestPayment: new RequestPayment({
      payments: paymentRepository,
      gateway: paymentGateway,
      now: clock,
    }),
  });
  const ticketsRouter = createTicketsRouter({
    authenticateBooking,
    listOrderTickets: new ListOrderTickets({ tickets: ticketRepository }),
    getTicketQr: new GetTicketQr({ tickets: ticketRepository, qr: new QrcodeGenerator() }),
  });
  const backofficeRepository = new PrismaBackofficeRepository(prisma);
  const backofficeRouter = createBackofficeRouter({
    authenticate,
    authorize,
    listAircraft: new ListAircraft({ repository: backofficeRepository, now: clock }),
    listCustomers: new ListCustomers({ repository: backofficeRepository }),
    listPurchases: new ListPurchases({ repository: backofficeRepository }),
  });
  const dashboardRouter = createDashboardRouter({
    authenticate,
    authorize,
    getFlightDashboard: new GetFlightDashboard({ dashboard }),
    listDashboardFlights: new ListDashboardFlights({ dashboard, now: clock }),
    getDashboardOverview: new GetDashboardOverview({ dashboard, now: clock }),
    listFlightPassengers: new ListFlightPassengers({ dashboard }),
    setPassengerCheckIn: new SetPassengerCheckIn({ dashboard, now: clock }),
  });

  // Tiempo real: el WebSocket se suscribe a temas; los de dashboard exigen el permiso dashboard:read.
  const realtime = new WsGateway({
    authorize: async (topic, token) => {
      if (!topic.startsWith("dashboard:")) return true;
      if (!token) return false;
      try {
        const { subject } = await accessTokens.verify(token);
        const user = await users.findByPublicId(subject);
        if (!user?.isActive()) return false;
        const access = await getUserAccess.execute(user.publicId);
        return access.permissions.includes(DASHBOARD_PERMISSION.read);
      } catch {
        return false;
      }
    },
    onError: (error) => logger.warn({ err: error }, "websocket error"),
  });

  // Outbox: cada tipo de evento tiene su manejador. Los eventos de vuelo se difunden por WebSocket;
  // PaymentRequested cobra; TicketEmailRequested envía el correo (un fallo allí se reintenta solo).
  const broadcast = new BroadcastFlightEvent({ broadcaster: realtime });
  const processPaymentRequest = new ProcessPaymentRequest({
    payments: paymentRepository,
    gateway: paymentGateway,
    issueTickets: new IssueTickets(),
  });
  const sendTicketConfirmation = new SendTicketConfirmation({
    tickets: ticketRepository,
    notifier,
  });
  const sendDisruptionEmail = new SendFlightDisruptionEmail({
    tickets: ticketRepository,
    notifier,
  });
  const handlers: Record<string, OutboxHandler> = {
    [INTERNAL_EVENT.paymentRequested]: (event, context) =>
      processPaymentRequest.execute(
        {
          paymentId: String(event.payload.paymentId),
          gatewayToken: String(event.payload.gatewayToken),
        },
        context,
      ),
    [INTERNAL_EVENT.ticketEmailRequested]: (event) =>
      sendTicketConfirmation.execute(
        String(event.payload.orderId),
        String(event.payload.ticketCode),
      ),
    [INTERNAL_EVENT.flightDisruptionEmailRequested]: (event) =>
      sendDisruptionEmail.execute(
        String(event.payload.orderId),
        event.payload.status === "CANCELLED" ? "CANCELLED" : "DELAYED",
      ),
  };
  for (const eventType of Object.values(FLIGHT_EVENT)) {
    handlers[eventType] = (event) => broadcast.handle(event);
  }
  const processOutbox = new ProcessOutbox({
    outbox,
    handlers,
    maxAttempts: env.OUTBOX_MAX_ATTEMPTS,
    now: clock,
    onError: (error, event) =>
      logger.warn(
        { err: error, eventType: event.eventType, eventId: event.id },
        "outbox event failed",
      ),
  });

  // start-stack:wiring

  const app = createApp({
    readinessProbes: [new PrismaReadinessProbe(prisma)],
    routers: [
      authRouter,
      sessionRouter,
      passwordRouter,
      rolesRouter,
      usersRouter,
      catalogRouter,
      flightsRouter,
      seatsRouter,
      bookingsRouter,
      paymentsRouter,
      ticketsRouter,
      dashboardRouter,
      backofficeRouter,
      // start-stack:routers
    ],
    corsOrigins: env.CORS_ORIGINS,
    trustProxy: env.TRUST_PROXY,
    logger,
  });

  return {
    app,
    logger,
    shutdown: () => prisma.$disconnect(),
    purgeExpiredTokens: new PurgeExpiredRefreshTokens({ tokens: refreshTokens }),
    createSuperAdmin: new CreateSuperAdmin({ users, roles, hasher }),
    purgeExpiredPasswordResets: new PurgeExpiredPasswordResets({ resets: passwordResets }),
    realtime,
    processOutbox,
    releaseExpiredHolds,
    // start-stack:returns
  };
}
