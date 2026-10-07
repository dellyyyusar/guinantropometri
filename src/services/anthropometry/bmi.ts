import { round2 } from './correction'

/** IMT = BB (kg) / [TB (m)]^2, memakai PB/TB yang sudah dikoreksi. */
export function calculateBmi(weightKg: number, correctedLengthHeightCm: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null
  if (!Number.isFinite(correctedLengthHeightCm) || correctedLengthHeightCm <= 0) return null
  const meters = correctedLengthHeightCm / 100
  return round2(weightKg / (meters * meters))
}
