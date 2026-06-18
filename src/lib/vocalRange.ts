import {
  centsBetweenFrequencyAndMidi,
  centsFromNearestSemitone,
  clamp,
  frequencyToMidi,
  midiToFrequency,
  midiToNoteName,
} from './music'

export type VocalRangeStepId = 'speech' | 'low' | 'break' | 'denseHigh' | 'lightHigh'

export type VocalDiagnosticStage =
  | 'spoken'
  | 'comfortable_low'
  | 'siren_break'
  | 'dense_high'
  | 'light_high'

export type VocalRangeStep = {
  id: VocalRangeStepId
  title: string
  prompt: string
  detail: string
  durationMs: number
}

export type VocalRangeStepDraft = {
  samples: VocalRangeSample[]
  lowFrequency: number | null
  highFrequency: number | null
}

export type VocalRangeDraft = Record<VocalRangeStepId, VocalRangeStepDraft>

export type TestProtocol = 'free_range' | 'sustained_notes' | 'sirens' | 'scales'

export type VocalRangeSample = {
  frequency: number
  clarity: number
  volume: number
  capturedAt: number
}

export type PitchFrame = {
  timeMs: number
  frequency: number | null
  midi: number | null
  noteName: string | null
  centsFromNearestSemitone: number | null
  confidence: number
  rms: number
  isVoiced: boolean
  sourceStepId: VocalRangeStepId
  stage: VocalDiagnosticStage
}

export type RangeResult = {
  lowestMidi: number
  highestMidi: number
  lowestNote: string
  highestNote: string
  reliability?: AnalysisReliability
}

export type AnalysisReliability = 'high' | 'medium' | 'low' | 'insufficient_data'

export type VoiceBreakEvent = {
  timeMs: number
  midiBefore: number | null
  midiAfter: number | null
  noteBefore: string | null
  noteAfter: string | null
  severity: 'low' | 'medium' | 'high'
  evidence: string[]
}

export type VoiceSegment = {
  id: string
  startMs: number
  endMs: number
  durationMs: number
  frames: PitchFrame[]
  stage: VocalDiagnosticStage
  sourceStepId: VocalRangeStepId
  medianMidi: number | null
  roundedMidi: number | null
  noteName: string | null
  meanCentsOffset: number | null
  pitchStdDevCents: number | null
  driftCents: number | null
  meanRms: number
  voicedRatio: number
  hasVoiceBreak: boolean
  attackOffsetCents: number | null
  attackClassification: AttackClassification
}

export type AttackClassification =
  | 'centered'
  | 'starts_low'
  | 'starts_high'
  | 'unstable_attack'
  | 'not_enough_data'

export type VocalZoneClassification =
  | 'not_enough_data'
  | 'dense_like_stable'
  | 'dense_like_unstable'
  | 'transition_unstable'
  | 'light_like_stable'
  | 'light_like_breathy_or_weak'
  | 'unclassified'

export type NoteAnalysis = {
  midi: number
  noteName: string
  segmentsCount: number
  bestSegmentId: string | null
  meanCentsOffset: number | null
  pitchStdDevCents: number | null
  bestPitchStdDevCents: number | null
  meanRms: number | null
  voicedRatio: number | null
  driftCents: number | null
  stabilityScore: number
  sustainScore: number
  attackScore: number
  intensityScore: number
  usableScore: number
  classification: VocalZoneClassification
  observations: string[]
  stages: VocalDiagnosticStage[]
}

export type StageAnalysisSummary = {
  stage: VocalDiagnosticStage
  label: string
  frameCount: number
  voicedFrameCount: number
  minNote: string | null
  maxNote: string | null
  medianNote: string | null
  averageConfidence: number | null
  averageRms: number | null
  segmentCount: number
  breakEventCount: number
}

export type TransitionZone = {
  fromMidi: number
  toMidi: number
  fromNote: string
  toNote: string
  confidence: number
  evidence: string[]
}

export type RegisterLikeZones = {
  denseLikely: RangeResult | null
  transitionLikely: RangeResult | null
  lightLikely: RangeResult | null
}

export type VocalRangeAnalysis = {
  schemaVersion: 1
  createdAt: string
  protocol: TestProtocol
  durationMs: number
  frameCount: number
  absoluteRange: RangeResult | null
  reliableRange: RangeResult | null
  sustainedRange: RangeResult | null
  usableRange: RangeResult | null
  comfortableTessitura: RangeResult | null
  noteAnalyses: NoteAnalysis[]
  segments: VoiceSegment[]
  voiceBreakEvents: VoiceBreakEvent[]
  probableTransitionZones: TransitionZone[]
  registerLikeZones: RegisterLikeZones | null
  stageSummaries: StageAnalysisSummary[]
  warnings: string[]
}

export type VocalTypeEstimate = {
  label: string
  confidence: number
  detail: string
}

export type BreakEstimate = {
  note: string
  frequency: number
  confidence: number
  detail: string
} | null

export type VocalRangeResult = {
  schemaVersion: 1
  lowFrequency: number
  highFrequency: number
  lowNote: string
  highNote: string
  denseHighNote: string | null
  lightHighNote: string | null
  speechCenterNote: string | null
  breakEstimate: BreakEstimate
  semitones: number
  octaves: number
  octaveLabel: string
  suggestedBaseMidi: number
  typeEstimate: VocalTypeEstimate
  analysis: VocalRangeAnalysis
  capturedAt: string
}

type VoiceTypeProfile = {
  label: string
  lowMidi: number
  highMidi: number
  speechCenterMidi: number
}

export const VOCAL_RANGE_STORAGE_KEY = 'singing-trainer-vocal-range'

export const VOCAL_ANALYSIS_CONFIG = {
  minVoicedConfidence: 0.75,
  minRms: 0.01,
  minSegmentDurationMs: 250,
  minSustainedDurationMs: 1000,
  attackWindowMs: 250,
  releaseTrimMs: 150,
  maxSegmentGapMs: 360,
  maxBreakFrameGapMs: 220,
  stageOnsetIgnoreMs: 350,
  reliableMinFramesPerNote: 4,
  noteChangeSplitSemitones: 1.25,
  usablePitchStdDevCents: 45,
  sustainedPitchStdDevCents: 70,
  pitchJumpBreakCents: 150,
  rmsDropBreakRatio: 0.4,
} as const

