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
        <RangeStat label="Tipo" value={displayResult?.typeEstimate.label ?? '--'} />
        <RangeStat label="Confiável" value={formatCompactRange(displayResult?.analysis?.reliableRange ?? null)} />
        <RangeStat label="Denso até" value={displayResult?.denseHighNote ?? '--'} />
        <RangeStat label="Quebra" value={displayResult?.breakEstimate?.note ?? '--'} />
      </div>

      {displayResult ? (
        <div className="range-insight">
          <strong>{displayResult.typeEstimate.confidence}%</strong>
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
              <RangeStat label="Centro fala" value={liveResult?.speechCenterNote ?? savedResult?.speechCenterNote ?? '--'} />
              <RangeStat label="Quebra provável" value={liveResult?.breakEstimate?.note ?? savedResult?.breakEstimate?.note ?? '--'} />
              <RangeStat label="Denso" value={liveResult?.denseHighNote ?? savedResult?.denseHighNote ?? '--'} />
              <RangeStat label="Leve" value={liveResult?.lightHighNote ?? savedResult?.lightHighNote ?? '--'} />
            </div>

            {liveResult?.breakEstimate ? (
              <div className="range-insight modal-insight">
                <strong>{liveResult.breakEstimate.confidence}%</strong>
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
      <div className="analysis-heading">
        <div>
          <span className="eyebrow">Detailed Analysis</span>
          <h3>Relatório acústico</h3>
        </div>
        <small>{analysis.frameCount ?? 0} frames</small>
      </div>

      <div className="analysis-summary-grid">
        <AnalysisCard label="Range absoluto" value={formatRangeWithReliability(analysis.absoluteRange ?? null)} />
        <AnalysisCard label="Range confiável" value={formatRangeWithReliability(analysis.reliableRange ?? null)} />
        <AnalysisCard label="Range sustentado" value={formatRangeWithReliability(analysis.sustainedRange ?? null)} />
        <AnalysisCard label="Range usável" value={formatRangeWithReliability(analysis.usableRange ?? null)} />
        <AnalysisCard label="Zona confortável" value={formatRangeWithReliability(analysis.comfortableTessitura ?? null)} />
      </div>

      <div className="transition-card">
        <div>
          <span>Zona provável de transição</span>
          <strong>{transition ? `${transition.fromNote} - ${transition.toNote}` : 'Não detectado com confiança'}</strong>
        </div>
        {transition ? (
          <div>
            <small>{Math.round(transition.confidence * 100)}% confiança</small>
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
          <AnalysisCard label="Denso provável" value={formatRangeWithReliability(analysis.registerLikeZones.denseLikely)} />
          <AnalysisCard label="Transição provável" value={formatRangeWithReliability(analysis.registerLikeZones.transitionLikely)} />
          <AnalysisCard label="Leve provável" value={formatRangeWithReliability(analysis.registerLikeZones.lightLikely)} />
        </div>
      ) : null}

      <StageSummaryGrid summaries={analysis.stageSummaries ?? []} />

      {visibleNotes.length > 0 ? (
        <div className="note-analysis-table">
          <div className="note-table-header">
            <span>Nota</span>
            <span>Classe</span>
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
      ) : null}

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
              <dt>Frames</dt>
              <dd>
                {summary.voicedFrameCount}/{summary.frameCount}
              </dd>
            </div>
            <div>
              <dt>Mediana</dt>
              <dd>{summary.medianNote ?? '--'}</dd>
            </div>
            <div>
              <dt>Conf.</dt>
              <dd>{formatPercent(summary.averageConfidence)}</dd>
            </div>
            <div>
              <dt>RMS</dt>
              <dd>{formatNumber(summary.averageRms)}</dd>
            </div>
            <div>
              <dt>Segmentos</dt>
              <dd>{summary.segmentCount}</dd>
            </div>
            <div>
              <dt>Quebras</dt>
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

function formatCompactRange(range: RangeResult | null) {
  if (!range) {
    return '--'
  }

  return `${range.lowestNote} - ${range.highestNote}`
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
  return value
    .replaceAll('_', ' ')
    .replace('dense like', 'denso')
    .replace('light like', 'leve')
    .replace('transition unstable', 'transição')
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
