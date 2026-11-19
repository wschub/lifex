import { Outlet } from "react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar.tsx";
import { AppSidebar } from "./AppSidebar.tsx";
import { SiteHeader } from "./SiteHeader.tsx";

export function AdminLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader title="Dashboard" />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
