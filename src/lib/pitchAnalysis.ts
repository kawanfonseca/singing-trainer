import { PitchDetector } from 'pitchy'
import { frequencyToMidi, midiToFrequency, midiToNoteName } from './music'
import type { RangeResult, VocalRangeResult } from './vocalRange'

export const PITCH_BANDS = { excellent: 15, good: 30, attention: 45, betweenNotes: 50 } as const

const FRAME_SIZE = 2048
const HOP_SIZE = 1024
const MIN_FREQUENCY = 70
const MAX_FREQUENCY = 1200
const MIN_CLARITY = 0.78
const RELIABLE_CLARITY = 0.82
const MIN_RMS = 0.008
const PHRASE_GAP_SECONDS = 0.65
const SUSTAINED_MIN_SECONDS = 0.35
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]

export type PitchSample = { timestamp: number; frequency: number; note: string; midi: number; cents: number; confidence: number }
export type PitchZoneDistribution = { excellent: number; good: number; attention: number; betweenNotes: number }
export type ReviewMomentType = 'pitch-centering' | 'unstable' | 'end-of-phrase drop' | 'flat sustained area' | 'sharp sustained area' | 'best centered'
export type ReviewSeverity = 'minor' | 'moderate' | 'strong'
export type ReviewMoment = {
  timestamp: number; endTime: number; note: string; averageCents: number; maxDeviation: number
  duration: number; type: ReviewMomentType; signals: ReviewMomentType[]; severity: ReviewSeverity
  percentAbove30: number; driftCents: number | null; stabilityCents: number | null; endDropCents: number | null
  explanation: string
}
export type SustainedClassification = 'stable' | 'slightly drifting' | 'falling at the end' | 'rising at the end' | 'unstable'
export type AttackClassification = 'entered centered' | 'entered flat and corrected' | 'entered sharp and corrected' | 'slid into the note' | 'unstable attack' | 'unclear'
export type SustainedNote = {
  start: number; end: number; note: string; midi: number; duration: number; averageCents: number; maxDeviation: number
  startCents: number; endCents: number; driftCents: number; stabilityCents: number; confidence: number
  classification: SustainedClassification; attack: AttackClassification
}
export type NoteDistributionItem = { note: string; midi: number; seconds: number; percent: number }
export type PhraseInsight = {
  index: number; start: number; end: number; duration: number; region: string; centeringPercent: number
  averageDeviation: number; bias: 'flat' | 'sharp' | 'balanced'; classification: 'strong/reference phrase' | 'mostly stable' | 'review lightly' | 'needs review'; biggestIssue: string
}
export type EndPhraseDrop = { timestamp: number; endTime: number; note: string; dropCents: number; duration: number }
export type TakeRange = {
  lowestReliableNote: string; highestReliableNote: string; lowestSustainedNote: string | null; highestSustainedNote: string | null
  practicalRange: string; practicalRangeSource: 'sustained range' | 'central usable range'; spanSemitones: number
}
export type Tessitura = { zone: string; lowNote: string; highNote: string; lowPercent: number; middlePercent: number; highPercent: number; mostUsedOctave: string }
export type TonalCenter = { label: string | null; confidence: 'Low' | 'Medium' | 'High'; commonPitchClasses: string[]; explanation: string }
export type RangeComparison = {
  available: boolean; savedRange: string | null; withinPercent: number | null; nearLowerPercent: number | null
  nearUpperPercent: number | null; lowestRelation: string | null; highestRelation: string | null
}

export type PitchAnalysis = {
  schemaVersion: 3; samples: PitchSample[]; issues: ReviewMoment[]; reviewMoments: ReviewMoment[]
  score: number; zones: PitchZoneDistribution; centeredPercent: number; slightlyOffPercent: number; clearlyOffPercent: number
  averageDeviation: number; signedAverageDeviation: number; bias: 'tends to sing flat' | 'tends to sing sharp' | 'mostly balanced'
  analyzedTime: number; duration: number; rangeUsed: TakeRange; tessitura: Tessitura; noteDistribution: NoteDistributionItem[]
  sustainedNotes: SustainedNote[]; attackInsights: SustainedNote[]; endOfPhraseDrops: EndPhraseDrop[]
  phrases: PhraseInsight[]; tonalCenter: TonalCenter; rangeComparison: RangeComparison
}