export const VOCAL_RANGE_STEPS: VocalRangeStep[] = [
  {
    id: 'speech',
    title: 'Voz falada',
    prompt: 'Fale normalmente por alguns segundos, como se estivesse conversando.',
    detail: 'Isso ajuda o app a entender onde sua voz costuma ficar no dia a dia.',
    durationMs: 5500,
  },
  {
    id: 'low',
    title: 'Grave confortável',
    prompt: 'Desça a voz devagar em "u" ou "ô", sem forçar.',
    detail: 'Pare quando a voz começar a sumir, apertar ou ficar desconfortável.',
    durationMs: 6500,
  },
  {
    id: 'break',
    title: 'Transição vocal',
    prompt: 'Faça uma sirene em "u", subindo do grave para o agudo de forma suave.',
    detail: 'Não tente cantar alto. A ideia é observar onde a voz muda, falha ou fica instável.',
    durationMs: 7500,
  },
  {
    id: 'denseHigh',
    title: 'Agudo com voz cheia',
    prompt: 'Suba a voz mantendo o som mais cheio, firme e confortável.',
    detail: 'Não force. Pare se sentir aperto, dor ou pressão. Essa etapa tenta estimar até onde sua voz mantém mais corpo.',
    durationMs: 6500,
  },
  {
    id: 'lightHigh',
    title: 'Agudo com voz leve',
    prompt: 'Suba em "u" deixando a voz ficar leve naturalmente.',
    detail: 'Aqui não precisa manter corpo. Deixe a voz afinar ou virar falsete se isso acontecer naturalmente.',
    durationMs: 6500,
  },
]

const VOICE_TYPES: VoiceTypeProfile[] = [
  { label: 'Baixo', lowMidi: 40, highMidi: 64, speechCenterMidi: 42 },
  { label: 'Barítono', lowMidi: 43, highMidi: 67, speechCenterMidi: 45 },
  { label: 'Tenor', lowMidi: 48, highMidi: 72, speechCenterMidi: 50 },
  { label: 'Contralto', lowMidi: 53, highMidi: 77, speechCenterMidi: 55 },
  { label: 'Mezzo-soprano', lowMidi: 57, highMidi: 81, speechCenterMidi: 59 },
  { label: 'Soprano', lowMidi: 60, highMidi: 84, speechCenterMidi: 62 },
]

const STAGE_ORDER: VocalDiagnosticStage[] = [
  'spoken',
  'comfortable_low',
  'siren_break',
  'dense_high',
  'light_high',
]

const STAGE_LABELS: Record<VocalDiagnosticStage, string> = {
  spoken: 'Voz falada',
  comfortable_low: 'Grave confortável',
  siren_break: 'Transição vocal',
  dense_high: 'Agudo com voz cheia',
  light_high: 'Agudo com voz leve',
}

export function createVocalRangeStepDraft(): VocalRangeStepDraft {
  return {
    samples: [],
    lowFrequency: null,
    highFrequency: null,
  }
}

export function createVocalRangeDraft(): VocalRangeDraft {
  return {
    speech: createVocalRangeStepDraft(),
    low: createVocalRangeStepDraft(),
    break: createVocalRangeStepDraft(),
    denseHigh: createVocalRangeStepDraft(),
    lightHigh: createVocalRangeStepDraft(),
  }
}

export function addRangeSample(
  draft: VocalRangeDraft,
  stepId: VocalRangeStepId,
  sample: VocalRangeSample,
): VocalRangeDraft {
  const currentStep = draft[stepId]
  const samples = [...currentStep.samples, sample].slice(-320)

  return {
    ...draft,
    [stepId]: {
      samples,
      lowFrequency:
        currentStep.lowFrequency === null ? sample.frequency : Math.min(currentStep.lowFrequency, sample.frequency),
      highFrequency:
        currentStep.highFrequency === null
          ? sample.frequency
          : Math.max(currentStep.highFrequency, sample.frequency),
    },
  }
}

export function buildRangeResult(draft: VocalRangeDraft): VocalRangeResult | null {
  const lowFrequency = draft.low.lowFrequency ?? getLowFrequency(draft)
  const denseHighFrequency = draft.denseHigh.highFrequency
  const lightHighFrequency = draft.lightHigh.highFrequency
  const highFrequency = Math.max(denseHighFrequency ?? 0, lightHighFrequency ?? 0)

  if (!lowFrequency || !highFrequency || getTotalSampleCount(draft) < 14) {
    return null
  }

  const lowMidi = Math.round(frequencyToMidi(lowFrequency))
  const denseHighMidi = denseHighFrequency ? Math.round(frequencyToMidi(denseHighFrequency)) : null
  const lightHighMidi = lightHighFrequency ? Math.round(frequencyToMidi(lightHighFrequency)) : null
  const highMidi = Math.round(frequencyToMidi(highFrequency))
  const speechCenterMidi = getMedianSampleMidi(draft.speech.samples)
  const suggestedBaseMidi = getSuggestedBaseMidi(lowMidi, denseHighMidi ?? highMidi)
  const semitones = Math.max(0, highMidi - lowMidi)
  const analysis = buildDetailedVocalRangeAnalysis(draft)

  return {
    schemaVersion: 1,
    lowFrequency: midiToFrequency(lowMidi),
    highFrequency: midiToFrequency(highMidi),
    lowNote: midiToNoteName(lowMidi) ?? '--',
    highNote: midiToNoteName(highMidi) ?? '--',
    denseHighNote: denseHighMidi === null ? null : midiToNoteName(denseHighMidi),
    lightHighNote: lightHighMidi === null ? null : midiToNoteName(lightHighMidi),
    speechCenterNote: speechCenterMidi === null ? null : midiToNoteName(speechCenterMidi),
    breakEstimate: estimateVocalBreak(analysis.voiceBreakEvents),
    semitones,
    octaves: semitones / 12,
    octaveLabel: formatOctaves(semitones),
    suggestedBaseMidi,
    typeEstimate: estimateVoiceType(lowMidi, denseHighMidi ?? highMidi, speechCenterMidi),
    analysis,
    capturedAt: new Date().toISOString(),
  }
}

