import { Outlet, useLocation } from "react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar.tsx";
import { AppSidebar } from "./AppSidebar.tsx";
import { SiteHeader } from "./SiteHeader.tsx";

const TITLES: Record<string, string> = { "/vuelos": "Vuelos" };

export function AdminLayout() {
  const { pathname } = useLocation();
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader title={TITLES[pathname.replace(/\/$/, "")] ?? "Dashboard"} />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