export async function decodeAndAnalyzeAudio(file: Blob, savedRange: VocalRangeResult | null = null): Promise<{ buffer: AudioBuffer; analysis: PitchAnalysis }> {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
  const context = new AudioContextConstructor()
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer())
    return { buffer, analysis: analyzePitch(buffer, savedRange) }
  } finally { await context.close() }
}

export function analyzePitch(buffer: AudioBuffer, savedRange: VocalRangeResult | null = null): PitchAnalysis {
  const detector = PitchDetector.forFloat32Array(FRAME_SIZE)
  const mono = downmix(buffer)
  const raw: PitchSample[] = []
  for (let offset = 0; offset + FRAME_SIZE <= mono.length; offset += HOP_SIZE) {
    const frame = mono.subarray(offset, offset + FRAME_SIZE)
    if (getRms(frame) < MIN_RMS) continue
    const [frequency, clarity] = detector.findPitch(frame, buffer.sampleRate)
    if (clarity < MIN_CLARITY || frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) continue
    const midi = frequencyToMidi(frequency)
    raw.push({ timestamp: (offset + FRAME_SIZE / 2) / buffer.sampleRate, frequency, midi, note: midiToNoteName(midi) ?? '--', cents: (midi - Math.round(midi)) * 100, confidence: clarity })
  }
  const samples = smoothSamples(raw)
  if (samples.length < 3) throw new Error('No clear pitched singing was detected. Try a quieter room and sing a little longer.')

  const hopSeconds = HOP_SIZE / buffer.sampleRate
  const weights = samples.map((sample) => Math.max(0.1, (sample.confidence - MIN_CLARITY) / (1 - MIN_CLARITY)))
  const weightTotal = sum(weights)
  const weighted = (test: (sample: PitchSample) => boolean) => samples.reduce((total, sample, index) => total + (test(sample) ? weights[index] : 0), 0) / weightTotal * 100
  const zones = {
    excellent: weighted((sample) => Math.abs(sample.cents) <= PITCH_BANDS.excellent),
    good: weighted((sample) => Math.abs(sample.cents) > PITCH_BANDS.excellent && Math.abs(sample.cents) <= PITCH_BANDS.good),
    attention: weighted((sample) => Math.abs(sample.cents) > PITCH_BANDS.good && Math.abs(sample.cents) <= PITCH_BANDS.attention),
    betweenNotes: weighted((sample) => Math.abs(sample.cents) > PITCH_BANDS.attention),
  }
  const averageDeviation = samples.reduce((total, sample, index) => total + Math.abs(sample.cents) * weights[index], 0) / weightTotal
  const signedAverageDeviation = samples.reduce((total, sample, index) => total + sample.cents * weights[index], 0) / weightTotal
  const sustainedNotes = detectSustainedNotes(samples, hopSeconds)
  const phrases = detectPhrases(samples, hopSeconds)
  const endOfPhraseDrops = detectEndDrops(sustainedNotes, phrases)
  const reviewMoments = buildReviewMoments(samples, sustainedNotes, endOfPhraseDrops, hopSeconds)
  const noteDistribution = buildNoteDistribution(samples, hopSeconds)
  const acceptable = zones.excellent + zones.good

  return {
    schemaVersion: 3, samples, issues: reviewMoments, reviewMoments, score: Math.round(acceptable), zones,
    centeredPercent: acceptable, slightlyOffPercent: zones.attention, clearlyOffPercent: zones.betweenNotes,
    averageDeviation, signedAverageDeviation,
    bias: signedAverageDeviation < -7 ? 'tends to sing flat' : signedAverageDeviation > 7 ? 'tends to sing sharp' : 'mostly balanced',
    analyzedTime: samples.length * hopSeconds, duration: buffer.duration,
    rangeUsed: buildRange(samples, sustainedNotes), tessitura: buildTessitura(samples), noteDistribution, sustainedNotes,
    attackInsights: sustainedNotes.filter((note) => note.attack !== 'unclear'), endOfPhraseDrops, phrases,
    tonalCenter: estimateTonalCenter(noteDistribution, sustainedNotes, samples.length * hopSeconds),
    rangeComparison: compareRange(samples, savedRange),
  }
}

