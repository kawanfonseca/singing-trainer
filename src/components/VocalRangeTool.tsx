import { useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  CheckCircle2,
  ChevronsUpDown,
  Mic,
  RotateCcw,
  Save,
  Square,
  Wand2,
  X,
} from 'lucide-react'
import type { PitchReading } from '../hooks/useMicrophonePitch'
import { formatFrequency, frequencyToNoteName } from '../lib/music'
import {
  VOCAL_RANGE_STEPS,
  addRangeSample,
  buildRangeResult,
  clearVocalRangeResult,
  createVocalRangeDraft,
  createVocalRangeStepDraft,
  getStepSampleCount,
  getTotalSampleCount,
  readVocalRangeResult,
  saveVocalRangeResult,
  type RangeResult,
  type StageAnalysisSummary,
  type VocalRangeAnalysis,
  type VocalRangeDraft,
  type VocalRangeResult,
} from '../lib/vocalRange'

type VocalRangeToolProps = {
  reading: PitchReading
  isListening: boolean
  disabled: boolean
  onStartMicrophone: () => Promise<void>
  onApplyBaseNote: (midi: number) => void
}

export function VocalRangeTool({
  reading,
  isListening,
  disabled,
  onStartMicrophone,
  onApplyBaseNote,
}: VocalRangeToolProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMeasuring, setIsMeasuring] = useState(false)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [stepProgress, setStepProgress] = useState(0)
  const [draft, setDraft] = useState<VocalRangeDraft>(() => createVocalRangeDraft())
  const [savedResult, setSavedResult] = useState<VocalRangeResult | null>(() => readVocalRangeResult())
  const readingRef = useRef(reading)
  const startedAtRef = useRef(0)
  const activeStep = VOCAL_RANGE_STEPS[activeStepIndex]
  const liveResult = buildRangeResult(draft)
  const displayResult = liveResult ?? savedResult
  const currentNote = reading.frequency === null ? '--' : (frequencyToNoteName(reading.frequency) ?? '--')
  const totalSamples = getTotalSampleCount(draft)

  useEffect(() => {
    readingRef.current = reading
  }, [reading])

  useEffect(() => {
    if (!isMeasuring) {
      return
    }

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startedAtRef.current
      const progress = Math.min(1, elapsed / activeStep.durationMs)
      const currentReading = readingRef.current

      setStepProgress(progress)

      if (currentReading.isVoiceDetected && currentReading.frequency !== null) {
        setDraft((currentDraft) =>
          addRangeSample(currentDraft, activeStep.id, {
            frequency: currentReading.frequency ?? 0,
            clarity: currentReading.clarity,
            volume: currentReading.volume,
            capturedAt: performance.now(),
          }),
        )
      }

      if (progress >= 1) {
        setIsMeasuring(false)
      }
    }, 90)

    return () => window.clearInterval(interval)
  }, [activeStep, isMeasuring])

  async function startStep() {
    if (disabled) {
      return
    }

    if (!isListening) {
      await onStartMicrophone()
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      [activeStep.id]: createVocalRangeStepDraft(),
    }))
    startedAtRef.current = performance.now()
    setStepProgress(0)
    setIsMeasuring(true)
  }

  function stopStep() {
    setIsMeasuring(false)
    setStepProgress(1)
    saveIfReady()
  }

  function goToNextStep() {
    saveIfReady()
    setIsMeasuring(false)
    setStepProgress(0)
    setActiveStepIndex((index) => Math.min(index + 1, VOCAL_RANGE_STEPS.length - 1))
  }

  function goToPreviousStep() {
    setIsMeasuring(false)
    setStepProgress(0)
    setActiveStepIndex((index) => Math.max(index - 1, 0))
  }

  function resetRange() {
    clearVocalRangeResult()
    setDraft(createVocalRangeDraft())
    setSavedResult(null)
    setIsMeasuring(false)
    setStepProgress(0)
    setActiveStepIndex(0)
  }

  function saveIfReady() {
    const result = buildRangeResult(draft)

    if (result) {
      setSavedResult(saveVocalRangeResult(result))
    }
  }

  function closeModal() {
    saveIfReady()
    setIsMeasuring(false)
    setIsOpen(false)
  }

  return (
    <section className="panel vocal-range-panel" aria-label="Ferramenta de range vocal">
      <div className="panel-heading">
        <div>
          <span>Ferramenta</span>
          <h2>Perfil vocal</h2>
        </div>
        <ChevronsUpDown size={20} aria-hidden="true" />
      </div>

      <div className="range-live">
        <div>
          <span>Agora</span>
          <strong>{currentNote}</strong>
          <small>{formatFrequency(reading.frequency)}</small>
        </div>
        <div className={isMeasuring ? 'range-capture active' : 'range-capture'}>
          {isMeasuring ? 'Captando' : 'Pronto'}
        </div>
      </div>

      <div className="range-result-grid">
        <RangeStat label="Grave" value={displayResult?.lowNote ?? '--'} />
        <RangeStat label="Agudo" value={displayResult?.highNote ?? '--'} />
        <RangeStat label="Semitons" value={displayResult ? displayResult.semitones.toString() : '--'} />
        <RangeStat label="Oitavas" value={displayResult?.octaveLabel ?? '--'} />
        <RangeStat label="Voz cheia até" value={displayResult?.denseHighNote ?? '--'} />
        <RangeStat label="Voz leve até" value={displayResult?.lightHighNote ?? '--'} />
        <RangeStat label="Centro da fala" value={displayResult?.speechCenterNote ?? '--'} />
        <RangeStat label="Transição" value={displayResult?.breakEstimate?.note ?? '--'} />
      </div>

      {displayResult ? (
        <div className="range-insight">
          <strong>{formatConfidenceCapped(displayResult.typeEstimate.confidence)}%</strong>
          <span>{displayResult.typeEstimate.detail}</span>
        </div>
      ) : null}

      <div className="range-button-grid">
        <button type="button" className="button secondary" disabled={disabled} onClick={() => setIsOpen(true)}>
          <BarChart3 size={18} />
          Diagnóstico
        </button>

        <button type="button" className="button secondary" onClick={resetRange}>
          <RotateCcw size={18} />
          Reset
        </button>

        <button
          type="button"
          className="button primary"
          disabled={!displayResult || disabled}
          onClick={() => displayResult && onApplyBaseNote(displayResult.suggestedBaseMidi)}
        >
          <Wand2 size={18} />
          Aplicar
        </button>
      </div>

      {savedResult ? (
        <div className="range-saved">
          <Save size={15} aria-hidden="true" />
          <span>{formatDate(savedResult.capturedAt)}</span>
        </div>
      ) : null}

      {isOpen ? (
        <div className="range-modal-backdrop" role="presentation">
          <section className="range-modal" role="dialog" aria-modal="true" aria-label="Diagnóstico vocal">
            <div className="range-modal-header">
              <div>
                <span className="eyebrow">Diagnóstico vocal</span>
                <h2>{activeStep.title}</h2>
              </div>
              <button type="button" className="icon-button" onClick={closeModal} aria-label="Fechar">
                <X size={20} />
              </button>
            </div>

            <div className="range-stepper">
              {VOCAL_RANGE_STEPS.map((step, index) => {
                const sampleCount = getStepSampleCount(draft, step.id)
                const className = [
                  'range-step',
                  index === activeStepIndex ? 'active' : '',
                  sampleCount >= 4 ? 'done' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <button
                    key={step.id}
                    type="button"
                    className={className}
                    disabled={isMeasuring}
                    onClick={() => {
                      setActiveStepIndex(index)
                      setStepProgress(0)
                    }}
                  >
                    <span>{index + 1}</span>
                    <strong>{step.title}</strong>
                  </button>
                )
              })}
            </div>

            {activeStepIndex >= 3 ? (
              <div className="diagnosis">
                Existem duas etapas de agudo porque cantar alto com voz cheia e cantar alto com voz leve são coisas diferentes. A primeira mostra até onde a voz mantém mais corpo. A segunda mostra até onde a voz sobe quando fica mais leve ou em falsete.
              </div>
            ) : null}

            <div className="range-prompt-card">
              <span>{activeStep.prompt}</span>
              <strong>{currentNote}</strong>
              <p>{activeStep.detail}</p>
            </div>

            <div className="range-modal-progress" aria-label="Progresso da etapa">
              <span style={{ width: `${Math.round(stepProgress * 100)}%` }} />
            </div>

            <div className="range-result-grid modal-grid">
              <RangeStat label="Amostras da etapa" value={getStepSampleCount(draft, activeStep.id).toString()} />
              <RangeStat label="Amostras totais" value={totalSamples.toString()} />
              <RangeStat label="Centro da fala" value={liveResult?.speechCenterNote ?? savedResult?.speechCenterNote ?? '--'} />
              <RangeStat label="Transição provável" value={liveResult?.breakEstimate?.note ?? savedResult?.breakEstimate?.note ?? '--'} />
              <RangeStat label="Voz cheia" value={liveResult?.denseHighNote ?? savedResult?.denseHighNote ?? '--'} />
              <RangeStat label="Voz leve" value={liveResult?.lightHighNote ?? savedResult?.lightHighNote ?? '--'} />
            </div>

            {liveResult?.breakEstimate ? (
              <div className="range-insight modal-insight">
                <strong>{formatConfidenceCapped(liveResult.breakEstimate.confidence)}%</strong>
                <span>{liveResult.breakEstimate.detail}</span>
              </div>
            ) : null}

            {liveResult?.analysis ?? savedResult?.analysis ? (
              <DetailedAnalysisReport analysis={(liveResult?.analysis ?? savedResult?.analysis)!} />
            ) : null}

            <div className="range-modal-actions">
              <button type="button" className="button secondary" disabled={activeStepIndex === 0 || isMeasuring} onClick={goToPreviousStep}>
                Voltar
              </button>
              <button type="button" className="button secondary" disabled={disabled} onClick={isMeasuring ? stopStep : startStep}>
                {isMeasuring ? <Square size={18} /> : <Mic size={18} />}
                {isMeasuring ? 'Parar etapa' : 'Captar etapa'}
              </button>
              <button
                type="button"
                className="button primary"
                disabled={isMeasuring}
                onClick={activeStepIndex === VOCAL_RANGE_STEPS.length - 1 ? closeModal : goToNextStep}
              >
                {activeStepIndex === VOCAL_RANGE_STEPS.length - 1 ? (
                  <>
                    <CheckCircle2 size={18} />
                    Salvar
                  </>
                ) : (
                  'Próxima'
                )}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

type DetailedAnalysisReportProps = {
  analysis: Partial<VocalRangeAnalysis>
}

function DetailedAnalysisReport({ analysis }: DetailedAnalysisReportProps) {
  const transition = analysis.probableTransitionZones?.[0]
  const visibleNotes = (analysis.noteAnalyses ?? [])
    .slice()
    .sort((a, b) => b.usableScore - a.usableScore)
    .slice(0, 8)

  return (
    <section className="analysis-report" aria-label="Análise detalhada">
      <div className="diagnosis">
        Este relatório não é um diagnóstico médico. Ele usa o microfone para estimar estabilidade, altura, intensidade e possíveis mudanças de coordenação vocal.
      </div>

      <div className="analysis-heading">
        <div>
          <span className="eyebrow">Análise detalhada</span>
          <h3>Relatório acústico</h3>
        </div>
        <small>{analysis.frameCount ?? 0} amostras</small>
      </div>

      <div className="analysis-summary-grid">
        <AnalysisCard label="Todas as notas detectadas" value={formatRangeWithReliability(analysis.absoluteRange ?? null)} />
        <AnalysisCard label="Notas detectadas com confiança" value={formatRangeWithReliability(analysis.reliableRange ?? null)} />
        <AnalysisCard label="Notas sustentadas" value={formatRangeWithReliability(analysis.sustainedRange ?? null)} />
        <AnalysisCard label="Notas cantáveis com estabilidade" value={formatRangeWithReliability(analysis.usableRange ?? null)} />
        <AnalysisCard label="Região mais confortável" value={formatRangeWithReliability(analysis.comfortableTessitura ?? null)} />
      </div>

      <div className="transition-card">
        <div>
          <span>Zona provável de transição</span>
          <strong>{transition ? `${transition.fromNote} - ${transition.toNote}` : 'Não detectada com confiança'}</strong>
        </div>
        {transition ? (
          <div>
            <small>{formatConfidenceCapped(transition.confidence * 100)}% de confiança · {formatConfidenceLabel(transition.confidence * 100)}</small>
            <ul>
              {transition.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p>Faça a sirene e sustente algumas notas no agudo para aumentar a evidência.</p>
        )}
      </div>

      {analysis.registerLikeZones ? (
        <div className="analysis-summary-grid">
          <AnalysisCard label="Faixa provável de voz cheia" value={formatRangeWithReliability(analysis.registerLikeZones.denseLikely)} />
          <AnalysisCard label="Zona provável de transição" value={formatRangeWithReliability(analysis.registerLikeZones.transitionLikely)} />
          <AnalysisCard label="Faixa provável de voz leve" value={formatRangeWithReliability(analysis.registerLikeZones.lightLikely)} />
        </div>
      ) : null}

      <h4 className="analysis-subheading">Por etapa</h4>
      <StageSummaryGrid summaries={analysis.stageSummaries ?? []} />

      {visibleNotes.length > 0 ? (
        <>
          <h4 className="analysis-subheading">Notas detectadas</h4>
          <div className="note-analysis-table">
            <div className="note-table-header">
              <span>Nota</span>
              <span>Classificação</span>
              <span>Estab.</span>
              <span>Ataque</span>
              <span>Usável</span>
            </div>
            {visibleNotes.map((note) => (
              <div key={note.midi} className="note-table-row">
                <strong>{note.noteName}</strong>
                <span>{formatClassification(note.classification)}</span>
                <span>{note.stabilityScore}</span>
                <span>{note.attackScore}</span>
                <span>{note.usableScore}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <h4 className="analysis-subheading">Observações</h4>
      <div className="warning-list">
        {(analysis.warnings ?? ['Resultado salvo em formato antigo; refaça o diagnóstico para ver a análise completa.']).map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
      </div>
    </section>
  )
}

type StageSummaryGridProps = {
  summaries: StageAnalysisSummary[]
}

function StageSummaryGrid({ summaries }: StageSummaryGridProps) {
  if (summaries.length === 0) {
    return (
      <div className="warning-list">
        <p>Resumo por etapa indisponível para este resultado salvo. Refazer o diagnóstico atualiza o relatório.</p>
      </div>
    )
  }

  return (
    <div className="stage-summary-grid" aria-label="Resumo por etapa">
      {summaries.map((summary) => (
        <div key={summary.stage} className="stage-summary-card">
          <div>
            <span>{summary.label}</span>
            <strong>{formatCompactRangeFromNotes(summary.minNote, summary.maxNote)}</strong>
          </div>
          <dl>
            <div>
              <dt>Amostras</dt>
              <dd>
                {summary.voicedFrameCount}/{summary.frameCount}
              </dd>
            </div>
            <div>
              <dt>Nota central</dt>
              <dd>{summary.medianNote ?? '--'}</dd>
            </div>
            <div>
              <dt>Clareza</dt>
              <dd>{formatPercent(summary.averageConfidence)}</dd>
            </div>
            <div>
              <dt>Volume médio</dt>
              <dd>{formatNumber(summary.averageRms)}</dd>
            </div>
            <div>
              <dt>Trechos</dt>
              <dd>{summary.segmentCount}</dd>
            </div>
            <div>
              <dt>Possíveis quebras</dt>
              <dd>{summary.breakEventCount}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  )
}

type AnalysisCardProps = {
  label: string
  value: string
}

function AnalysisCard({ label, value }: AnalysisCardProps) {
  return (
    <div className="analysis-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

type RangeStatProps = {
  label: string
  value: string
}

function RangeStat({ label, value }: RangeStatProps) {
  return (
    <div className="range-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatRangeWithReliability(range: RangeResult | null) {
  if (!range) {
    return 'Dados insuficientes'
  }

  return `${range.lowestNote} - ${range.highestNote} · ${formatReliability(range.reliability)}`
}

function formatCompactRangeFromNotes(lowNote: string | null, highNote: string | null) {
  if (!lowNote || !highNote) {
    return '--'
  }

  if (lowNote === highNote) {
    return lowNote
  }

  return `${lowNote} - ${highNote}`
}

function formatReliability(value: RangeResult['reliability']) {
  switch (value) {
    case 'high':
      return 'alta'
    case 'medium':
      return 'média'
    case 'low':
      return 'baixa'
    case 'insufficient_data':
    case undefined:
      return 'estimativa limitada'
  }
}

function formatPercent(value: number | null) {
  if (value === null) {
    return '--'
  }

  return `${Math.round(value * 100)}%`
}

function formatNumber(value: number | null) {
  if (value === null) {
    return '--'
  }

  return value.toFixed(3)
}

function formatClassification(value: string) {
  switch (value) {
    case 'dense_like_stable': return 'voz cheia estável'
    case 'dense_like_unstable': return 'voz cheia instável'
    case 'transition_unstable': return 'zona de transição'
    case 'light_like_stable': return 'voz leve estável'
    case 'light_like_breathy_or_weak': return 'voz leve fraca/soprada'
    case 'not_enough_data': return 'dados insuficientes'
    case 'unclassified': return 'não classificado'
    default: return value.replaceAll('_', ' ')
  }
}

function formatConfidenceCapped(value: number) {
  return Math.min(Math.round(value), 99)
}

function formatConfidenceLabel(value: number) {
  if (value < 40) return 'baixa'
  if (value < 70) return 'média'
  if (value < 85) return 'alta'
  return 'muito alta'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
