import { readFileSync } from "node:fs";

/** Plantillas transaccionales de correo (HTML + texto plano). Viven en ./templates. */
export type TemplateName = "ticket-confirmation" | "flight-status-change";

export interface RenderedEmail {
  html: string;
  text: string;
}

const PLACEHOLDER = /\{\{\s*params\.([A-Z0-9_]+)\s*\}\}/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const cache = new Map<string, string>();

function load(file: string): string {
  const cached = cache.get(file);
  if (cached !== undefined) return cached;
  const content = readFileSync(new URL(`./templates/${file}`, import.meta.url), "utf8");
  cache.set(file, content);
  return content;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fill(template: string, params: Readonly<Record<string, string>>, escape: boolean): string {
  return template.replace(PLACEHOLDER, (_match, key: string) => {
    const value = params[key];
    // Una variable sin valor es un error de programación: mejor fallar que enviar "undefined".
    if (value === undefined) throw new Error(`Email template variable "${key}" has no value`);
    return escape ? escapeHtml(value) : value;
  });
}

/**
 * Rellena las variables `{{ params.NOMBRE }}` de la plantilla. En el HTML los valores se escapan
 * (un nombre con `<` no rompe el correo) y los comentarios de documentación se eliminan.
 */
export function renderEmail(
  name: TemplateName,
  params: Readonly<Record<string, string>>,
): RenderedEmail {
  const html = fill(load(`${name}.html`).replace(HTML_COMMENT, "").trimStart(), params, true);
  const text = fill(load(`${name}.txt`), params, false);
  return { html, text };
}