function detectSustainedNotes(samples: PitchSample[], hop: number) {
  const groups: PitchSample[][] = []
  let group: PitchSample[] = []
  for (const sample of samples) {
    const previous = group.at(-1)
    if (previous && (sample.timestamp - previous.timestamp > hop * 2.5 || Math.round(sample.midi) !== Math.round(previous.midi))) {
      if (group.length) groups.push(group)
      group = []
    }
    group.push(sample)
  }
  if (group.length) groups.push(group)
  return groups.filter((items) => segmentDuration(items, hop) >= SUSTAINED_MIN_SECONDS && average(items.map((item) => item.confidence)) >= RELIABLE_CLARITY).map((items): SustainedNote => {
    const duration = segmentDuration(items, hop)
    const averageCents = average(items.map((item) => item.cents))
    const startCents = average(items.slice(0, Math.min(3, items.length)).map((item) => item.cents))
    const endCents = average(items.slice(-Math.min(3, items.length)).map((item) => item.cents))
    const driftCents = endCents - startCents
    const stabilityCents = standardDeviation(items.map((item) => item.cents))
    const attack = classifyAttack(items, averageCents, stabilityCents)
    let classification: SustainedClassification = 'stable'
    if (stabilityCents > 14) classification = 'unstable'
    else if (driftCents < -18) classification = 'falling at the end'
    else if (driftCents > 18) classification = 'rising at the end'
    else if (Math.abs(driftCents) > 9) classification = 'slightly drifting'
    return { start: items[0].timestamp, end: items.at(-1)!.timestamp + hop, note: items[0].note, midi: Math.round(items[0].midi), duration, averageCents, maxDeviation: Math.max(...items.map((item) => Math.abs(item.cents))), startCents, endCents, driftCents, stabilityCents, confidence: average(items.map((item) => item.confidence)), classification, attack }
  })
}

function classifyAttack(items: PitchSample[], center: number, stability: number): AttackClassification {
  if (items.length < 6 || average(items.slice(0, 3).map((item) => item.confidence)) < 0.86) return 'unclear'
  const start = average(items.slice(0, 3).map((item) => item.cents))
  const corrected = Math.abs(center) + 8 < Math.abs(start)
  const earlyMovement = Math.max(...items.slice(0, 5).map((item) => item.midi)) - Math.min(...items.slice(0, 5).map((item) => item.midi))
  if (stability > 16) return 'unstable attack'
  if (earlyMovement > 0.28) return 'slid into the note'
  if (start < -18 && corrected) return 'entered flat and corrected'
  if (start > 18 && corrected) return 'entered sharp and corrected'
  if (Math.abs(start) <= PITCH_BANDS.excellent) return 'entered centered'
  return 'unclear'
}

function detectPhrases(samples: PitchSample[], hop: number): PhraseInsight[] {
  const groups: PitchSample[][] = []
  let group: PitchSample[] = []
  for (const sample of samples) {
    if (group.length && sample.timestamp - group.at(-1)!.timestamp > PHRASE_GAP_SECONDS) { groups.push(group); group = [] }
    group.push(sample)
  }
  if (group.length) groups.push(group)
  return groups.filter((items) => segmentDuration(items, hop) >= 0.7).map((items, index) => {
    const cents = items.map((item) => item.cents)
    const signedAverage = average(cents)
    const centering = items.filter((item) => Math.abs(item.cents) <= PITCH_BANDS.good).length / items.length * 100
    const regionMidis = items.map((item) => Math.round(item.midi)).sort((a, b) => a - b)
    const classification: PhraseInsight['classification'] = centering >= 90 ? 'strong/reference phrase' : centering >= 80 ? 'mostly stable' : centering >= 70 ? 'review lightly' : 'needs review'
    const bias = signedAverage < -7 ? 'flat' : signedAverage > 7 ? 'sharp' : 'balanced'
    const biggestIssue = classification === 'strong/reference phrase' ? 'use as a positive reference' : classification === 'mostly stable' ? (bias === 'balanced' ? 'small isolated deviations' : `slight ${bias} tendency`) : classification === 'review lightly' ? (bias === 'balanced' ? 'some centering variation' : `${bias} tendency`) : (bias === 'balanced' ? 'recurring centering variation' : `recurring ${bias} tendency`)
    return { index: index + 1, start: items[0].timestamp, end: items.at(-1)!.timestamp + hop, duration: segmentDuration(items, hop), region: `${midiToNoteName(quantile(regionMidis, .15))}–${midiToNoteName(quantile(regionMidis, .85))}`, centeringPercent: centering, averageDeviation: average(cents.map(Math.abs)), bias, classification, biggestIssue }
  })
}

