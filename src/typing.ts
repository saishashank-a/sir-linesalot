// True when a key event comes from a text field, so canvas shortcuts (Delete, Esc, undo) leave it alone.
export const typingIn = (t: EventTarget | null) =>
  !!(t as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')
