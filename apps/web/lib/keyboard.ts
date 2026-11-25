/** True when focus is somewhere that owns its own keystrokes, so page shortcuts must not fire. */
export function isTypingInFocusedElement(): boolean {
  const el = document.activeElement;
  const tag = el?.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el?.getAttribute("contenteditable") === "true" ||
    Boolean(el?.closest("[role='dialog']"))
  );
}