function detectEndDrops(notes: SustainedNote[], phrases: PhraseInsight[]) {
  return notes.filter((note) => note.driftCents <= -15 && phrases.some((phrase) => Math.abs(phrase.end - note.end) <= .3)).map((note): EndPhraseDrop => ({ timestamp: Math.max(note.start, note.end - .45), endTime: note.end, note: note.note, dropCents: Math.abs(note.driftCents), duration: note.duration }))
}

function buildReviewMoments(samples: PitchSample[], notes: SustainedNote[], drops: EndPhraseDrop[], hop: number) {
  const candidates: ReviewMomentDraft[] = []
  const windows: PitchSample[][] = []
  for (let index = 0; index < samples.length; index += 5) {
    const items = samples.slice(index, index + 7).filter((item) => item.timestamp - samples[index].timestamp <= .55)
    if (items.length >= 4) windows.push(items)
  }
  for (const items of windows) {
    const avg = average(items.map((item) => item.cents)); const max = Math.max(...items.map((item) => Math.abs(item.cents)))
    if (average(items.map((item) => Math.abs(item.cents))) >= PITCH_BANDS.good) candidates.push(moment(items, hop, 'pitch-centering', avg, max, 'This region spent notable time more than 30 cents from the nearest note center.'))
  }
  notes.filter((note) => note.stabilityCents > 10).forEach((note) => candidates.push(noteMoment(note, 'unstable', `This sustained ${note.note} varied by about ${Math.round(note.stabilityCents)} cents around its average.`)))
  notes.filter((note) => Math.abs(note.averageCents) >= 20).forEach((note) => candidates.push(noteMoment(note, note.averageCents < 0 ? 'flat sustained area' : 'sharp sustained area', `This sustained area averaged ${formatSigned(note.averageCents)} from the nearest note center.`)))
  drops.forEach((drop) => candidates.push({ timestamp: drop.timestamp, endTime: drop.endTime, note: drop.note, averageCents: 0, maxDeviation: 0, duration: drop.endTime - drop.timestamp, type: 'end-of-phrase drop', driftCents: -drop.dropCents, stabilityCents: null, endDropCents: drop.dropCents, explanation: 'Pitch fell near the end of this phrase. A teacher may want to review breath, vowel shape, or tension without assuming a cause.' }))
  const centered = [...notes].filter((note) => Math.abs(note.averageCents) <= 12).sort((a, b) => Math.abs(a.averageCents) - Math.abs(b.averageCents))[0]
  if (centered) candidates.push(noteMoment(centered, 'best centered', `A well-centered sustained ${centered.note}; useful as a positive comparison point.`))
  else if (windows.length) {
    const best = [...windows].sort((a, b) => average(a.map((item) => Math.abs(item.cents))) - average(b.map((item) => Math.abs(item.cents))))[0]
    candidates.push(moment(best, hop, 'best centered', average(best.map((item) => item.cents)), Math.max(...best.map((item) => Math.abs(item.cents))), 'The most centered available region in this take; useful as a relative comparison point.'))
  }
  return mergeReviewMoments(candidates.map((candidate) => addMomentStats(candidate, samples))).sort((a, b) => reviewPriority(b) - reviewPriority(a)).slice(0, 12)
}

type ReviewMomentDraft = Omit<ReviewMoment, 'signals' | 'severity' | 'percentAbove30'>

function moment(items: PitchSample[], hop: number, type: ReviewMomentType, avg: number, max: number, explanation: string): ReviewMomentDraft { return { timestamp: items[0].timestamp, endTime: items.at(-1)!.timestamp + hop, note: mostCommon(items.map((item) => item.note)), averageCents: avg, maxDeviation: max, duration: segmentDuration(items, hop), type, driftCents: null, stabilityCents: standardDeviation(items.map((item) => item.cents)), endDropCents: null, explanation } }
function noteMoment(note: SustainedNote, type: ReviewMomentType, explanation: string): ReviewMomentDraft { return { timestamp: note.start, endTime: note.end, note: note.note, averageCents: note.averageCents, maxDeviation: note.maxDeviation, duration: note.duration, type, driftCents: note.driftCents, stabilityCents: note.stabilityCents, endDropCents: null, explanation } }

