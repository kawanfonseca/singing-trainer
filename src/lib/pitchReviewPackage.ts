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
      topReviewMoments: Array<ReviewMoment & { displayTime: string; displaySignals: string; displaySeverity: string }>
      lessonUsefulRange: string
      mainSingingZone: string
      notes: string[]
    }
    teacherView: {
      lessonSummary: DisplayMetric[]
      rangeUsed: PitchAnalysis['rangeUsed']
      tessitura: PitchAnalysis['tessitura']
      tonalCenter: PitchAnalysis['tonalCenter'] & { displayLabel: string | null; confidenceLabel: string }
      savedRangeComparison: PitchAnalysis['rangeComparison']
      noteDistributionTop: PitchAnalysis['noteDistribution']
      sustainedNotesTop: Array<PitchAnalysis['sustainedNotes'][number] & { displayClassification: string; displayAttack: string }>
      phraseSummary: {
        totalPhrases: number
        bestPhrase?: PhraseInsight
        mostReviewWorthyPhrase?: PhraseInsight
        labelCounts: Record<string, number>
        displayLabelCounts: Record<string, number>
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
  'Esta análise não compara a gravação com a melodia original.',
  'Uma nota centralizada ainda pode ser a nota melódica errada.',
  'A estimativa de centro tonal pode estar errada sem acompanhamento ou melodia de referência.',
  'Sinais acústicos de altura não são diagnósticos de técnica vocal, tipo de voz, apoio, tensão ou saúde vocal.',
  'Qualidade do microfone, ruído, reverberação, consoantes, respiração, portamentos e vibrato podem afetar os resultados.',
]

export function buildSimpleViewMetrics(analysis: PitchAnalysis): DisplayMetric[] {
  return [
    { label: 'Centralização aceitável', value: `${analysis.score}%`, detail: 'dentro de 30 cents' },
    { label: 'Desvio médio', value: `${Math.round(analysis.averageDeviation)}¢`, detail: 'da nota mais próxima' },
    { label: 'Tendência', value: translateBias(analysis.bias), detail: `média de ${formatSigned(analysis.signedAverageDeviation)}` },
    { label: 'Canto analisado', value: formatDuration(analysis.analyzedTime), detail: 'silêncio excluído' },
    { label: 'Extensão sustentada / útil', value: analysis.rangeUsed.practicalRange, detail: translatePracticalSource(analysis.rangeUsed.practicalRangeSource) },
    { label: 'Região principal do canto', value: analysis.tessitura.zone, detail: '70% central do tempo com voz' },
  ]
}

export function getTeacherHighlights(analysis: PitchAnalysis) {
  const bestPhrase = [...analysis.phrases].sort((a, b) => b.centeringPercent - a.centeringPercent)[0]
  const mostReviewWorthyPhrase = [...analysis.phrases].sort((a, b) => a.centeringPercent - b.centeringPercent)[0]
  const highestSustainedNote = [...analysis.sustainedNotes].sort((a, b) => b.midi - a.midi)[0]
  const recurringSignal = getMostCommonSignal(analysis.reviewMoments)
  return { bestPhrase, mostReviewWorthyPhrase, highestSustainedNote, recurringSignal }
}

export function getLessonReviewMoments(analysis: PitchAnalysis, limit = 3) {
  return [...analysis.reviewMoments]
    .sort((a, b) => b.lessonPriority - a.lessonPriority || b.duration - a.duration || b.maxDeviation - a.maxDeviation)
    .slice(0, limit)
}

export function buildTeacherLessonSummary(analysis: PitchAnalysis): DisplayMetric[] {
  const { bestPhrase, mostReviewWorthyPhrase, highestSustainedNote, recurringSignal } = getTeacherHighlights(analysis)
  return [
    { label: 'Melhor frase', value: bestPhrase ? `Frase ${bestPhrase.index}` : '--', detail: bestPhrase ? `${Math.round(bestPhrase.centeringPercent)}% dentro de 30 cents` : 'Sem dados de frase suficientes' },
    { label: 'Frase que mais pede revisão', value: mostReviewWorthyPhrase ? `Frase ${mostReviewWorthyPhrase.index}` : '--', detail: mostReviewWorthyPhrase ? translatePhraseClassification(mostReviewWorthyPhrase.classification) : 'Sem dados de frase suficientes' },
    { label: 'Nota sustentada mais alta', value: highestSustainedNote?.note ?? '--', detail: highestSustainedNote ? `${formatDecimal(highestSustainedNote.duration)}s` : 'Nenhuma nota sustentada' },
    { label: 'Região principal do canto', value: analysis.tessitura.zone, detail: '70% central' },
    { label: 'Sinal recorrente', value: recurringSignal, detail: 'nos momentos de revisão' },
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
  const topMoments = getLessonReviewMoments(analysis).map((moment) => ({ ...moment, displayTime: formatReviewMomentTime(moment), displaySignals: formatReviewSignals(moment.signals), displaySeverity: translateReviewSeverity(moment.severity) }))
  const labelCounts = analysis.phrases.reduce<Record<string, number>>((counts, phrase) => ({ ...counts, [phrase.classification]: (counts[phrase.classification] ?? 0) + 1 }), {})
  const displayLabelCounts = Object.fromEntries(Object.entries(labelCounts).map(([label, count]) => [translatePhraseClassification(label as PhraseInsight['classification']), count]))
  const topTeacherConcerns = buildTeacherConcerns(analysis)
  const warnings = buildWarnings(analysis, audio)
  const summary = { score: analysis.score, averageDeviation: analysis.averageDeviation, signedAverageDeviation: analysis.signedAverageDeviation, bias: analysis.bias, analyzedTime: analysis.analyzedTime, duration: analysis.duration }
  const generatedAt = new Date().toISOString()
  const reviewPackage: PitchReviewPackage = {
    packageType: 'pitch-replay-review-package', packageVersion: 1, generatedAt,
    app: { route: '/pitch', reportSchemaVersion: 3, ...app },
    audio: { ...audio, analyzedSingingSeconds: analysis.analyzedTime, downloadableAudioIncluded: false },
    uiReview: {
      simpleView: { headlineMetrics: simpleMetrics, topReviewMoments: topMoments, lessonUsefulRange: analysis.rangeUsed.practicalRange, mainSingingZone: analysis.tessitura.zone, notes: ['O áudio não é incorporado de propósito; use o download de áudio separado quando necessário.'] },
      teacherView: {
        lessonSummary, rangeUsed: analysis.rangeUsed, tessitura: analysis.tessitura, tonalCenter: { ...analysis.tonalCenter, displayLabel: formatTonalLabel(analysis.tonalCenter.label), confidenceLabel: translateConfidence(analysis.tonalCenter.confidence) },
        savedRangeComparison: analysis.rangeComparison, noteDistributionTop: analysis.noteDistribution.slice(0, 10),
        sustainedNotesTop: [...analysis.sustainedNotes].sort((a, b) => b.duration - a.duration).slice(0, 12).map((note) => ({ ...note, displayClassification: translateSustainedClassification(note.classification), displayAttack: translateAttackClassification(note.attack) })),
        phraseSummary: { totalPhrases: analysis.phrases.length, bestPhrase: highlights.bestPhrase, mostReviewWorthyPhrase: highlights.mostReviewWorthyPhrase, labelCounts, displayLabelCounts },
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
  if (moment.duration < 1) return `Por volta de ${formatDuration((moment.timestamp + moment.endTime) / 2)} · ${formatDecimal(moment.duration)}s`
  if (Math.floor(moment.timestamp) === Math.floor(moment.endTime)) return `${formatPreciseTime(moment.timestamp)}–${formatPreciseTime(moment.endTime)}`
  return `${formatDuration(moment.timestamp)}–${formatDuration(moment.endTime)} · ${formatDecimal(moment.duration)}s`
}

export function formatReviewSignals(signals: ReviewMoment['signals']) {
  const labels = signals.filter((signal) => signal !== 'pitch-centering').map(translateReviewSignal)
  return (labels.length ? labels : signals.map(translateReviewSignal)).join(' + ')
}

export function translateReviewSeverity(severity: ReviewMoment['severity']) { return severity === 'strong' ? 'forte' : severity === 'moderate' ? 'moderado' : 'menor' }
export function translatePhraseClassification(value: PhraseInsight['classification']) { return ({ 'strong/reference phrase': 'frase forte / referência', 'mostly stable': 'majoritariamente estável', 'review lightly': 'revisar levemente', 'needs review': 'precisa de revisão' } as const)[value] }
export function translateSustainedClassification(value: PitchAnalysis['sustainedNotes'][number]['classification']) { return ({ stable: 'estável', 'slightly drifting': 'com leve deriva', 'falling at the end': 'caindo no final', 'rising at the end': 'subindo no final', unstable: 'instável' } as const)[value] }
export function translateAttackClassification(value: PitchAnalysis['sustainedNotes'][number]['attack']) { return ({ 'entered centered': 'entrada centralizada', 'entered flat and corrected': 'entrou baixa e corrigiu', 'entered sharp and corrected': 'entrou alta e corrigiu', 'slid into the note': 'deslizou até a nota', 'unstable attack': 'ataque instável', unclear: 'inconclusivo' } as const)[value] }
export function translateBias(value: PitchAnalysis['bias'] | PhraseInsight['bias']) { if (value === 'mostly balanced' || value === 'balanced') return 'equilibrada'; if (value === 'tends to sing flat' || value === 'flat') return 'tende para baixo'; return 'tende para cima' }
export function translateConfidence(value: PitchAnalysis['tonalCenter']['confidence']) { return value === 'High' ? 'alta' : value === 'Medium' ? 'média' : 'baixa' }
export function translatePracticalSource(value: PitchAnalysis['rangeUsed']['practicalRangeSource']) { return value === 'sustained range' ? 'extensão sustentada' : 'região central utilizável' }
export function formatTonalLabel(label: string | null) { return label?.replace(' major', ' maior').replace(' minor', ' menor') ?? null }

function translateReviewSignal(signal: ReviewMoment['signals'][number]) {
  return ({ 'phrase issue': 'frase para revisar', 'pitch-centering': 'centralização', unstable: 'instável', 'end-of-phrase drop': 'queda no fim da frase', 'flat sustained area': 'sustentada baixa', 'sharp sustained area': 'sustentada alta', 'best centered': 'melhor trecho centralizado' } as const)[signal]
}

function buildReviewerMarkdown(reviewPackage: PitchReviewPackage) {
  const metrics = Object.fromEntries(reviewPackage.uiReview.simpleView.headlineMetrics.map((metric) => [metric.label, metric.value]))
  const highlights = reviewPackage.uiReview.teacherView.lessonSummary
  const highlight = (label: string) => highlights.find((item) => item.label === label)?.value ?? '--'
  const moments = reviewPackage.uiReview.simpleView.topReviewMoments.map((moment) => {
    const movement = [moment.driftCents !== null ? `deriva ${formatSigned(moment.driftCents)}` : null, moment.endDropCents !== null ? `queda final ${Math.round(moment.endDropCents)}¢` : null].filter(Boolean).join('; ')
    return `- ${moment.displayTime} · ${moment.note} · ${translateReviewSeverity(moment.severity)} · ${moment.displaySignals}\n  - Desvio médio: ${formatSigned(moment.averageCents)}; desvio máximo: ${Math.round(moment.maxDeviation)}¢${movement ? `; ${movement}` : ''}\n  - ${moment.explanation}`
  }).join('\n') || '- Nenhum momento de revisão foi detectado.'
  const tonal = reviewPackage.uiReview.teacherView.tonalCenter
  const range = reviewPackage.uiReview.teacherView.savedRangeComparison
  return `# Pacote de revisão do Pitch Replay

## Resumo rápido

- Centralização aceitável: ${metrics['Centralização aceitável'] ?? '--'}
- Desvio médio: ${metrics['Desvio médio'] ?? '--'}
- Tendência: ${metrics['Tendência'] ?? '--'}
- Canto analisado: ${metrics['Canto analisado'] ?? '--'}
- Extensão útil para a aula: ${reviewPackage.uiReview.simpleView.lessonUsefulRange}
- Região principal do canto: ${reviewPackage.uiReview.simpleView.mainSingingZone}

## Principais momentos para revisar

${moments}

## Destaques da visão do professor

- Melhor frase: ${highlight('Melhor frase')}
- Frase que mais pede revisão: ${highlight('Frase que mais pede revisão')}
- Nota sustentada mais alta: ${highlight('Nota sustentada mais alta')}
- Sinal recorrente: ${highlight('Sinal recorrente')}
- Estimativa tonal: ${tonal.confidence === 'Low' ? `não confiável o suficiente; possível candidato ${tonal.displayLabel ?? '--'}` : tonal.displayLabel ?? '--'} (confiança ${tonal.confidenceLabel})
- Comparação de extensão: ${range.available ? `${Math.round(range.withinPercent ?? 0)}% dentro da extensão salva ${range.savedRange}` : 'Sem comparação com extensão vocal salva'}

## Ressalvas

${CAVEATS.map((caveat) => `- ${caveat}`).join('\n')}`
}

function buildTeacherConcerns(analysis: PitchAnalysis) {
  const concerns = analysis.reviewMoments.filter((moment) => moment.severity !== 'minor' && !moment.signals.includes('best centered')).map((moment) => `${moment.note} em ${formatReviewMomentTime(moment)}: ${formatReviewSignals(moment.signals)} (${translateReviewSeverity(moment.severity)})`)
  if (analysis.endOfPhraseDrops.length) concerns.push(`${analysis.endOfPhraseDrops.length} sinal(is) de queda de altura no fim de frase.`)
  return [...new Set(concerns)].slice(0, 6)
}

function buildWarnings(analysis: PitchAnalysis, audio: PitchAudioMetadata) {
  const warnings: string[] = []
  if (!audio.fileName && !audio.mimeType) warnings.push('Os metadados do áudio estão incompletos.')
  if (analysis.analyzedTime < 3) warnings.push('Foram analisados menos de três segundos de canto com voz.')
  if (!analysis.reviewMoments.length) warnings.push('Nenhum momento de revisão foi detectado.')
  if (!analysis.sustainedNotes.length) warnings.push('Nenhuma nota sustentada confiável foi detectada.')
  if (analysis.tonalCenter.confidence === 'Low') warnings.push('A estimativa de centro tonal tem baixa confiança.')
  if (!analysis.rangeComparison.available) warnings.push('Não havia comparação com uma extensão vocal salva.')
  return warnings
}

function getMostCommonSignal(moments: ReviewMoment[]) {
  const signals = moments.flatMap((moment) => moment.signals).filter((signal) => signal !== 'best centered' && signal !== 'pitch-centering')
  if (!signals.length) return 'Nenhum sinal recorrente'
  return translateReviewSignal([...new Set(signals)].sort((a, b) => signals.filter((signal) => signal === b).length - signals.filter((signal) => signal === a).length)[0])
}

function formatSigned(value: number) { const rounded = Math.round(value); return `${rounded > 0 ? '+' : ''}${rounded}¢` }
function formatDuration(seconds: number) { const whole = Math.max(0, Math.floor(seconds)); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}` }
function formatPreciseTime(seconds: number) { const safe = Math.max(0, seconds); return `${Math.floor(safe / 60)}:${(safe % 60).toFixed(1).padStart(4, '0').replace('.', ',')}` }
function formatDecimal(value: number) { return value.toFixed(1).replace('.', ',') }
