"use client";

import { useMemo, useRef, useState } from "react";
import { largestSubpathCenter } from "@/lib/place-geometry";
import shapes from "@/lib/world-map.json";

type MapCity = { label: string; users: number };

type MapCountry = {
  key: string;
  label: string;
  count: number;
  users?: number;
  cities?: MapCity[];
};

const WORLD = shapes as { id: string; name: string; d: string }[];

/**
 * Country outlines from @svg-maps/world (Victor Cazanave), CC BY 4.0,
 * coordinates rounded for the admin map.
 */
function peopleLabel(count: number): string {
  return count === 1 ? "1 person" : `${count} people`;
}

export function PlacesMap({
  countries,
  compact = false,
}: {
  countries: MapCountry[];
  compact?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    name: string;
    users: number;
    cities: MapCity[];
    x: number;
    y: number;
  } | null>(null);

  const byId = useMemo(() => {
    const map = new Map<string, MapCountry>();
    for (const row of countries) {
      if (row.key && row.key !== "unknown") map.set(row.key.toLowerCase(), row);
    }
    return map;
  }, [countries]);

  const max = Math.max(
    1,
    ...countries.map((row) => (row.key === "unknown" ? 0 : row.users ?? row.count))
  );

  const pins = useMemo(() => {
    if (!compact) return [];
    const marks: { id: string; x: number; y: number }[] = [];
    for (const shape of WORLD) {
      const row = byId.get(shape.id);
      const people = row?.users ?? 0;
      if (people <= 0) continue;
      const at = largestSubpathCenter(shape.d);
      if (!at) continue;
      marks.push({ id: shape.id, x: at.x, y: at.y });
    }
    return marks;
  }, [byId, compact]);

  const move = (event: React.MouseEvent<SVGSVGElement>) => {
    const wrap = wrapRef.current;
    const path = (event.target as Element).closest?.("[data-country]");
    if (!wrap || !path) {
      setTip(null);
      return;
    }
    const id = path.getAttribute("data-country") ?? "";
    const row = byId.get(id);
    const shape = WORLD.find((item) => item.id === id);
    const box = wrap.getBoundingClientRect();
    setTip({
      name: row?.label && row.label !== "Unknown" ? row.label : shape?.name ?? id,
      users: row?.users ?? 0,
      cities: row?.cities ?? [],
      x: event.clientX - box.left,
      y: event.clientY - box.top,
    });
  };

  return (
    <div className="admin-places-map-wrap" ref={wrapRef}>
      <svg
        className={`admin-places-map${compact ? " is-compact" : ""}`}
        viewBox="0 0 1010 666"
        role="img"
        aria-label="World map of sign-ins"
        onMouseMove={move}
        onMouseLeave={() => setTip(null)}
      >
        <rect width="1010" height="666" className="admin-places-ocean" />
        {WORLD.map((shape) => {
          const row = byId.get(shape.id);
          const people = row?.users ?? 0;
          const hot = people > 0 ? " is-hot" : "";
          const strong = people > 0 && people >= max * 0.6 ? " is-strong" : "";
          return (
            <path
              key={shape.id}
              d={shape.d}
              data-country={shape.id}
              className={`admin-places-country${hot}${strong}`}
            />
          );
        })}
        {pins.map((pin) => (
          <circle
            key={pin.id}
            cx={pin.x}
            cy={pin.y}
            r={28}
            className="admin-places-pin"
          />
        ))}
      </svg>
      {tip ? (
        <div
          className={`admin-places-tip${tip.y < 88 ? " is-below" : ""}`}
          style={{ left: tip.x, top: tip.y }}
        >
          <strong>{tip.name}</strong>
          <span>{peopleLabel(tip.users)}</span>
          {tip.cities.length > 0 ? (
            <ul>
              {tip.cities.map((city) => (
                <li key={city.label}>
                  <span>{city.label}</span>
                  <span>{city.users}</span>
                </li>
              ))}
            </ul>
          ) : tip.users > 0 ? (
            <span className="admin-places-tip-empty">No city yet</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