function addMomentStats(moment: ReviewMomentDraft, samples: PitchSample[]): ReviewMoment {
  const local = samples.filter((sample) => sample.timestamp >= moment.timestamp - .02 && sample.timestamp <= moment.endTime + .02 && sample.note === moment.note)
  const usable = local.length ? local : samples.filter((sample) => sample.timestamp >= moment.timestamp - .02 && sample.timestamp <= moment.endTime + .02)
  const averageCents = usable.length ? average(usable.map((sample) => sample.cents)) : moment.averageCents
  const maxDeviation = usable.length ? Math.min(50, Math.max(...usable.map((sample) => Math.abs(sample.cents)))) : Math.min(50, moment.maxDeviation)
  const percentAbove30 = usable.length ? usable.filter((sample) => Math.abs(sample.cents) > PITCH_BANDS.good).length / usable.length * 100 : 0
  const enriched = { ...moment, averageCents, maxDeviation, percentAbove30, signals: [moment.type] }
  return { ...enriched, severity: getMomentSeverity(enriched) }
}

function getMomentSeverity(moment: Pick<ReviewMoment, 'averageCents' | 'maxDeviation' | 'percentAbove30' | 'duration' | 'signals'>): ReviewSeverity {
  if (moment.signals.includes('best centered')) return 'minor'
  let points = moment.percentAbove30 >= 60 ? 2 : moment.percentAbove30 >= 25 ? 1 : 0
  points += Math.abs(moment.averageCents) >= 30 ? 2 : Math.abs(moment.averageCents) >= 20 ? 1 : 0
  points += moment.duration >= 1 ? 1 : 0
  points += moment.maxDeviation >= 45 && moment.percentAbove30 >= 25 ? 1 : 0
  return points >= 4 ? 'strong' : points >= 2 ? 'moderate' : 'minor'
}

function mergeReviewMoments(items: ReviewMoment[]) {
  const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp)
  const groups: ReviewMoment[][] = []
  for (const item of sorted) {
    const group = groups.find((candidates) => candidates[0].note === item.note && item.timestamp <= Math.max(...candidates.map((candidate) => candidate.endTime)) + .2 && item.endTime >= Math.min(...candidates.map((candidate) => candidate.timestamp)) - .2)
    if (group) group.push(item)
    else groups.push([item])
  }
  return groups.map((group): ReviewMoment => {
    const durationTotal = sum(group.map((item) => Math.max(.05, item.duration)))
    const signals = [...new Set(group.flatMap((item) => item.signals))]
    const merged = {
      timestamp: Math.min(...group.map((item) => item.timestamp)), endTime: Math.max(...group.map((item) => item.endTime)), note: group[0].note,
      averageCents: sum(group.map((item) => item.averageCents * Math.max(.05, item.duration))) / durationTotal,
      maxDeviation: Math.min(50, Math.max(...group.map((item) => item.maxDeviation))), duration: Math.max(...group.map((item) => item.endTime)) - Math.min(...group.map((item) => item.timestamp)),
      type: signals[0], signals, percentAbove30: Math.max(...group.map((item) => item.percentAbove30)),
      driftCents: maxByMagnitude(group.map((item) => item.driftCents)), stabilityCents: maxNullable(group.map((item) => item.stabilityCents)), endDropCents: maxNullable(group.map((item) => item.endDropCents)),
      explanation: [...new Set(group.map((item) => item.explanation))].join(' '),
    }
    return { ...merged, severity: getMomentSeverity(merged) }
  })
}

function reviewPriority(item: ReviewMoment) { const severity = item.severity === 'strong' ? 60 : item.severity === 'moderate' ? 30 : 0; return severity + item.percentAbove30 / 2 + Math.abs(item.averageCents) + (item.endDropCents ? 12 : 0) - (item.signals.includes('best centered') ? 80 : 0) }
function maxNullable(values: Array<number | null>) { const present = values.filter((value): value is number => value !== null); return present.length ? Math.max(...present) : null }
function maxByMagnitude(values: Array<number | null>) { const present = values.filter((value): value is number => value !== null); return present.length ? present.reduce((largest, value) => Math.abs(value) > Math.abs(largest) ? value : largest) : null }

