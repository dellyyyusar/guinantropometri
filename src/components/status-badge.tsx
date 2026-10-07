import { Badge } from './ui'
import {
  ATTENTION_LABELS,
  NORMAL_LABELS,
  OVERALL_ATTENTION,
  OVERALL_INCOMPLETE,
  OVERALL_NO_REFERENCE,
  OVERALL_NORMAL,
  OVERALL_RISK,
  RISK_LABELS,
  STATUS_REFERENCE_MISSING,
  STATUS_UNCOMPUTABLE,
} from '~/services/anthropometry'

type Tone = 'neutral' | 'normal' | 'risk' | 'attention' | 'primary' | 'info'

/**
 * Satu tempat yang memetakan label status ke warna.
 * Labelnya sendiri berasal dari status.ts supaya badge dan perhitungan
 * tidak pernah berbeda pendapat.
 */
export function statusTone(label: string | null | undefined): Tone {
  if (label === null || label === undefined || label === '') return 'neutral'
  if (label === STATUS_REFERENCE_MISSING) return 'info'
  if (label === STATUS_UNCOMPUTABLE) return 'neutral'
  if (ATTENTION_LABELS.has(label)) return 'attention'
  if (RISK_LABELS.has(label)) return 'risk'
  if (NORMAL_LABELS.has(label)) return 'normal'
  return 'neutral'
}

export function overallTone(status: string | null | undefined): Tone {
  switch (status) {
    case OVERALL_NORMAL:
      return 'normal'
    case OVERALL_RISK:
      return 'risk'
    case OVERALL_ATTENTION:
      return 'attention'
    case OVERALL_NO_REFERENCE:
      return 'info'
    default:
      return 'neutral'
  }
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (status === null || status === undefined || status === '') {
    return (
      <Badge tone="neutral" className={className}>
        Belum ada data
      </Badge>
    )
  }
  return (
    <Badge tone={statusTone(status)} className={className}>
      {status}
    </Badge>
  )
}

export function OverallBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (status === null || status === undefined || status === '') {
    return (
      <Badge tone="neutral" className={className}>
        Belum diukur
      </Badge>
    )
  }
  return (
    <Badge tone={overallTone(status)} className={className}>
      {status}
    </Badge>
  )
}

export { OVERALL_INCOMPLETE }

/** Z-score dengan tanda eksplisit; null ditampilkan sebagai "-" bukan 0. */
export function formatZ(z: number | null | undefined): string {
  if (z === null || z === undefined) return '—'
  return `${z > 0 ? '+' : ''}${z.toFixed(2)}`
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—'
  return value.toFixed(digits)
}