export function buildDetailedVocalRangeAnalysis(draft: VocalRangeDraft): VocalRangeAnalysis {
  const frames = buildPitchFrames(draft)
  const reliableFrames = frames.filter(isReliableVoicedFrame)
  const voiceBreakEvents = detectVoiceBreakEvents(reliableFrames)
  const segments = segmentVoiceFrames(reliableFrames, voiceBreakEvents)
  const noteAnalyses = analyzeNotes(segments)
  const probableTransitionZones = estimateTransitionZones(noteAnalyses, voiceBreakEvents)
  const registerLikeZones = estimateRegisterLikeZones(noteAnalyses)
  const sustainedSegments = segments.filter(
    (segment) =>
      segment.sourceStepId !== 'break' &&
      segment.sourceStepId !== 'speech' &&
      segment.durationMs >= VOCAL_ANALYSIS_CONFIG.minSustainedDurationMs &&
      segment.voicedRatio >= 0.75 &&
      (segment.pitchStdDevCents ?? Number.POSITIVE_INFINITY) <=
        VOCAL_ANALYSIS_CONFIG.sustainedPitchStdDevCents,
  )
  const sustainedRange = getRangeFromSegments(
    sustainedSegments,
    sustainedSegments.length >= 3 ? 'high' : sustainedSegments.length > 0 ? 'medium' : 'insufficient_data',
  )
  const durationMs = getAnalysisDuration(frames)
  const warnings = getAnalysisWarnings(
    frames,
    reliableFrames,
    probableTransitionZones,
    sustainedSegments,
  )

  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    protocol: 'free_range',
    durationMs,
    frameCount: frames.length,
    absoluteRange: getRangeFromFrames(reliableFrames, reliableFrames.length >= 40 ? 'medium' : 'low'),
    reliableRange: getReliableRange(reliableFrames),
    sustainedRange,
    usableRange: getRangeFromNotes(
      noteAnalyses.filter((note) => note.usableScore >= 68),
      noteAnalyses.filter((note) => note.usableScore >= 68).length >= 3 ? 'high' : 'medium',
    ),
    comfortableTessitura: getComfortableTessitura(noteAnalyses),
    noteAnalyses,
    segments,
    voiceBreakEvents,
    probableTransitionZones,
    registerLikeZones,
    stageSummaries: buildStageSummaries(frames, segments, voiceBreakEvents),
    warnings,
  }
}

