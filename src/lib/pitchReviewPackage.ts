import type { PhraseInsight, PitchAnalysis, ReviewMoment } from './pitchAnalysis'

export type PitchAudioMetadata = {
  sourceType: 'recording' | 'import'
  fileName?: string
  mimeType?: string
  durationSeconds?: number
  sampleRate?: number
  channelCount?: number
}

export type DisplayMetric = { label: string; value: string; detail?: string }

export type PitchReviewPackage = {
  packageType: 'pitch-replay-review-package'
  packageVersion: 1
  generatedAt: string
  app: {
    route: '/pitch'
    reportSchemaVersion: 3
    environment?: string
    userAgent?: string
    viewport?: { width: number; height: number }
  }
  audio: PitchAudioMetadata & {
    analyzedSingingSeconds: number
    downloadableAudioIncluded: false
  }
  uiReview: {
    simpleView: {
      headlineMetrics: DisplayMetric[]
      topReviewMoments: Array<ReviewMoment & { displayTime: string; displaySignals: string }>
      lessonUsefulRange: string
      mainSingingZone: string
      notes: string[]
    }
    teacherView: {
      lessonSummary: DisplayMetric[]
      rangeUsed: PitchAnalysis['rangeUsed']
      tessitura: PitchAnalysis['tessitura']
      tonalCenter: PitchAnalysis['tonalCenter']
      savedRangeComparison: PitchAnalysis['rangeComparison']
      noteDistributionTop: PitchAnalysis['noteDistribution']
      sustainedNotesTop: PitchAnalysis['sustainedNotes']
      phraseSummary: {
        totalPhrases: number
        bestPhrase?: PhraseInsight
        mostReviewWorthyPhrase?: PhraseInsight
        labelCounts: Record<string, number>
      }
      topTeacherConcerns: string[]
      caveats: string[]
    }
  }
  analysis: {
    summary: object
    pitchZones: PitchAnalysis['zones']
    range: PitchAnalysis['rangeUsed']
    tessitura: PitchAnalysis['tessitura']
    noteDistribution: PitchAnalysis['noteDistribution']
    sustainedNotes: PitchAnalysis['sustainedNotes']
    attackInsights: PitchAnalysis['attackInsights']
    endOfPhraseDrops: PitchAnalysis['endOfPhraseDrops']
    phrases: PitchAnalysis['phrases']
    tonalCenterEstimate: PitchAnalysis['tonalCenter']
    savedRangeComparison: PitchAnalysis['rangeComparison']
    reviewMoments: PitchAnalysis['reviewMoments']
    samples: PitchAnalysis['samples']
  }
  reviewerSummaryMarkdown: string
  qaChecklist: {
    hasAudio: boolean
    hasEnoughVoicedTime: boolean
    hasReviewMoments: boolean
    hasSustainedNotes: boolean
    hasPhrases: boolean
    hasTonalEstimate: boolean
    hasSavedRangeComparison: boolean
    warnings: string[]
  }
}

const CAVEATS = [
  'This analysis does not compare the take against the original melody.',
  'The tonal-center estimate may be wrong without accompaniment or a reference melody.',
  'Acoustic pitch heuristics are not diagnoses of vocal technique, voice type, support, strain, or vocal health.',
  'Microphone quality, room noise, reverb, consonants, breath, slides, and vibrato can affect results.',
]

export function buildSimpleViewMetrics(analysis: PitchAnalysis): DisplayMetric[] {
  return [
    { label: 'Acceptable centering', value: `${analysis.score}%`, detail: 'within 30 cents' },
    { label: 'Average deviation', value: `${Math.round(analysis.averageDeviation)}¢`, detail: 'from nearest note' },
    { label: 'Bias', value: analysis.bias.replace('tends to sing ', ''), detail: `${formatSigned(analysis.signedAverageDeviation)} average` },
    { label: 'Analyzed singing', value: formatDuration(analysis.analyzedTime), detail: 'silence excluded' },
    { label: 'Sustained / useful range', value: analysis.rangeUsed.practicalRange, detail: analysis.rangeUsed.practicalRangeSource },
    { label: 'Main singing zone', value: analysis.tessitura.zone, detail: 'central 70% of voiced time' },
  ]
}

