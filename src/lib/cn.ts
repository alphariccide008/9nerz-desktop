/** Tiny classnames joiner (no tailwind-merge needed for RN/NativeWind). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
