import { ICONS, type IconName } from "./icon-paths.ts";

interface IconProps {
  name: IconName;
  className?: string;
  style?: React.CSSProperties;
}

/** Icono SVG del prototipo (mismos trazos y clase `.ico`). */
export function Icon({ name, className, style }: IconProps) {
  return (
    <svg
      className={`ico ${className ?? ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={style}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

/** Banderas del selector de idioma: Colombia (español) y Estados Unidos (inglés). */
export function Flag({ country }: { country: "co" | "us" }) {
  if (country === "us") {
    return (
      <svg className="flag" viewBox="0 0 22 15" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <rect
            key={i}
            y={(i * 15) / 7}
            width="22"
            height={15 / 7}
            fill={i % 2 ? "#fff" : "#B22234"}
          />
        ))}
        <rect width="10" height="8.1" fill="#3C3B6E" />
      </svg>
    );
  }
  return (
    <svg className="flag" viewBox="0 0 22 15" aria-hidden="true">
      <rect width="22" height="7.5" fill="#FCD116" />
      <rect y="7.5" width="22" height="3.75" fill="#003893" />
      <rect y="11.25" width="22" height="3.75" fill="#CE1126" />
    </svg>
  );
}
