import type { ReactNode } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle.ts";
import { SiteFooter } from "./Footer.tsx";
import { CheckoutHeader, SiteHeader } from "./Header.tsx";

type ShellProps =
  | { kind: "site"; title: string; page?: "home"; children: ReactNode }
  | { kind: "co"; title: string; step: 1 | 2 | 3 | 4; children: ReactNode; bar?: ReactNode };

/**
 * Cascarón de página: encabezado (de sitio o de checkout), contenido y pie. La barra de resumen
 * del checkout se pasa en `bar`. El contenido lleva su propio `<main>`.
 */
export function Shell(props: ShellProps) {
  useDocumentTitle(props.title);
  return (
    <>
      {props.kind === "site" ? (
        <SiteHeader current={props.page} />
      ) : (
        <CheckoutHeader step={props.step} />
      )}
      {props.children}
      <SiteFooter compact={props.kind === "co"} />
      {props.kind === "co" ? props.bar : null}
    </>
  );
}
