export function computeETAMinutes(urgency: string, peopleAffected: number, distanceKm?: number): number {
  const urgencyBase: Record<string, number> = { critical: 10, high: 22, medium: 35, low: 55 }
  const base = urgencyBase[urgency] ?? 30
  const peopleMod = Math.floor(Math.min(peopleAffected / 50, 1) * 8)
  const distMod = distanceKm ? Math.round(Math.min(distanceKm / 5, 10)) : 0
  return base + peopleMod + distMod
}

export function formatETA(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}