export function getTeacherHighlights(analysis: PitchAnalysis) {
  const bestPhrase = [...analysis.phrases].sort((a, b) => b.centeringPercent - a.centeringPercent)[0]
  const mostReviewWorthyPhrase = [...analysis.phrases].sort((a, b) => a.centeringPercent - b.centeringPercent)[0]
  const highestSustainedNote = [...analysis.sustainedNotes].sort((a, b) => b.midi - a.midi)[0]
  const recurringSignal = getMostCommonSignal(analysis.reviewMoments)
  return { bestPhrase, mostReviewWorthyPhrase, highestSustainedNote, recurringSignal }
}

export function buildTeacherLessonSummary(analysis: PitchAnalysis): DisplayMetric[] {
  const { bestPhrase, mostReviewWorthyPhrase, highestSustainedNote, recurringSignal } = getTeacherHighlights(analysis)
  return [
    { label: 'Best phrase', value: bestPhrase ? `Phrase ${bestPhrase.index}` : '--', detail: bestPhrase ? `${Math.round(bestPhrase.centeringPercent)}% within 30 cents` : 'Not enough phrase data' },
    { label: 'Most review-worthy', value: mostReviewWorthyPhrase ? `Phrase ${mostReviewWorthyPhrase.index}` : '--', detail: mostReviewWorthyPhrase?.classification ?? 'Not enough phrase data' },
    { label: 'Highest sustained', value: highestSustainedNote?.note ?? '--', detail: highestSustainedNote ? `${highestSustainedNote.duration.toFixed(1)}s` : 'No sustained note' },
    { label: 'Main singing zone', value: analysis.tessitura.zone, detail: 'central 70%' },
    { label: 'Recurring signal', value: recurringSignal, detail: 'across review moments' },
  ]
}

