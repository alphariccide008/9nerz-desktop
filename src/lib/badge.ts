/** Draws the unread-count badge (yellow circle, white text) and sends it to the
 *  main process as a taskbar overlay icon. No-op outside Electron. */
export function updateTaskbarBadge(count: number) {
  if (!window.nerz?.setBadge) return;

  if (count <= 0) {
    window.nerz.setBadge(null);
    return;
  }

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = "#F2A93B";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();

  const label = count > 99 ? "99+" : String(count);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${label.length > 2 ? 22 : 28}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, size / 2, size / 2 + 1);

  window.nerz.setBadge(canvas.toDataURL("image/png"), `${count} unread notification${count === 1 ? "" : "s"}`);
}
