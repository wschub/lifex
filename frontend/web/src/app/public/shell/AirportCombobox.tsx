import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import { useLang } from "@/i18n/i18n.ts";
import { airportLabel, cityLabel, filterAirports, groupAirports } from "../airport-search.ts";
import type { AirportEntry } from "../hooks/useCities.ts";

interface Props {
  id: string;
  name: string;
  /** Código IATA elegido, o "" si no hay. */
  value: string;
  options: AirportEntry[];
  placeholder: string;
  onChange: (iata: string) => void;
  /** Si es true, borrar el texto y salir del campo deja la elección vacía; si no, se restaura la anterior. */
  allowEmpty?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * Campo de aeropuerto con autocompletar (patrón combobox de ARIA). Muestra todos los destinos —nacionales
 * e internacionales— y filtra por código o por ciudad mientras se escribe. Usa los estilos de `.field`.
 */
export function AirportCombobox({
  id,
  name,
  value,
  options,
  placeholder,
  onChange,
  allowEmpty = false,
  inputRef,
}: Props) {
  const { lang, t } = useLang("home");
  const listId = useId();
  /** Texto que el usuario está escribiendo; `null` = no se edita y el campo muestra la opción elegida. */
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const selected = options.find((option) => option.iata === value);
  const shown = query ?? (selected ? airportLabel(selected, lang) : "");
  const results = useMemo(() => filterAirports(options, query ?? "", lang), [options, query, lang]);
  const groups = useMemo(() => groupAirports(results), [results]);
  const optionId = (iata: string) => `${listId}-${iata}`;
  const activeEntry = results[active];

  const listRef = useRef<HTMLDivElement>(null);

  // Al abrir, la lista entera se hace visible aunque el campo esté cerca del borde de la ventana.
  useEffect(() => {
    if (open) listRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [open]);

  // La opción activa se mantiene a la vista dentro de la lista (solo se desplaza la lista, no la página).
  useEffect(() => {
    const list = listRef.current;
    const element = activeEntry ? document.getElementById(optionId(activeEntry.iata)) : null;
    if (!open || !list || !element) return;
    if (element.offsetTop < list.scrollTop) list.scrollTop = element.offsetTop - 6;
    else if (element.offsetTop + element.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = element.offsetTop + element.offsetHeight - list.clientHeight + 6;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, activeEntry]);

  const close = () => {
    setOpen(false);
    setQuery(null);
  };
  const commit = (entry: AirportEntry) => {
    onChange(entry.iata);
    close();
  };

  const onFocus = (event: FocusEvent<HTMLInputElement>) => {
    event.target.select();
    setOpen(true);
    setActive(
      Math.max(
        0,
        results.findIndex((option) => option.iata === value),
      ),
    );
  };
  const onBlur = () => {
    if (query === "" && allowEmpty && value !== "") onChange("");
    close();
  };
  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setOpen(true);
    setActive(0);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (results.length === 0) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((current) => (current + step + results.length) % results.length);
        return;
      }
      case "Enter":
        if (open && activeEntry) {
          event.preventDefault();
          commit(activeEntry);
        }
        return;
      case "Tab":
        // Tab confirma la opción resaltada solo si el usuario escribió algo.
        if (open && query !== null && query !== "" && activeEntry) commit(activeEntry);
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
        }
        return;
    }
  };

  const renderGroup = (title: string, entries: AirportEntry[], offset: number) =>
    entries.length === 0 ? null : (
      <div role="group" aria-label={title} key={title}>
        <div className="combo-group" aria-hidden="true">
          {title}
        </div>
        {entries.map((entry, index) => {
          const position = offset + index;
          return (
            <div
              key={entry.iata}
              id={optionId(entry.iata)}
              role="option"
              aria-selected={entry.iata === value}
              className={`combo-opt${position === active ? " active" : ""}`}
              // mousedown evita que el campo pierda el foco antes del clic
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(entry)}
              onMouseMove={() => setActive(position)}
            >
              <span>{cityLabel(entry, lang)}</span>{" "}
              <span className="combo-code">({entry.iata})</span>
            </div>
          );
        })}
      </div>
    );

  return (
    <>
      <input
        id={id}
        name={name}
        ref={inputRef}
        type="text"
        role="combobox"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeEntry ? optionId(activeEntry.iata) : undefined}
        placeholder={placeholder}
        value={shown}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={onInput}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={placeholder}
          className="combo-list"
        >
          {results.length === 0 ? (
            <div className="combo-empty" role="status">
              {t("ac.empty")}
            </div>
          ) : (
            <>
              {renderGroup(t("ac.domestic"), groups.domestic, 0)}
              {renderGroup(t("ac.international"), groups.international, groups.domestic.length)}
            </>
          )}
        </div>
      )}
    </>
  );
}
