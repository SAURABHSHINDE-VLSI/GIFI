export function initialOf(name: string) {
  return (name.trim().charAt(0) || "H").toUpperCase();
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function formatTime(timestamp: number | string | Date): string {
  try {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const hour = d.getHours() % 12 || 12;
    const mins = String(d.getMinutes()).padStart(2, "0");
    const ampm = d.getHours() < 12 ? "AM" : "PM";
    const timeStr = `${hour}:${mins} ${ampm}`;

    if (isToday) {
      return `Today, ${timeStr}`;
    }
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${timeStr}`;
  } catch {
    return "";
  }
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Compact partner chip used during a call. */
export function partnerChip(partnerName: string, selfName: string): string {
  const avatar = partnerName ? initialOf(partnerName) : "?";
  const name = partnerName || "waiting";
  const esc = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return (
    `<span class="chip-avatar">${esc(avatar)}</span>` +
    `<span class="chip-name">${esc(name)}</span>` +
    `<span class="chip-you">${esc(selfName)}</span>`
  );
}

