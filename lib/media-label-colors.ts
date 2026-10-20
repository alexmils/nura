/** Label colours: calm, brand-friendly swatches. Stored by key in MediaLabel.color. */
export type LabelColor = { key: string; name: string; dot: string; bg: string; border: string; text: string };

export const LABEL_COLORS: LabelColor[] = [
  { key: "default", name: "Lime", dot: "#D2FB02", bg: "#D2FB02", border: "#1B2F0C", text: "#1B2F0C" },
  { key: "sage", name: "Sage", dot: "#7FA27A", bg: "#E3EDE0", border: "#4F7449", text: "#233A1F" },
  { key: "moss", name: "Moss", dot: "#3C5E19", bg: "#DCE6CF", border: "#3C5E19", text: "#1B2F0C" },
  { key: "ochre", name: "Ochre", dot: "#C9962E", bg: "#F6EBD2", border: "#A67A1E", text: "#5A410C" },
  { key: "clay", name: "Clay", dot: "#B8743A", bg: "#FBEFE3", border: "#B8743A", text: "#6B3C14" },
  { key: "rose", name: "Rose", dot: "#C26A6A", bg: "#F6E1E0", border: "#A65050", text: "#5E2424" },
  { key: "plum", name: "Plum", dot: "#7E5C8F", bg: "#ECE3F1", border: "#6B4A7C", text: "#3A2446" },
  { key: "slate", name: "Slate", dot: "#5F7380", bg: "#E2E8EC", border: "#4E616D", text: "#24323B" },
  { key: "sky", name: "Sky", dot: "#4E86A8", bg: "#E1EEF5", border: "#4E86A8", text: "#1D3F55" },
];

export function labelColor(key: string | null | undefined): LabelColor {
  return LABEL_COLORS.find((c) => c.key === key) ?? LABEL_COLORS[0];
}

export function cleanLabelColor(value: unknown): string | null {
  return typeof value === "string" && LABEL_COLORS.some((c) => c.key === value) ? value : null;
}
