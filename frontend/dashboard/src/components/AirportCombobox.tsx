import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Input } from "@/components/ui/input.tsx";
import {
  airportLabel,
  filterAirports,
  groupAirports,
  type AirportEntry,
} from "@/lib/airport-search.ts";
import { cn } from "@/lib/utils.ts";

interface Props {
  id: string;
  /** Código IATA elegido, o "" si no hay filtro. */
  value: string;
  options: AirportEntry[];
  placeholder: string;
  onChange: (iata: string) => void;
}

/**
 * Filtro de aeropuerto con autocompletar (patrón combobox de ARIA), igual que el de la web pública: muestra
 * todos los destinos —nacionales e internacionales— y filtra mientras se escribe por código o por ciudad.
 * Es un filtro opcional: borrar el texto (o la «x») quita el filtro.
 */
export function AirportCombobox({ id, value, options, placeholder, onChange }: Props) {
  const listId = useId();
  /** Texto que se está escribiendo; `null` = no se edita y el campo muestra la opción elegida. */
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.iata === value);
  const shown = query ?? (selected ? airportLabel(selected) : "");
  const results = useMemo(() => filterAirports(options, query ?? ""), [options, query]);
  const groups = useMemo(() => groupAirports(results), [results]);
  const optionId = (iata: string) => `${listId}-${iata}`;
  const activeEntry = results[active];

  // La opción activa se mantiene a la vista dentro de la lista.
  useEffect(() => {
    const list = listRef.current;
    const element = activeEntry ? document.getElementById(optionId(activeEntry.iata)) : null;
    if (!open || !list || !element) return;
    if (element.offsetTop < list.scrollTop) list.scrollTop = element.offsetTop - 4;
    else if (element.offsetTop + element.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = element.offsetTop + element.offsetHeight - list.clientHeight + 4;
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
    if (query === "" && value !== "") onChange("");
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
        <div className="text-muted-foreground px-2 pt-2 pb-1 text-xs" aria-hidden="true">
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
              className={cn(
                "flex cursor-pointer items-baseline gap-1.5 rounded-sm px-2 py-1.5 text-sm",
                position === active && "bg-accent text-accent-foreground",
                entry.iata === value && "font-semibold",
              )}
              // mousedown evita que el campo pierda el foco antes del clic
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(entry)}
              onMouseMove={() => setActive(position)}
            >
              <span>{entry.nameEs}</span>{" "}
              <span className="text-muted-foreground font-normal">({entry.iata})</span>
            </div>
          );
        })}
      </div>
    );

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeEntry ? optionId(activeEntry.iata) : undefined}
        placeholder={placeholder}
        value={shown}
        className="pr-8"
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={onInput}
        onKeyDown={onKeyDown}
      />
      {value !== "" && query === null && (
        <button
          type="button"
          aria-label="Quitar filtro"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChange("")}
        >
          <X className="size-4" />
        </button>
      )}
      {open && (
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={placeholder}
          className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-72 w-full min-w-64 overflow-y-auto rounded-md border p-1 shadow-md"
        >
          {results.length === 0 ? (
            <div role="status" className="text-muted-foreground px-2 py-3 text-sm">
              No encontramos ese aeropuerto.
            </div>
          ) : (
            <>
              {renderGroup("Nacionales", groups.domestic, 0)}
              {renderGroup("Internacionales", groups.international, groups.domestic.length)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