export function buildPitchReviewPackage(
  analysis: PitchAnalysis,
  audio: PitchAudioMetadata,
  app: { environment?: string; userAgent?: string; viewport?: { width: number; height: number } } = {},
): PitchReviewPackage {
  const simpleMetrics = buildSimpleViewMetrics(analysis)
  const lessonSummary = buildTeacherLessonSummary(analysis)
  const highlights = getTeacherHighlights(analysis)
  const topMoments = analysis.reviewMoments.slice(0, 3).map((moment) => ({ ...moment, displayTime: formatReviewMomentTime(moment), displaySignals: formatReviewSignals(moment.signals) }))
  const labelCounts = analysis.phrases.reduce<Record<string, number>>((counts, phrase) => ({ ...counts, [phrase.classification]: (counts[phrase.classification] ?? 0) + 1 }), {})
  const topTeacherConcerns = buildTeacherConcerns(analysis)
  const warnings = buildWarnings(analysis, audio)
  const summary = { score: analysis.score, averageDeviation: analysis.averageDeviation, signedAverageDeviation: analysis.signedAverageDeviation, bias: analysis.bias, analyzedTime: analysis.analyzedTime, duration: analysis.duration }
  const generatedAt = new Date().toISOString()
  const reviewPackage: PitchReviewPackage = {
    packageType: 'pitch-replay-review-package', packageVersion: 1, generatedAt,
    app: { route: '/pitch', reportSchemaVersion: 3, ...app },
    audio: { ...audio, analyzedSingingSeconds: analysis.analyzedTime, downloadableAudioIncluded: false },
    uiReview: {
      simpleView: { headlineMetrics: simpleMetrics, topReviewMoments: topMoments, lessonUsefulRange: analysis.rangeUsed.practicalRange, mainSingingZone: analysis.tessitura.zone, notes: ['Audio is intentionally not embedded; use the separate audio download when needed.'] },
      teacherView: {
        lessonSummary, rangeUsed: analysis.rangeUsed, tessitura: analysis.tessitura, tonalCenter: analysis.tonalCenter,
        savedRangeComparison: analysis.rangeComparison, noteDistributionTop: analysis.noteDistribution.slice(0, 10),
        sustainedNotesTop: [...analysis.sustainedNotes].sort((a, b) => b.duration - a.duration).slice(0, 12),
        phraseSummary: { totalPhrases: analysis.phrases.length, bestPhrase: highlights.bestPhrase, mostReviewWorthyPhrase: highlights.mostReviewWorthyPhrase, labelCounts },
        topTeacherConcerns, caveats: CAVEATS,
      },
    },
    analysis: {
      summary, pitchZones: analysis.zones, range: analysis.rangeUsed, tessitura: analysis.tessitura,
      noteDistribution: analysis.noteDistribution, sustainedNotes: analysis.sustainedNotes, attackInsights: analysis.attackInsights,
      endOfPhraseDrops: analysis.endOfPhraseDrops, phrases: analysis.phrases, tonalCenterEstimate: analysis.tonalCenter,
      savedRangeComparison: analysis.rangeComparison, reviewMoments: analysis.reviewMoments, samples: analysis.samples,
    },
    reviewerSummaryMarkdown: '',
    qaChecklist: {
      hasAudio: Boolean(audio.fileName || audio.mimeType || audio.durationSeconds), hasEnoughVoicedTime: analysis.analyzedTime >= 3,
      hasReviewMoments: analysis.reviewMoments.length > 0, hasSustainedNotes: analysis.sustainedNotes.length > 0,
      hasPhrases: analysis.phrases.length > 0, hasTonalEstimate: Boolean(analysis.tonalCenter.label),
      hasSavedRangeComparison: analysis.rangeComparison.available, warnings,
    },
  }
  reviewPackage.reviewerSummaryMarkdown = buildReviewerMarkdown(reviewPackage)
  return reviewPackage
}

export function getReviewPackageFilename(now = new Date()) {
  const part = (value: number) => String(value).padStart(2, '0')
  return `pitch-replay-review-package-${now.getFullYear()}-${part(now.getMonth() + 1)}-${part(now.getDate())}-${part(now.getHours())}-${part(now.getMinutes())}.json`
}

export function formatReviewMomentTime(moment: Pick<ReviewMoment, 'timestamp' | 'endTime' | 'duration'>) {
  if (moment.duration < 1) return `Around ${formatDuration((moment.timestamp + moment.endTime) / 2)} · ${moment.duration.toFixed(1)}s`
  if (Math.floor(moment.timestamp) === Math.floor(moment.endTime)) return `${formatPreciseTime(moment.timestamp)}–${formatPreciseTime(moment.endTime)}`
  return `${formatDuration(moment.timestamp)}–${formatDuration(moment.endTime)} · ${moment.duration.toFixed(1)}s`
}

export function formatReviewSignals(signals: ReviewMoment['signals']) {
  const labels = signals.filter((signal) => signal !== 'pitch-centering').map((signal) => signal.replace(' area', ''))
  return (labels.length ? labels : signals).join(' + ')
}