function buildRange(samples: PitchSample[], notes: SustainedNote[]): TakeRange {
  const reliable = samples.filter((sample) => sample.confidence >= RELIABLE_CLARITY)
  const reliableMidis = reliable.map((sample) => Math.round(sample.midi)).filter((midi) => reliable.filter((sample) => Math.round(sample.midi) === midi).length >= 3).sort((a, b) => a - b)
  const sustainedMidis = notes.map((note) => note.midi).sort((a, b) => a - b)
  const low = reliableMidis[0] ?? Math.round(samples[0].midi); const high = reliableMidis.at(-1) ?? low
  const centralMidis = samples.map((sample) => Math.round(sample.midi)).sort((a, b) => a - b)
  const useSustained = sustainedMidis.length >= 2
  const practicalLow = useSustained ? sustainedMidis[0] : quantile(centralMidis, .15)
  const practicalHigh = useSustained ? sustainedMidis.at(-1)! : quantile(centralMidis, .85)
  return { lowestReliableNote: midiToNoteName(low) ?? '--', highestReliableNote: midiToNoteName(high) ?? '--', lowestSustainedNote: sustainedMidis.length ? midiToNoteName(sustainedMidis[0]) : null, highestSustainedNote: sustainedMidis.length ? midiToNoteName(sustainedMidis.at(-1)!) : null, practicalRange: `${midiToNoteName(practicalLow)}–${midiToNoteName(practicalHigh)}`, practicalRangeSource: useSustained ? 'sustained range' : 'central usable range', spanSemitones: practicalHigh - practicalLow }
}

function buildTessitura(samples: PitchSample[]): Tessitura {
  const midis = samples.map((sample) => Math.round(sample.midi)).sort((a, b) => a - b)
  const low = quantile(midis, .15); const high = quantile(midis, .85); const first = quantile(midis, 1 / 3); const second = quantile(midis, 2 / 3)
  const lowCount = midis.filter((midi) => midi <= first).length; const highCount = midis.filter((midi) => midi > second).length
  const octaves = samples.map((sample) => Math.floor(Math.round(sample.midi) / 12) - 1)
  return { zone: `${midiToNoteName(low)}–${midiToNoteName(high)}`, lowNote: midiToNoteName(low) ?? '--', highNote: midiToNoteName(high) ?? '--', lowPercent: lowCount / midis.length * 100, highPercent: highCount / midis.length * 100, middlePercent: (midis.length - lowCount - highCount) / midis.length * 100, mostUsedOctave: `Octave ${mostCommon(octaves)}` }
}

function buildNoteDistribution(samples: PitchSample[], hop: number) {
  const counts = new Map<number, number>()
  samples.forEach((sample) => counts.set(Math.round(sample.midi), (counts.get(Math.round(sample.midi)) ?? 0) + 1))
  return [...counts.entries()].map(([midi, count]) => ({ note: midiToNoteName(midi) ?? '--', midi, seconds: count * hop, percent: count / samples.length * 100 })).sort((a, b) => b.seconds - a.seconds)
}

function estimateTonalCenter(distribution: NoteDistributionItem[], notes: SustainedNote[], voicedTime: number): TonalCenter {
  if (voicedTime < 3 || distribution.length < 3) return { label: null, confidence: 'Low', commonPitchClasses: [], explanation: 'Not enough reliable tonal information.' }
  const pitchClasses = Array(12).fill(0) as number[]
  distribution.forEach((item) => { pitchClasses[((item.midi % 12) + 12) % 12] += item.seconds })
  notes.forEach((note) => { pitchClasses[((note.midi % 12) + 12) % 12] += note.duration * note.confidence })
  const scores = NOTE_NAMES.map((name, root) => ({ name, root, score: sum(MAJOR_PROFILE.map((weight, index) => weight * pitchClasses[(root + index) % 12])) })).sort((a, b) => b.score - a.score)
  const best = scores[0], gap = best.score ? (best.score - scores[1].score) / best.score : 0
  const minor = NOTE_NAMES[(best.root + 9) % 12]
  const confidence = voicedTime > 12 && gap > .12 ? 'High' : voicedTime > 6 && gap > .06 ? 'Medium' : 'Low'
  const commonPitchClasses = pitchClasses.map((seconds, index) => ({ name: NOTE_NAMES[index], seconds })).sort((a, b) => b.seconds - a.seconds).slice(0, 4).map((item) => item.name)
  return { label: `${best.name} major / ${minor} minor`, confidence, commonPitchClasses, explanation: 'Estimate from duration-weighted sung pitch classes and stable notes only; without accompaniment or a reference melody it may be wrong.' }
}