export function readVocalRangeResult(): VocalRangeResult | null {
  try {
    const saved = localStorage.getItem(VOCAL_RANGE_STORAGE_KEY)

    if (!saved) {
      return null
    }

    const parsed = JSON.parse(saved)

    if (!isVocalRangeResult(parsed)) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function saveVocalRangeResult(result: VocalRangeResult) {
  localStorage.setItem(VOCAL_RANGE_STORAGE_KEY, JSON.stringify(result))

  return result
}

export function clearVocalRangeResult() {
  localStorage.removeItem(VOCAL_RANGE_STORAGE_KEY)
}

export function buildPitchFrames(draft: VocalRangeDraft): PitchFrame[] {
  const timestamps = Object.values(draft)
    .flatMap((step) => step.samples)
    .map((sample) => sample.capturedAt)
  const firstTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : 0

  return Object.entries(draft)
    .flatMap(([stepId, step]) =>
      step.samples.map((sample) => {
        const midi = frequencyToMidi(sample.frequency)
        const roundedMidi = Math.round(midi)
        const sourceStepId = stepId as VocalRangeStepId

        return {
          timeMs: sample.capturedAt - firstTimestamp,
          frequency: sample.frequency,
          midi,
          noteName: midiToNoteName(roundedMidi),
          centsFromNearestSemitone: centsFromNearestSemitone(sample.frequency),
          confidence: sample.clarity,
          rms: sample.volume,
          isVoiced:
            sample.clarity >= VOCAL_ANALYSIS_CONFIG.minVoicedConfidence &&
            sample.volume >= VOCAL_ANALYSIS_CONFIG.minRms,
          sourceStepId,
          stage: getDiagnosticStage(sourceStepId),
        }
      }),
    )
    .sort((a, b) => a.timeMs - b.timeMs)
}

function getDiagnosticStage(stepId: VocalRangeStepId): VocalDiagnosticStage {
  switch (stepId) {
    case 'speech':
      return 'spoken'
    case 'low':
      return 'comfortable_low'
    case 'break':
      return 'siren_break'
    case 'denseHigh':
      return 'dense_high'
    case 'lightHigh':
      return 'light_high'
  }
}

function segmentVoiceFrames(frames: PitchFrame[], breakEvents: VoiceBreakEvent[]): VoiceSegment[] {
  const segments: PitchFrame[][] = []
  let currentSegment: PitchFrame[] = []

  for (const frame of frames) {
    const previous = currentSegment.at(-1)

    if (!previous) {
      currentSegment = [frame]
      continue
    }

    const gapMs = frame.timeMs - previous.timeMs
    const pitchGap = Math.abs((frame.midi ?? 0) - (previous.midi ?? 0))
    const shouldSplit =
      gapMs > VOCAL_ANALYSIS_CONFIG.maxSegmentGapMs ||
      pitchGap > VOCAL_ANALYSIS_CONFIG.noteChangeSplitSemitones ||
      frame.sourceStepId !== previous.sourceStepId

    if (shouldSplit) {
      segments.push(currentSegment)
      currentSegment = [frame]
    } else {
      currentSegment.push(frame)
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment)
  }

  return segments
    .map((segmentFrames, index) => buildVoiceSegment(segmentFrames, index, breakEvents))
    .filter((segment) => segment.durationMs >= VOCAL_ANALYSIS_CONFIG.minSegmentDurationMs)
}

function buildVoiceSegment(
  frames: PitchFrame[],
  index: number,
  breakEvents: VoiceBreakEvent[],
): VoiceSegment {
  const startMs = frames[0]?.timeMs ?? 0
  const endMs = frames.at(-1)?.timeMs ?? startMs
  const durationMs = Math.max(0, endMs - startMs)
  const trimmedFrames = trimSegmentFrames(frames)
  const analysisFrames = trimmedFrames.length >= 3 ? trimmedFrames : frames
  const roundedMidi = getMedianFrameMidi(analysisFrames)
  const centsValues = roundedMidi === null ? [] : getCentsValues(analysisFrames, roundedMidi)
  const meanCentsOffset = centsValues.length ? mean(centsValues) : null
  const pitchStdDevCents = centsValues.length > 1 ? standardDeviation(centsValues) : null
  const driftCents = roundedMidi === null ? null : getDriftCents(analysisFrames, roundedMidi)
  const meanRms = mean(frames.map((frame) => frame.rms))
  const attack = analyzeAttack(frames, roundedMidi)
  const hasVoiceBreak = breakEvents.some(
    (event) => event.timeMs >= startMs && event.timeMs <= endMs && event.severity !== 'low',
  )

  return {
    id: `segment-${index + 1}`,
    startMs,
    endMs,
    durationMs,
    frames,
    stage: frames[0]?.stage ?? 'siren_break',
    sourceStepId: frames[0]?.sourceStepId ?? 'break',
    medianMidi: roundedMidi,
    roundedMidi,
    noteName: roundedMidi === null ? null : midiToNoteName(roundedMidi),
    meanCentsOffset,
    pitchStdDevCents,
    driftCents,
    meanRms,
    voicedRatio: frames.filter((frame) => frame.isVoiced).length / Math.max(1, frames.length),
    hasVoiceBreak,
    attackOffsetCents: attack.attackOffsetCents,
    attackClassification: attack.attackClassification,
  }
}

function analyzeNotes(segments: VoiceSegment[]): NoteAnalysis[] {
  const grouped = new Map<number, VoiceSegment[]>()

  for (const segment of segments) {
    if (segment.roundedMidi === null) {
      continue
    }

    grouped.set(segment.roundedMidi, [...(grouped.get(segment.roundedMidi) ?? []), segment])
  }

  return Array.from(grouped.entries())
    .map(([midi, noteSegments]) => buildNoteAnalysis(midi, noteSegments))
    .sort((a, b) => a.midi - b.midi)
}

function buildNoteAnalysis(midi: number, segments: VoiceSegment[]): NoteAnalysis {
  const bestSegment = [...segments].sort((a, b) => getSegmentUsableScore(b) - getSegmentUsableScore(a))[0]
  const stages = Array.from(new Set(segments.map((segment) => segment.stage))).sort()
  const pitchStdDevValues = segments
    .map((segment) => segment.pitchStdDevCents)
    .filter((value): value is number => value !== null)
  const meanCentsValues = segments
    .map((segment) => segment.meanCentsOffset)
    .filter((value): value is number => value !== null)
  const driftValues = segments
    .map((segment) => segment.driftCents)
    .filter((value): value is number => value !== null)
  const stabilityScore = scoreStability(bestSegment.pitchStdDevCents)
  const sustainScore = scoreSustain(bestSegment.durationMs, bestSegment.voicedRatio)
  const attackScore = scoreAttack(bestSegment.attackOffsetCents, bestSegment.attackClassification)
  const intensityScore = scoreIntensity(bestSegment.meanRms)
  const usableScore = Math.round(
    stabilityScore * 0.4 + sustainScore * 0.25 + attackScore * 0.2 + intensityScore * 0.15,
  )
  const classification = classifyNote(midi, bestSegment, usableScore)

  return {
    midi,
    noteName: midiToNoteName(midi) ?? '--',
    segmentsCount: segments.length,
    bestSegmentId: bestSegment.id,
    meanCentsOffset: meanCentsValues.length ? mean(meanCentsValues) : null,
    pitchStdDevCents: pitchStdDevValues.length ? mean(pitchStdDevValues) : null,
    bestPitchStdDevCents: bestSegment.pitchStdDevCents,
    meanRms: mean(segments.map((segment) => segment.meanRms)),
    voicedRatio: mean(segments.map((segment) => segment.voicedRatio)),
    driftCents: driftValues.length ? mean(driftValues) : null,
    stabilityScore,
    sustainScore,
    attackScore,
    intensityScore,
    usableScore,
    classification,
    observations: getNoteObservations(bestSegment, classification),
    stages,
  }
}

function detectVoiceBreakEvents(frames: PitchFrame[]): VoiceBreakEvent[] {
  const events: VoiceBreakEvent[] = []
  const sirenFrames = frames.filter((frame) => frame.stage === 'siren_break')
  const stageStartMs = sirenFrames[0]?.timeMs ?? 0

  for (let index = 1; index < sirenFrames.length; index += 1) {
    const previous = sirenFrames[index - 1]
    const current = sirenFrames[index]
    const evidence: string[] = []
    const gapMs = current.timeMs - previous.timeMs

    if (current.stage !== previous.stage) {
      continue
    }

    if (gapMs > VOCAL_ANALYSIS_CONFIG.maxBreakFrameGapMs) {
      continue
    }

    if (current.timeMs - stageStartMs < VOCAL_ANALYSIS_CONFIG.stageOnsetIgnoreMs) {
      continue
    }

    if (!isReliableVoicedFrame(previous) || !isReliableVoicedFrame(current)) {
      continue
    }

    const pitchJumpCents = Math.abs(((current.midi ?? 0) - (previous.midi ?? 0)) * 100)
    const rmsDropRatio =
      previous.rms > 0 ? Math.max(0, (previous.rms - current.rms) / previous.rms) : 0
    const confidenceDrop = previous.confidence - current.confidence

    if (pitchJumpCents > VOCAL_ANALYSIS_CONFIG.pitchJumpBreakCents) {
      evidence.push('salto súbito de pitch')
    }

    if (rmsDropRatio >= VOCAL_ANALYSIS_CONFIG.rmsDropBreakRatio) {
      evidence.push('queda súbita de intensidade')
    }

    if (confidenceDrop > 0.24) {
      evidence.push('queda de clareza do pitch')
    }

    if (evidence.length === 0) {
      continue
    }

    events.push({
      timeMs: current.timeMs,
      midiBefore: previous.midi === null ? null : Math.round(previous.midi),
      midiAfter: current.midi === null ? null : Math.round(current.midi),
      noteBefore: previous.noteName,
      noteAfter: current.noteName,
      severity: evidence.length >= 3 ? 'high' : evidence.length === 2 ? 'medium' : 'low',
      evidence,
    })
  }

  return events
}

function estimateTransitionZones(
  noteAnalyses: NoteAnalysis[],
  breakEvents: VoiceBreakEvent[],
): TransitionZone[] {
  const transitionNotes = noteAnalyses.filter((note) =>
    note.stages.some((stage) => stage === 'siren_break' || stage === 'dense_high' || stage === 'light_high'),
  )

  if (transitionNotes.length < 3) {
    return []
  }

  const evidenceByMidi = new Map<number, string[]>()
  const notesByMidi = new Map(transitionNotes.map((note) => [note.midi, note]))
  const breakEventMidis: number[] = []
  let sirenEvidenceCount = 0

  for (const note of transitionNotes) {
    const evidence: string[] = []
    const fromSiren = note.stages.includes('siren_break')

    if (!fromSiren && note.classification !== 'transition_unstable') {
      continue
    }

    if (fromSiren && note.stabilityScore < 55) {
      evidence.push('instabilidade de pitch aumenta nesta região')
    }

    if (fromSiren && (note.voicedRatio ?? 1) < 0.78) {
      evidence.push('proporção de voz detectada diminui')
    }

    if (fromSiren && Math.abs(note.driftCents ?? 0) > 65) {
      evidence.push('drift de pitch relevante')
    }

    if (note.classification === 'transition_unstable') {
      evidence.push('classificação acústica instável')
    }

    if (evidence.length > 0) {
      evidenceByMidi.set(note.midi, evidence)

      if (fromSiren) {
        sirenEvidenceCount += 1
      }
    }
  }

  for (const event of breakEvents) {
    if (event.severity === 'low') {
      continue
    }

    const midi = event.midiAfter ?? event.midiBefore

    if (midi === null) {
      continue
    }

    evidenceByMidi.set(midi, [...(evidenceByMidi.get(midi) ?? []), ...event.evidence])
    breakEventMidis.push(midi)
    sirenEvidenceCount += event.severity === 'high' ? 2 : 1
  }

  if (sirenEvidenceCount < 2) {
    return []
  }

  const candidateMidis = Array.from(evidenceByMidi.entries())
    .filter(([, evidence]) => new Set(evidence).size >= 2)
    .map(([midi]) => midi)
    .filter((midi) =>
      breakEventMidis.length > 0
        ? breakEventMidis.some((eventMidi) => Math.abs(midi - eventMidi) <= 4)
        : midi >= 60,
    )
    .sort((a, b) => a - b)

  if (candidateMidis.length === 0) {
    return []
  }

  const groups = groupContiguousMidis(candidateMidis, 2)

  return groups.slice(0, 2).map((group) => {
    const fromMidi = Math.max(Math.min(...group) - 1, transitionNotes[0].midi)
    const toMidi = Math.min(Math.max(...group) + 1, transitionNotes.at(-1)?.midi ?? Math.max(...group))
    const evidence = Array.from(
      new Set(group.flatMap((midi) => evidenceByMidi.get(midi) ?? [])),
    ).slice(0, 5)
    const nearbyNotes = group
      .map((midi) => notesByMidi.get(midi))
      .filter((note): note is NoteAnalysis => Boolean(note))
    const averageWeakness = nearbyNotes.length
      ? mean(nearbyNotes.map((note) => 100 - note.usableScore))
      : 40

    return {
      fromMidi,
      toMidi,
      fromNote: midiToNoteName(fromMidi) ?? '--',
      toNote: midiToNoteName(toMidi) ?? '--',
      confidence: Math.round(clamp((evidence.length * 18 + averageWeakness) / 100, 0, 1) * 100) / 100,
      evidence,
    }
  })
}

function estimateRegisterLikeZones(noteAnalyses: NoteAnalysis[]): RegisterLikeZones | null {
  if (noteAnalyses.length < 3) {
    return null
  }

  const denseNotes = noteAnalyses.filter(
    (note) =>
      note.stages.includes('dense_high') &&
      (note.classification === 'dense_like_stable' ||
        note.classification === 'dense_like_unstable'),
  )
  const transitionNotes = noteAnalyses.filter(
    (note) => note.stages.includes('siren_break') && note.classification === 'transition_unstable',
  )
  const lightNotes = noteAnalyses.filter(
    (note) =>
      note.stages.includes('light_high') &&
      (note.classification === 'light_like_stable' ||
        note.classification === 'light_like_breathy_or_weak'),
  )

  return {
    denseLikely: denseNotes.length >= 2 ? getRangeFromNotes(denseNotes, 'medium') : null,
    transitionLikely: transitionNotes.length >= 2 ? getRangeFromNotes(transitionNotes, 'medium') : null,
    lightLikely: lightNotes.length >= 2 ? getRangeFromNotes(lightNotes, 'medium') : null,
  }
}

function isReliableVoicedFrame(frame: PitchFrame) {
  return (
    frame.isVoiced &&
    frame.frequency !== null &&
    frame.midi !== null &&
    frame.confidence >= VOCAL_ANALYSIS_CONFIG.minVoicedConfidence &&
    frame.rms >= VOCAL_ANALYSIS_CONFIG.minRms
  )
}

function trimSegmentFrames(frames: PitchFrame[]) {
  const startMs = frames[0]?.timeMs ?? 0
  const endMs = frames.at(-1)?.timeMs ?? startMs

  return frames.filter(
    (frame) =>
      frame.timeMs >= startMs + VOCAL_ANALYSIS_CONFIG.releaseTrimMs &&
      frame.timeMs <= endMs - VOCAL_ANALYSIS_CONFIG.releaseTrimMs,
  )
}

function getMedianFrameMidi(frames: PitchFrame[]) {
  const midiValues = frames
    .map((frame) => frame.midi)
    .filter((value): value is number => value !== null)
    .map(Math.round)

  if (midiValues.length === 0) {
    return null
  }

  return Math.round(median(midiValues))
}

function getCentsValues(frames: PitchFrame[], midi: number) {
  return frames
    .map((frame) =>
      frame.frequency === null ? null : centsBetweenFrequencyAndMidi(frame.frequency, midi),
    )
    .filter((value): value is number => value !== null)
}

function getDriftCents(frames: PitchFrame[], midi: number) {
  if (frames.length < 6) {
    return null
  }

  const midpoint = Math.floor(frames.length / 2)
  const firstHalf = getCentsValues(frames.slice(0, midpoint), midi)
  const secondHalf = getCentsValues(frames.slice(midpoint), midi)

  if (firstHalf.length === 0 || secondHalf.length === 0) {
    return null
  }

  return median(secondHalf) - median(firstHalf)
}

function analyzeAttack(frames: PitchFrame[], midi: number | null) {
  if (midi === null || frames.length < 4) {
    return {
      attackOffsetCents: null,
      attackClassification: 'not_enough_data' as AttackClassification,
    }
  }

  const startMs = frames[0].timeMs
  const attackFrames = frames.filter(
    (frame) => frame.timeMs <= startMs + VOCAL_ANALYSIS_CONFIG.attackWindowMs,
  )
  const stableFrames = trimSegmentFrames(frames)
  const attackCents = getCentsValues(attackFrames, midi)
  const stableCents = getCentsValues(stableFrames.length ? stableFrames : frames, midi)

  if (attackCents.length < 2 || stableCents.length < 2) {
    return {
      attackOffsetCents: null,
      attackClassification: 'not_enough_data' as AttackClassification,
    }
  }

  const attackOffsetCents = median(attackCents) - median(stableCents)
  const attackSpread = standardDeviation(attackCents)
  let attackClassification: AttackClassification = 'centered'

  if (attackSpread > 85) {
    attackClassification = 'unstable_attack'
  } else if (attackOffsetCents <= -35) {
    attackClassification = 'starts_low'
  } else if (attackOffsetCents >= 35) {
    attackClassification = 'starts_high'
  }

  return {
    attackOffsetCents,
    attackClassification,
  }
}

function getSegmentUsableScore(segment: VoiceSegment) {
  return Math.round(
    scoreStability(segment.pitchStdDevCents) * 0.4 +
      scoreSustain(segment.durationMs, segment.voicedRatio) * 0.25 +
      scoreAttack(segment.attackOffsetCents, segment.attackClassification) * 0.2 +
      scoreIntensity(segment.meanRms) * 0.15,
  )
}

function scoreStability(pitchStdDevCents: number | null) {
  if (pitchStdDevCents === null) {
    return 0
  }

  if (pitchStdDevCents <= 15) {
    return 100
  }

  if (pitchStdDevCents <= 30) {
    return 80
  }

  if (pitchStdDevCents <= 50) {
    return 60
  }

  if (pitchStdDevCents <= 75) {
    return 40
  }

  if (pitchStdDevCents <= 100) {
    return 20
  }

  return 0
}

function scoreSustain(durationMs: number, voicedRatio: number) {
  const durationScore = clamp(durationMs / VOCAL_ANALYSIS_CONFIG.minSustainedDurationMs, 0, 1) * 100
  const voicedScore = clamp(voicedRatio, 0, 1) * 100

  return Math.round(durationScore * 0.55 + voicedScore * 0.45)
}

function scoreAttack(offsetCents: number | null, classification: AttackClassification) {
  if (offsetCents === null || classification === 'not_enough_data') {
    return 55
  }

  if (classification === 'unstable_attack') {
    return 35
  }

  const absOffset = Math.abs(offsetCents)

  if (absOffset <= 15) {
    return 100
  }

  if (absOffset <= 35) {
    return 82
  }

  if (absOffset <= 65) {
    return 62
  }

  if (absOffset <= 100) {
    return 40
  }

  return 20
}

function scoreIntensity(meanRms: number) {
  if (meanRms < VOCAL_ANALYSIS_CONFIG.minRms) {
    return 0
  }

  if (meanRms < 0.025) {
    return 45
  }

  if (meanRms < 0.055) {
    return 72
  }

  if (meanRms < 0.22) {
    return 92
  }

  return 78
}

function classifyNote(
  midi: number,
  segment: VoiceSegment,
  usableScore: number,
): VocalZoneClassification {
  if (
    segment.frames.length < VOCAL_ANALYSIS_CONFIG.reliableMinFramesPerNote ||
    segment.voicedRatio < 0.65
  ) {
    return 'not_enough_data'
  }

  if (
    segment.stage === 'siren_break' &&
    (segment.hasVoiceBreak || usableScore < 50 || (segment.pitchStdDevCents ?? 0) > 75)
  ) {
    return 'transition_unstable'
  }

  if (segment.stage === 'light_high' && midi >= 64) {
    return usableScore >= 68 ? 'light_like_stable' : 'light_like_breathy_or_weak'
  }

  if (midi >= 67 && segment.meanRms < 0.045 && segment.stage !== 'dense_high') {
    return usableScore >= 68 ? 'light_like_stable' : 'light_like_breathy_or_weak'
  }

  if (
    segment.stage === 'dense_high' &&
    usableScore >= 75 &&
    segment.meanRms >= 0.035 &&
    segment.voicedRatio >= 0.8 &&
    segment.durationMs >= VOCAL_ANALYSIS_CONFIG.minSegmentDurationMs
  ) {
    return 'dense_like_stable'
  }

  if (
    segment.stage === 'dense_high' &&
    usableScore >= 58 &&
    segment.meanRms >= 0.025 &&
    segment.voicedRatio >= 0.72
  ) {
    return 'dense_like_unstable'
  }

  return 'unclassified'
}

function getNoteObservations(segment: VoiceSegment, classification: VocalZoneClassification) {
  const observations: string[] = []

  if (segment.attackClassification === 'starts_low') {
    observations.push('ataque começa abaixo')
  }

  if (segment.attackClassification === 'starts_high') {
    observations.push('ataque começa acima')
  }

  if (Math.abs(segment.driftCents ?? 0) > 55) {
    observations.push('drift perceptível')
  }

  if (segment.hasVoiceBreak) {
    observations.push('possível quebra dentro do segmento')
  }

  if (classification === 'light_like_breathy_or_weak') {
    observations.push('pouca energia acústica no agudo (voz soprada ou fraca)')
  }

  return observations.length ? observations : ['estável o suficiente para a análise']
}

function getRangeFromFrames(
  frames: PitchFrame[],
  reliability: AnalysisReliability = 'medium',
): RangeResult | null {
  const midiValues = frames
    .map((frame) => frame.midi)
    .filter((midi): midi is number => midi !== null)
    .map(Math.round)

  return getRangeFromMidis(midiValues, reliability)
}

function getReliableRange(frames: PitchFrame[]): RangeResult | null {
  const countsByMidi = new Map<number, number>()

  for (const frame of frames) {
    if (frame.midi === null) {
      continue
    }

    const roundedMidi = Math.round(frame.midi)
    countsByMidi.set(roundedMidi, (countsByMidi.get(roundedMidi) ?? 0) + 1)
  }

  const reliableMidis = Array.from(countsByMidi.entries())
    .filter(([, count]) => count >= VOCAL_ANALYSIS_CONFIG.reliableMinFramesPerNote)
    .map(([midi]) => midi)

  if (reliableMidis.length === 0) {
    return null
  }

  const supportingFrameCount = reliableMidis.reduce(
    (sum, midi) => sum + (countsByMidi.get(midi) ?? 0),
    0,
  )
  const reliability: AnalysisReliability =
    reliableMidis.length >= 6 && supportingFrameCount >= 50
      ? 'high'
      : reliableMidis.length >= 3 && supportingFrameCount >= 24
        ? 'medium'
        : 'low'

  return getRangeFromMidis(reliableMidis, reliability)
}

function getRangeFromSegments(
  segments: VoiceSegment[],
  reliability: AnalysisReliability = 'medium',
): RangeResult | null {
  return getRangeFromMidis(
    segments
      .map((segment) => segment.roundedMidi)
      .filter((midi): midi is number => midi !== null),
    reliability,
  )
}

function getRangeFromNotes(
  notes: NoteAnalysis[],
  reliability: AnalysisReliability = 'medium',
): RangeResult | null {
  return getRangeFromMidis(notes.map((note) => note.midi), reliability)
}

function getRangeFromMidis(
  midis: number[],
  reliability: AnalysisReliability = 'medium',
): RangeResult | null {
  const finiteMidis = midis.filter(Number.isFinite)

  if (finiteMidis.length === 0) {
    return null
  }

  const lowestMidi = Math.round(Math.min(...finiteMidis))
  const highestMidi = Math.round(Math.max(...finiteMidis))

  return {
    lowestMidi,
    highestMidi,
    lowestNote: midiToNoteName(lowestMidi) ?? '--',
    highestNote: midiToNoteName(highestMidi) ?? '--',
    reliability,
  }
}

function getComfortableTessitura(notes: NoteAnalysis[]): RangeResult | null {
  const comfortableMidis = notes
    .filter((note) => note.usableScore >= 75 && note.segmentsCount >= 1)
    .map((note) => note.midi)
    .sort((a, b) => a - b)

  if (comfortableMidis.length < 2) {
    return null
  }

  const groups = groupContiguousMidis(comfortableMidis, 1)
  const bestGroup = groups.sort((a, b) => {
    if (b.length !== a.length) {
      return b.length - a.length
    }

    const scoreA = mean(a.map((midi) => notes.find((note) => note.midi === midi)?.usableScore ?? 0))
    const scoreB = mean(b.map((midi) => notes.find((note) => note.midi === midi)?.usableScore ?? 0))

    return scoreB - scoreA
  })[0]

  return bestGroup ? getRangeFromMidis(bestGroup) : null
}

function groupContiguousMidis(midis: number[], maxGap: number) {
  const sorted = [...new Set(midis)].sort((a, b) => a - b)
  const groups: number[][] = []
  let currentGroup: number[] = []

  for (const midi of sorted) {
    const previous = currentGroup.at(-1)

    if (previous === undefined || midi - previous <= maxGap) {
      currentGroup.push(midi)
    } else {
      groups.push(currentGroup)
      currentGroup = [midi]
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

function getAnalysisDuration(frames: PitchFrame[]) {
  if (frames.length < 2) {
    return 0
  }

  return (frames.at(-1)?.timeMs ?? 0) - frames[0].timeMs
}

function buildStageSummaries(
  frames: PitchFrame[],
  segments: VoiceSegment[],
  voiceBreakEvents: VoiceBreakEvent[],
): StageAnalysisSummary[] {
  return STAGE_ORDER.map((stage) => {
    const stageFrames = frames.filter((frame) => frame.stage === stage)
    const voicedFrames = stageFrames.filter((frame) => frame.isVoiced)
    const midiValues = voicedFrames
      .map((frame) => frame.midi)
      .filter((midi): midi is number => midi !== null)
      .map(Math.round)
    const stageSegments = segments.filter((segment) => segment.stage === stage)
    const startMs = stageFrames[0]?.timeMs ?? null
    const endMs = stageFrames.at(-1)?.timeMs ?? null
    const breakEventCount =
      startMs === null || endMs === null
        ? 0
        : voiceBreakEvents.filter((event) => event.timeMs >= startMs && event.timeMs <= endMs).length
    const minMidi = midiValues.length > 0 ? Math.min(...midiValues) : null
    const maxMidi = midiValues.length > 0 ? Math.max(...midiValues) : null
    const medianMidi = midiValues.length > 0 ? Math.round(median(midiValues)) : null

    return {
      stage,
      label: STAGE_LABELS[stage],
      frameCount: stageFrames.length,
      voicedFrameCount: voicedFrames.length,
      minNote: minMidi === null ? null : midiToNoteName(minMidi),
      maxNote: maxMidi === null ? null : midiToNoteName(maxMidi),
      medianNote: medianMidi === null ? null : midiToNoteName(medianMidi),
      averageConfidence: stageFrames.length ? mean(stageFrames.map((frame) => frame.confidence)) : null,
      averageRms: stageFrames.length ? mean(stageFrames.map((frame) => frame.rms)) : null,
      segmentCount: stageSegments.length,
      breakEventCount,
    }
  })
}

function getAnalysisWarnings(
  frames: PitchFrame[],
  reliableFrames: PitchFrame[],
  transitionZones: TransitionZone[],
  sustainedSegments: VoiceSegment[],
) {
  const warnings: string[] = []

  if (frames.length === 0) {
    warnings.push('Nenhum áudio com pitch foi capturado.')
  }

  if (reliableFrames.length < 20) {
    warnings.push('Pouca voz estável foi detectada; a análise pode estar incompleta.')
  }

  if (sustainedSegments.length === 0) {
    warnings.push('Dados insuficientes para notas sustentadas. Tente sustentar algumas notas por mais tempo.')
  } else if (new Set(sustainedSegments.map((segment) => segment.roundedMidi)).size === 1) {
    warnings.push('Apenas uma nota sustentada foi detectada com confiança.')
  }

  if (transitionZones.length === 0) {
    warnings.push('A estimativa de transição precisa de mais dados na região da sirene e agudo.')
  }

  warnings.push('Classificações de registro são estimativas acústicas, não diagnóstico fisiológico.')

  return warnings
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const midpoint = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint]
}

function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return 0
  }

  const average = mean(values)
  const variance = mean(values.map((value) => (value - average) ** 2))

  return Math.sqrt(variance)
}

export function getStepSampleCount(draft: VocalRangeDraft, stepId: VocalRangeStepId) {
  return draft[stepId].samples.length
}

export function getTotalSampleCount(draft: VocalRangeDraft) {
  return Object.values(draft).reduce((sum, step) => sum + step.samples.length, 0)
}

function getLowFrequency(draft: VocalRangeDraft) {
  const candidates = Object.values(draft)
    .map((step) => step.lowFrequency)
    .filter((frequency): frequency is number => frequency !== null)

  if (candidates.length === 0) {
    return null
  }

  return Math.min(...candidates)
}

function getSuggestedBaseMidi(lowMidi: number, denseHighMidi: number) {
  const lowestComfortableRoot = lowMidi + 3
  const highestRootWithOctaveRoom = denseHighMidi - 12
  const target = Math.min(Math.max(lowestComfortableRoot, 48), highestRootWithOctaveRoom)

  return clamp(target, 48, 60)
}

function getMedianMidi(samples: number[]) {
  if (samples.length < 4) {
    return null
  }

  const midiSamples = samples
    .map((frequency) => Math.round(frequencyToMidi(frequency)))
    .sort((a, b) => a - b)
  const midpoint = Math.floor(midiSamples.length / 2)

  return midiSamples.length % 2 === 0
    ? Math.round((midiSamples[midpoint - 1] + midiSamples[midpoint]) / 2)
    : midiSamples[midpoint]
}

function getMedianSampleMidi(samples: VocalRangeSample[]) {
  return getMedianMidi(samples.map((sample) => sample.frequency))
}

function estimateVocalBreak(events: VoiceBreakEvent[]): BreakEstimate {
  const strongestEvent = [...events]
    .filter((event) => event.severity !== 'low')
    .sort((a, b) => getBreakSeverityScore(b) - getBreakSeverityScore(a))[0]

  if (!strongestEvent) {
    return null
  }

  const breakMidi = strongestEvent.midiAfter ?? strongestEvent.midiBefore

  if (breakMidi === null) {
    return null
  }

  return {
    note: midiToNoteName(breakMidi) ?? '--',
    frequency: midiToFrequency(breakMidi),
    confidence: strongestEvent.severity === 'high' ? 82 : 64,
    detail: `Detectado na sirene por ${strongestEvent.evidence.join(', ')}.`,
  }
}

function getBreakSeverityScore(event: VoiceBreakEvent) {
  const severityScore = event.severity === 'high' ? 3 : event.severity === 'medium' ? 2 : 1

  return severityScore * 10 + event.evidence.length
}

function estimateVoiceType(
  lowMidi: number,
  denseHighMidi: number,
  speechCenterMidi: number | null,
): VocalTypeEstimate {
  const scores = VOICE_TYPES.map((profile) => {
    const overlap = Math.max(
      0,
      Math.min(denseHighMidi, profile.highMidi) - Math.max(lowMidi, profile.lowMidi),
    )
    const overlapScore = overlap / (profile.highMidi - profile.lowMidi)
    const center = (lowMidi + denseHighMidi) / 2
    const rangeCenter = (profile.lowMidi + profile.highMidi) / 2
    const rangeCenterScore = 1 - clamp(Math.abs(center - rangeCenter) / 18, 0, 1)
    const speechScore =
      speechCenterMidi === null
        ? 0.45
        : 1 - clamp(Math.abs(speechCenterMidi - profile.speechCenterMidi) / 14, 0, 1)

    return {
      profile,
      score: overlapScore * 0.5 + rangeCenterScore * 0.25 + speechScore * 0.25,
    }
  }).sort((a, b) => b.score - a.score)

  const best = scores[0]
  const confidence = Math.round(clamp(best.score, 0, 1) * 100)

  return {
    label: best.profile.label,
    confidence,
    detail:
      'Estimativa baseada na voz cheia e centro da fala. Classificação vocal real também depende de timbre, passaggi e conforto sustentado.',
  }
}

function formatOctaves(semitones: number) {
  const octaves = semitones / 12

  if (semitones < 12) {
    return `${semitones} semitons`
  }

  return `${octaves.toFixed(1)} oitavas`
}

function isVocalRangeResult(value: unknown): value is VocalRangeResult {
  if (!value || typeof value !== 'object') {
    return false
  }

  const result = value as VocalRangeResult

  return (
    typeof result.lowFrequency === 'number' &&
    typeof result.highFrequency === 'number' &&
    typeof result.lowNote === 'string' &&
    typeof result.highNote === 'string' &&
    typeof result.semitones === 'number' &&
    ('breakEstimate' in result) &&
    typeof result.octaves === 'number' &&
    typeof result.octaveLabel === 'string' &&
    typeof result.suggestedBaseMidi === 'number' &&
    typeof result.typeEstimate === 'object' &&
    typeof result.capturedAt === 'string'
  )
}
