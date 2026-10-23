/**
 * Where a section editor should open: one item of one list field (e.g. the
 * stage the sticky stepper is showing). Sections register a getter; the Edit
 * chip asks it at click time, so every chip of that section opens the same way.
 */
export type EditorFocus = { list: string; index: number };

const getters = new Map<string, () => EditorFocus | null>();

export function setEditorFocusGetter(id: string, getter: (() => EditorFocus | null) | null) {
  if (getter) getters.set(id, getter);
  else getters.delete(id);
}

export function readEditorFocus(id: string): EditorFocus | null {
  try {
    return getters.get(id)?.() ?? null;
  } catch {
    return null;
  }
}
