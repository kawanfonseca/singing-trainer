import { NOTE_OPTIONS, clamp, midiToFrequency, midiToNoteName, type NoteOption } from './music'
import type { CourseLesson } from './course'

export type SegmentResult = 'pending' | 'active' | 'perfect' | 'hit' | 'miss'

export type GameNote = NoteOption & {
  id: string
  durationMs: number
}

export type ArcadeStats = {
  score: number
  combo: number
  bestCombo: number
  energy: number
  totalSamples: number
  voicedSamples: number
  inTuneSamples: number
  lowSamples: number
  highSamples: number
  errorSum: number
}

export type SegmentStats = {
  voicedSamples: number
  inTuneSamples: number
}

export function createEmptyStats(): ArcadeStats {
  return {
    score: 0,
    combo: 0,
    bestCombo: 0,
    energy: 100,
    totalSamples: 0,
    voicedSamples: 0,
    inTuneSamples: 0,
    lowSamples: 0,
    highSamples: 0,
    errorSum: 0,
  }
}

export function createSegmentStats(count: number): SegmentStats[] {
  return Array.from({ length: count }, () => ({
    voicedSamples: 0,
    inTuneSamples: 0,
  }))
}

export function createSegmentResults(count: number): SegmentResult[] {
  return Array.from({ length: count }, (_, index) => (index === 0 ? 'active' : 'pending'))
}

export function buildLessonSequence(lesson: CourseLesson, baseMidi: number): GameNote[] {
  return lesson.steps.map((step, index) => {
    const midi = clamp(baseMidi + step, NOTE_OPTIONS[0].midi, NOTE_OPTIONS[NOTE_OPTIONS.length - 1].midi)

    return {
      id: `${lesson.id}-${index}-${midi}`,
      midi,
      label: midiToNoteName(midi) ?? '--',
      frequency: midiToFrequency(midi),
      durationMs: lesson.durationMs,
    }
  })
}

export function getTotalDuration(sequence: GameNote[]) {
  return sequence.reduce((sum, note) => sum + note.durationMs, 0)
}

export function getActiveNoteIndex(sequence: GameNote[], elapsedMs: number) {
  let cursor = 0

  for (let index = 0; index < sequence.length; index += 1) {
    cursor += sequence[index].durationMs

    if (elapsedMs < cursor) {
      return index
    }
  }

  return sequence.length - 1
}

export function getNoteProgress(sequence: GameNote[], activeIndex: number, elapsedMs: number) {
  const elapsedBeforeNote = sequence
    .slice(0, activeIndex)
    .reduce((sum, note) => sum + note.durationMs, 0)
  const noteElapsed = elapsedMs - elapsedBeforeNote

  return clamp(noteElapsed / sequence[activeIndex].durationMs, 0, 1)
}

export function evaluateSegment(segment: SegmentStats): SegmentResult {
  if (segment.voicedSamples < 5) {
    return 'miss'
  }

  const inTuneRatio = segment.inTuneSamples / segment.voicedSamples

  if (inTuneRatio >= 0.84) {
    return 'perfect'
  }

  return inTuneRatio >= 0.52 ? 'hit' : 'miss'
}

export function recordArcadeSample(
  stats: ArcadeStats,
  segment: SegmentStats,
  cents: number | null,
  isVoiceDetected: boolean,
  tolerance: number,
) {
  stats.totalSamples += 1

  if (!isVoiceDetected || cents === null) {
    stats.combo = 0
    stats.energy = clamp(stats.energy - 0.45, 0, 100)
    stats.score = calculateArcadeScore(stats, tolerance)
    return
  }

  stats.voicedSamples += 1
  segment.voicedSamples += 1
  stats.errorSum += Math.abs(cents)

  if (Math.abs(cents) <= tolerance) {
    stats.inTuneSamples += 1
    segment.inTuneSamples += 1
    stats.combo += 1
    stats.bestCombo = Math.max(stats.bestCombo, stats.combo)
    stats.energy = clamp(stats.energy + 0.8, 0, 100)
  } else {
    stats.combo = 0
    stats.energy = clamp(stats.energy - 1.2, 0, 100)

    if (cents < 0) {
      stats.lowSamples += 1
    } else {
      stats.highSamples += 1
    }
  }

  stats.score = calculateArcadeScore(stats, tolerance)
}

export function calculateArcadeScore(stats: ArcadeStats, tolerance: number) {
  if (stats.totalSamples === 0 || stats.voicedSamples === 0) {
    return 0
  }

  const coverage = stats.voicedSamples / stats.totalSamples
  const inTuneRatio = stats.inTuneSamples / stats.voicedSamples
  const averageError = stats.errorSum / stats.voicedSamples
  const accuracy = clamp(1 - averageError / (tolerance * 3.2), 0, 1)
  const comboBonus = clamp(stats.bestCombo / 38, 0, 1)

  return Math.round((inTuneRatio * 0.46 + accuracy * 0.28 + coverage * 0.16 + comboBonus * 0.1) * 100)
}

export function getStars(score: number) {
  if (score >= 90) {
    return 3
  }

  if (score >= 72) {
    return 2
  }

  if (score >= 50) {
    return 1
  }

  return 0
}

export function getArcadeDiagnosis(stats: ArcadeStats, tolerance: number) {
  if (stats.voicedSamples === 0) {
    return 'Nenhuma voz estável foi detectada. Aproxime o microfone e tente cantar com volume constante.'
  }

  const averageError = stats.errorSum / stats.voicedSamples
  const inTuneRatio = stats.inTuneSamples / stats.voicedSamples

  if (inTuneRatio >= 0.82 && averageError <= tolerance) {
    return 'Boa centralização. O próximo foco é manter a mesma estabilidade em sequências com mudança de nota.'
  }

  if (stats.lowSamples > stats.highSamples * 1.35) {
    return 'Você ficou mais abaixo do alvo. Entre na nota com um pouco mais de altura antes de sustentar.'
  }

  if (stats.highSamples > stats.lowSamples * 1.35) {
    return 'Você ficou mais acima do alvo. Relaxe a entrada e procure descer até o centro da nota.'
  }

  return 'O desvio alternou entre baixo e alto. Diminua a velocidade da entrada e procure estabilizar antes da próxima nota.'
}
