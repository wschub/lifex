import { useSidebar } from "@/components/ui/sidebar.tsx";

/** Logo horizontal con el menú abierto; solo el icono si está colapsado o en móvil. */
export function SidebarBrand() {
  const { state, isMobile } = useSidebar();
  const compact = isMobile || state === "collapsed";
  return (
    <a href="/admin" className="flex h-10 items-center px-1">
      {compact ? (
        <img src="/logo/lifex-icon.svg" alt="lifex (icono)" className="size-8" />
      ) : (
        <img src="/logo/lifex-horizontal.svg" alt="lifex" className="h-8 w-auto" />
      )}
    </a>
  );
}
