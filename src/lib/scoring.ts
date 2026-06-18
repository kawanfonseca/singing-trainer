export type ExerciseSample = {
  cents: number | null
  clarity: number
  timestamp: number
}

export type SessionAttempt = {
  id: string
  note: string
  score: number
  grade?: string
  inTunePercent: number
  averageError: number | null
  createdAt: string
  mode?: string
  stars?: number
  bestCombo?: number
}

export const HISTORY_STORAGE_KEY = 'singing-trainer-history'

export function scoreExercise(samples: ExerciseSample[], tolerance: number) {
  const voicedSamples = samples.filter((sample) => sample.cents !== null && sample.clarity >= 0.86)

  if (voicedSamples.length === 0) {
    return {
      score: 0,
      inTunePercent: 0,
      averageError: null,
    }
  }

  const inTuneSamples = voicedSamples.filter((sample) => Math.abs(sample.cents ?? 0) <= tolerance)
  const averageError =
    voicedSamples.reduce((sum, sample) => sum + Math.abs(sample.cents ?? 0), 0) / voicedSamples.length
  const inTunePercent = Math.round((inTuneSamples.length / voicedSamples.length) * 100)
  const accuracy = Math.max(0, 100 - averageError * 1.35)
  const score = Math.round(accuracy * 0.55 + inTunePercent * 0.45)

  return {
    score: Math.min(100, Math.max(0, score)),
    inTunePercent,
    averageError,
  }
}

export function readHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY)

    if (!saved) {
      return []
    }

    const parsed = JSON.parse(saved)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isSessionAttempt).slice(0, 10)
  } catch {
    return []
  }
}

export function saveAttempt(attempt: SessionAttempt) {
  const history = [attempt, ...readHistory()].slice(0, 10)
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))

  return history
}

function isSessionAttempt(value: unknown): value is SessionAttempt {
  if (!value || typeof value !== 'object') {
    return false
  }

  const attempt = value as SessionAttempt

  return (
    typeof attempt.id === 'string' &&
    typeof attempt.note === 'string' &&
    typeof attempt.score === 'number' &&
    typeof attempt.inTunePercent === 'number' &&
    typeof attempt.createdAt === 'string'
  )
}
