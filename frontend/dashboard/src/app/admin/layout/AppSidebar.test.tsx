import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar.tsx";
import { makeMe, stubMatchMedia } from "@/test/admin-fixtures.ts";
import { useStaffSession } from "@/stores/staff-session.ts";
import { AppSidebar } from "./AppSidebar.tsx";

function renderSidebar(defaultOpen: boolean, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  stubMatchMedia(false);
  useStaffSession.getState().setSession("t", makeMe(["dashboard:read"]), 900);
});

describe("AppSidebar", () => {
  it("shows the horizontal logo when the sidebar is open", () => {
    renderSidebar(true);
    expect(screen.getByAltText("lifex")).toHaveAttribute(
      "src",
      `${import.meta.env.BASE_URL}logo/lifex-horizontal.svg`,
    );
    expect(screen.queryByAltText("lifex (icono)")).not.toBeInTheDocument();
  });

  it("shows only the icon when the sidebar is collapsed", () => {
    renderSidebar(false);
    expect(screen.getByAltText("lifex (icono)")).toHaveAttribute(
      "src",
      `${import.meta.env.BASE_URL}logo/lifex-icon.svg`,
    );
    expect(screen.queryByAltText("lifex")).not.toBeInTheDocument();
  });

  it("shows the staff member and no sample content", () => {
    renderSidebar(true);
    expect(screen.getByText("viewer@lifex.test")).toBeInTheDocument();
    expect(screen.queryByText(/acme/i)).not.toBeInTheDocument();
  });

  it("tiene las secciones Dashboard y Vuelos, y marca la activa", () => {
    renderSidebar(true, "/vuelos");
    const flights = screen.getByRole("link", { name: "Vuelos" });
    const dashboard = screen.getByRole("link", { name: "Dashboard" });
    expect(flights).toHaveAttribute("href", "/vuelos");
    expect(dashboard).toHaveAttribute("href", "/");
    expect(flights).toHaveAttribute("data-active", "true");
    expect(dashboard).toHaveAttribute("data-active", "false");
  });
});