function compareRange(samples: PitchSample[], saved: VocalRangeResult | null): RangeComparison {
  if (!saved) return { available: false, savedRange: null, withinPercent: null, nearLowerPercent: null, nearUpperPercent: null, lowestRelation: null, highestRelation: null }
  const range: RangeResult = saved.analysis.reliableRange ?? saved.analysis.usableRange ?? { lowestMidi: frequencyToMidi(saved.lowFrequency), highestMidi: frequencyToMidi(saved.highFrequency), lowestNote: saved.lowNote, highestNote: saved.highNote, reliability: 'medium' }
  const lowMidi = range.lowestMidi; const highMidi = range.highestMidi
  const inside = samples.filter((sample) => sample.midi >= lowMidi && sample.midi <= highMidi).length / samples.length * 100
  const minMidi = Math.min(...samples.map((sample) => sample.midi)); const maxMidi = Math.max(...samples.map((sample) => sample.midi))
  return { available: true, savedRange: `${range.lowestNote}–${range.highestNote}`, withinPercent: inside, nearLowerPercent: samples.filter((sample) => sample.midi >= lowMidi && sample.midi <= lowMidi + 2).length / samples.length * 100, nearUpperPercent: samples.filter((sample) => sample.midi <= highMidi && sample.midi >= highMidi - 2).length / samples.length * 100, lowestRelation: relation(minMidi, lowMidi, 'lower'), highestRelation: relation(maxMidi, highMidi, 'upper') }
}

function relation(value: number, limit: number, side: 'lower' | 'upper') { const delta = value - limit; if (Math.abs(delta) < .5) return `at saved ${side} limit`; if (side === 'lower') return delta < 0 ? `${Math.abs(Math.round(delta))} semitones below saved range` : `${Math.round(delta)} semitones above lower limit`; return delta > 0 ? `${Math.round(delta)} semitones above saved range` : `${Math.abs(Math.round(delta))} semitones below upper limit` }
function smoothSamples(samples: PitchSample[]) { return samples.map((sample, index) => { const neighbors = samples.slice(Math.max(0, index - 2), index + 3).filter((candidate) => Math.abs(candidate.timestamp - sample.timestamp) < .18); const cents = median(neighbors.map((candidate) => candidate.cents)); const midi = Math.round(sample.midi) + cents / 100; return { ...sample, cents, midi, frequency: midiToFrequency(midi), note: midiToNoteName(midi) ?? sample.note } }) }
function downmix(buffer: AudioBuffer) { const mono = new Float32Array(buffer.length); for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) { const data = buffer.getChannelData(channel); for (let index = 0; index < data.length; index += 1) mono[index] += data[index] / buffer.numberOfChannels } return mono }
function segmentDuration(items: PitchSample[], hop: number) { return items.at(-1)!.timestamp - items[0].timestamp + hop }
function getRms(frame: Float32Array) { return Math.sqrt(frame.reduce((total, value) => total + value * value, 0) / frame.length) }
function average(values: number[]) { return values.length ? sum(values) / values.length : 0 }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0) }
function standardDeviation(values: number[]) { const mean = average(values); return Math.sqrt(average(values.map((value) => (value - mean) ** 2))) }
function median(values: number[]) { return quantile([...values].sort((a, b) => a - b), .5) }
function quantile(values: number[], q: number) { return values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * q)))] ?? 0 }
function mostCommon<T>(values: T[]): T { return [...new Set(values)].sort((a, b) => values.filter((value) => value === b).length - values.filter((value) => value === a).length)[0] }
function formatSigned(value: number) { return `${value > 0 ? '+' : ''}${Math.round(value)} cents` }
