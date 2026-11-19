import {
  Globe,
  LayoutDashboard,
  LogOut,
  Luggage,
  Plane,
  PlaneTakeoff,
  Receipt,
  Users,
} from "lucide-react";
import { PERMISSION } from "@lifex/shared";
import { Link, useLocation, useNavigate } from "react-router";
import { logout } from "@/api/auth.ts";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar.tsx";
import { usePermission, useStaffSession } from "@/stores/staff-session.ts";
import { SidebarBrand } from "./SidebarBrand.tsx";

/** Secciones que solo ve el administrador. */
const ADMIN_ITEMS = [
  { to: "/flota", label: "Flota", Icon: PlaneTakeoff },
  { to: "/categorias", label: "Categorías y equipajes", Icon: Luggage },
  { to: "/clientes", label: "Clientes", Icon: Users },
  { to: "/compras", label: "Compras", Icon: Receipt },
] as const;

export function AppSidebar() {
  const me = useStaffSession((state) => state.me);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const here = pathname.replace(/\/$/, "") || "/";
  const onFlights = here === "/vuelos";
  const isAdmin = usePermission(PERMISSION.flightsManage);

  async function signOut() {
    await logout().catch(() => undefined);
    useStaffSession.getState().clear();
    await navigate("/login");
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={here === "/"} tooltip="Dashboard">
                  <Link to="/">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={onFlights} tooltip="Vuelos">
                  <Link to="/vuelos">
                    <Plane />
                    <span>Vuelos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                {/* Navegación completa: la web pública no comparte CSS con el panel. */}
                <SidebarMenuButton asChild tooltip="Ver sitio">
                  <a href={import.meta.env.VITE_WEB_URL || "/"}>
                    <Globe />
                    <span>Ver sitio</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_ITEMS.map(({ to, label, Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={here === to} tooltip={label}>
                      <Link to={to}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-0.5 px-2 text-sm group-data-[collapsible=icon]:hidden">
          <span className="truncate font-medium">
            {me?.user.firstName} {me?.user.lastName}
          </span>
          <span className="text-muted-foreground truncate text-xs">{me?.user.email}</span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Cerrar sesión" onClick={() => void signOut()}>
              <LogOut />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
