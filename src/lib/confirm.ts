/** Desktop confirm — the renderer is always a Chromium webview, so window.confirm suffices. */
export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  _confirmLabel = "Confirm",
  _destructive = false,
) {
  if (window.confirm(`${title}\n\n${message}`)) onConfirm();
}