function buildReviewerMarkdown(reviewPackage: PitchReviewPackage) {
  const metrics = Object.fromEntries(reviewPackage.uiReview.simpleView.headlineMetrics.map((metric) => [metric.label, metric.value]))
  const highlights = reviewPackage.uiReview.teacherView.lessonSummary
  const highlight = (label: string) => highlights.find((item) => item.label === label)?.value ?? '--'
  const moments = reviewPackage.uiReview.simpleView.topReviewMoments.map((moment) => {
    const movement = [moment.driftCents !== null ? `drift ${formatSigned(moment.driftCents)}` : null, moment.endDropCents !== null ? `end drop ${Math.round(moment.endDropCents)}¢` : null].filter(Boolean).join('; ')
    return `- ${moment.displayTime} · ${moment.note} · ${moment.severity} · ${moment.displaySignals}\n  - Avg deviation: ${formatSigned(moment.averageCents)}; max deviation: ${Math.round(moment.maxDeviation)}¢${movement ? `; ${movement}` : ''}\n  - ${moment.explanation}`
  }).join('\n') || '- No review moments detected.'
  const tonal = reviewPackage.uiReview.teacherView.tonalCenter
  const range = reviewPackage.uiReview.teacherView.savedRangeComparison
  return `# Pitch Replay Review Package

## Quick Summary

- Acceptable centering: ${metrics['Acceptable centering'] ?? '--'}
- Average deviation: ${metrics['Average deviation'] ?? '--'}
- Bias: ${metrics.Bias ?? '--'}
- Analyzed singing: ${metrics['Analyzed singing'] ?? '--'}
- Lesson-useful range: ${reviewPackage.uiReview.simpleView.lessonUsefulRange}
- Main singing zone: ${reviewPackage.uiReview.simpleView.mainSingingZone}

## Top Review Moments

${moments}

## Teacher View Highlights

- Best phrase: ${highlight('Best phrase')}
- Most review-worthy phrase: ${highlight('Most review-worthy')}
- Highest sustained note: ${highlight('Highest sustained')}
- Recurring issue: ${highlight('Recurring signal')}
- Tonal estimate: ${tonal.confidence === 'Low' ? `not reliable enough; possible candidate ${tonal.label ?? '--'}` : tonal.label ?? '--'} (${tonal.confidence})
- Range comparison: ${range.available ? `${Math.round(range.withinPercent ?? 0)}% within saved range ${range.savedRange}` : 'No saved vocal-range comparison'}

## Caveats

${CAVEATS.map((caveat) => `- ${caveat}`).join('\n')}`
}

function buildTeacherConcerns(analysis: PitchAnalysis) {
  const concerns = analysis.reviewMoments.filter((moment) => moment.severity !== 'minor' && !moment.signals.includes('best centered')).map((moment) => `${moment.note} at ${formatReviewMomentTime(moment)}: ${formatReviewSignals(moment.signals)} (${moment.severity})`)
  if (analysis.endOfPhraseDrops.length) concerns.push(`${analysis.endOfPhraseDrops.length} phrase-ending pitch drop signal(s) detected.`)
  return [...new Set(concerns)].slice(0, 6)
}

function buildWarnings(analysis: PitchAnalysis, audio: PitchAudioMetadata) {
  const warnings: string[] = []
  if (!audio.fileName && !audio.mimeType) warnings.push('Audio metadata is incomplete.')
  if (analysis.analyzedTime < 3) warnings.push('Less than three seconds of voiced singing were analyzed.')
  if (!analysis.reviewMoments.length) warnings.push('No review moments were detected.')
  if (!analysis.sustainedNotes.length) warnings.push('No reliable sustained notes were detected.')
  if (analysis.tonalCenter.confidence === 'Low') warnings.push('The tonal-center estimate has low confidence.')
  if (!analysis.rangeComparison.available) warnings.push('No saved vocal-range comparison was available.')
  return warnings
}

function getMostCommonSignal(moments: ReviewMoment[]) {
  const signals = moments.flatMap((moment) => moment.signals).filter((signal) => signal !== 'best centered' && signal !== 'pitch-centering')
  if (!signals.length) return 'No recurring issue'
  return [...new Set(signals)].sort((a, b) => signals.filter((signal) => signal === b).length - signals.filter((signal) => signal === a).length)[0].replace(' area', '')
}

function formatSigned(value: number) { const rounded = Math.round(value); return `${rounded > 0 ? '+' : ''}${rounded}¢` }
function formatDuration(seconds: number) { const whole = Math.max(0, Math.floor(seconds)); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}` }
function formatPreciseTime(seconds: number) { const safe = Math.max(0, seconds); return `${Math.floor(safe / 60)}:${(safe % 60).toFixed(1).padStart(4, '0')}` }
