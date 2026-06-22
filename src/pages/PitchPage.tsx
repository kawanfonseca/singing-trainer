import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Download, Mic, Square, Upload } from 'lucide-react'
import { decodeAndAnalyzeAudio, type PitchAnalysis, type ReviewMoment } from '../lib/pitchAnalysis'
import {
  buildPitchReviewPackage,
  buildSimpleViewMetrics,
  buildTeacherLessonSummary,
  formatReviewMomentTime,
  formatReviewSignals,
  formatTonalLabel,
  getLessonReviewMoments,
  getReviewPackageFilename,
  translateAttackClassification,
  translateBias,
  translateConfidence,
  translatePhraseClassification,
  translateReviewSeverity,
  translateSustainedClassification,
  type PitchAudioMetadata,
} from '../lib/pitchReviewPackage'
import { readVocalRangeResult } from '../lib/vocalRange'

type PageState = 'idle' | 'recording' | 'processing' | 'results' | 'error'

export function PitchPage() {
  const [state, setState] = useState<PageState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioName, setAudioName] = useState('pitch-replay.webm')
  const [analysis, setAnalysis] = useState<PitchAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [audioMetadata, setAudioMetadata] = useState<PitchAudioMetadata | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const discardRecordingRef = useRef(false)
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => cleanup(), [])

  function cleanup() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      fail('Este navegador não oferece suporte à gravação pelo microfone. Tente importar um arquivo de áudio.')
      return
    }
    try {
      setError(null)
      setAnalysis(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      const preferred = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false
          return
        }
        void processAudio(blob, extensionFor(recorder.mimeType), 'recording')
      }
      recorderRef.current = recorder
      streamRef.current = stream
      startedAtRef.current = performance.now()
      setElapsed(0)
      discardRecordingRef.current = false
      setState('recording')
      recorder.start(250)
      timerRef.current = window.setInterval(() => setElapsed((performance.now() - startedAtRef.current) / 1000), 100)
    } catch (caught) {
      const denied = caught instanceof DOMException && (caught.name === 'NotAllowedError' || caught.name === 'PermissionDeniedError')
      fail(denied ? 'A permissão do microfone foi negada. Autorize o acesso ou importe um arquivo de áudio.' : 'Não foi possível iniciar o microfone. Verifique se outro aplicativo está usando o dispositivo.')
    }
  }

  function stopRecording() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    if (elapsed < 1) {
      discardRecordingRef.current = true
      recorderRef.current?.stop()
      fail('A gravação ficou muito curta. Para um resultado útil, grave pelo menos alguns segundos de canto.')
      return
    }
    recorderRef.current?.stop()
    setState('processing')
  }

  async function importAudio(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|aac|ogg|webm|flac)$/i.test(file.name)) {
      fail('Escolha um arquivo de áudio comum, como WAV, MP3, M4A, OGG ou WebM.')
      return
    }
    setAudioName(file.name)
    await processAudio(file, file.name, 'import')
  }

  async function processAudio(blob: Blob, name: string, sourceType: PitchAudioMetadata['sourceType']) {
    setState('processing')
    setError(null)
    setAnalysis(null)
    setAudioMetadata(null)
    setExportError(null)
    setAudioName(name)
    setAudioUrl((current) => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(blob) })
    try {
      if (blob.size < 1000) throw new Error('O áudio está vazio ou muito curto.')
      const result = await decodeAndAnalyzeAudio(blob, readVocalRangeResult())
      if (result.buffer.duration < 1) throw new Error('O áudio está muito curto. Use pelo menos alguns segundos de canto.')
      setAudioMetadata({ sourceType, fileName: name, mimeType: blob.type || undefined, durationSeconds: result.buffer.duration, sampleRate: result.buffer.sampleRate, channelCount: result.buffer.numberOfChannels })
      setAnalysis(result.analysis)
      setState('results')
    } catch (caught) {
      fail(caught instanceof Error && caught.message.startsWith('Não foi detectado') ? caught.message : 'Não foi possível decodificar ou analisar o áudio. Tente um arquivo WAV, MP3, OGG ou WebM compatível com o navegador.')
    }
  }

  function fail(message: string) { setError(message); setState('error'); cleanup() }

  function playIssue(timestamp: number) {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(0, timestamp - 1.5)
    void audioRef.current.play()
  }

  function exportReport() {
    if (!analysis) return
    const report = {
      schemaVersion: 3,
      appVersion: 'pitch-replay-teacher-view-2',
      generatedAt: new Date().toISOString(),
      summary: { score: analysis.score, averageDeviation: analysis.averageDeviation, bias: analysis.bias, analyzedTime: analysis.analyzedTime },
      pitchZones: analysis.zones,
      rangeUsed: analysis.rangeUsed,
      tessitura: analysis.tessitura,
      noteDistribution: analysis.noteDistribution,
      sustainedNotes: analysis.sustainedNotes,
      attackInsights: analysis.attackInsights,
      endOfPhraseDrops: analysis.endOfPhraseDrops,
      phraseAnalysis: analysis.phrases,
      tonalCenterEstimate: analysis.tonalCenter,
      rangeComparison: analysis.rangeComparison,
      issueMarkers: analysis.reviewMoments,
      pitchSamples: analysis.samples,
    }
    downloadJson(report, 'pitch-replay-report.json')
  }

  function downloadReviewPackage() {
    if (!analysis || !audioMetadata) {
      setExportError('O pacote de revisão ainda não está pronto. Conclua a análise do áudio e tente novamente.')
      return
    }
    try {
      setExportError(null)
      const reviewPackage = buildPitchReviewPackage(analysis, audioMetadata, {
        environment: import.meta.env.MODE,
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      })
      downloadJson(reviewPackage, getReviewPackageFilename())
    } catch {
      setExportError('Não foi possível gerar o pacote de revisão. Sua análise continua disponível; tente novamente.')
    }
  }

  return (
    <main className="app-shell pitch-page">
      <nav className="page-nav" aria-label="Navegação principal"><a href="/">Curso de canto</a><a href="/range">Extensão vocal</a><a className="active" href="/pitch">Pitch Replay</a></nav>
      <header className="pitch-page-header">
        <span className="eyebrow">Análise livre de canto</span>
        <h1>Pitch Replay</h1>
        <p>Grave ou importe seu canto e veja quanto sua voz permaneceu próxima das notas musicais mais próximas.</p>
      </header>

      <aside className="pitch-disclaimer"><AlertCircle size={20} /><p><strong>O que esta ferramenta mede:</strong> ela não compara sua voz com a melodia original. A análise considera a altura que você realmente cantou e mede a centralização em relação à nota cromática mais próxima. Uma nota centralizada ainda pode ser a nota melódica errada.</p></aside>

      {error ? <div className="error-banner" role="alert">{error}</div> : null}

      <section className="panel capture-panel">
        <div><span className="eyebrow">1 · Adicione sua voz</span><h2>{state === 'recording' ? 'Gravando…' : state === 'processing' ? 'Analisando seu canto…' : 'Grave ou importe um áudio'}</h2><p>Gravações a capela em um ambiente silencioso produzem resultados mais claros.</p></div>
        {state === 'recording' ? <div className="recording-clock"><span className="recording-dot" />{formatTime(elapsed)}</div> : null}
        <div className="pitch-actions">
          {state === 'recording' ? <button className="button primary" onClick={stopRecording}><Square size={18} />Parar gravação</button> : <button className="button primary" onClick={() => void startRecording()} disabled={state === 'processing'}><Mic size={18} />Iniciar gravação</button>}
          <label className={`button secondary upload-button ${state === 'recording' || state === 'processing' ? 'disabled' : ''}`}><Upload size={18} />Importar áudio<input type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.webm,.flac" onChange={(event) => void importAudio(event)} disabled={state === 'recording' || state === 'processing'} /></label>
        </div>
        {state === 'processing' ? <div className="analysis-loading"><span /><p>Detectando trechos com voz, suavizando transições e medindo a centralização…</p></div> : null}
      </section>

      {audioUrl ? <section className="panel audio-panel"><div><span className="eyebrow">Ouça novamente</span><h2>Seu áudio</h2></div><audio ref={audioRef} controls src={audioUrl} /><a className="button secondary" href={audioUrl} download={audioName}><Download size={18} />Baixar áudio</a></section> : null}

      {analysis ? <Results analysis={analysis} onPlayIssue={playIssue} onExport={exportReport} onDownloadPackage={downloadReviewPackage} packageReady={Boolean(audioMetadata)} packageError={exportError} /> : null}
    </main>
  )
}

function Results({ analysis, onPlayIssue, onExport, onDownloadPackage, packageReady, packageError }: { analysis: PitchAnalysis; onPlayIssue: (timestamp: number) => void; onExport: () => void; onDownloadPackage: () => void; packageReady: boolean; packageError: string | null }) {
  const [view, setView] = useState<'simple' | 'teacher'>('simple')
  return <section className="pitch-results" aria-live="polite">
    <div className="results-heading"><div><span className="eyebrow">2 · Seus resultados</span><h2>Centralização das notas cantadas</h2></div><div className="export-actions"><button className="button secondary" onClick={onExport}><Download size={18} />Exportar relatório JSON</button><button className="button primary" onClick={onDownloadPackage} disabled={!packageReady}><Download size={18} />Baixar pacote de revisão</button><small>Use este pacote para compartilhar a análise completa sem precisar copiar a página.</small></div></div>
    {packageError ? <div className="error-banner" role="alert">{packageError}</div> : null}
    <div className="view-toggle" role="group" aria-label="Detalhamento dos resultados"><button className={view === 'simple' ? 'active' : ''} onClick={() => setView('simple')}>Visão simples</button><button className={view === 'teacher' ? 'active' : ''} onClick={() => setView('teacher')}>Visão do professor</button></div>
    {view === 'simple' ? <SimpleResults analysis={analysis} onPlay={onPlayIssue} /> : <TeacherResults analysis={analysis} onPlay={onPlayIssue} />}
  </section>
}

function SimpleResults({ analysis, onPlay }: { analysis: PitchAnalysis; onPlay: (timestamp: number) => void }) {
  return <div className="simple-results"><div className="summary-grid simple-summary-grid">{buildSimpleViewMetrics(analysis).map((metric) => <Summary key={metric.label} {...metric} />)}</div><ReviewMoments moments={getLessonReviewMoments(analysis)} onPlay={onPlay} title="Principais momentos para revisar" /></div>
}

function TeacherResults({ analysis, onPlay }: { analysis: PitchAnalysis; onPlay: (timestamp: number) => void }) {
  return <div className="teacher-results"><TeacherSummary analysis={analysis} /><div className="panel band-panel"><div><h3>Tempo com voz por zona</h3><p className="section-note">O desvio é sempre medido a partir da nota cromática mais próxima; por isso, a escala útil termina em 50 cents.</p></div><div className="band-bars"><Band label="Excelente / muito centralizada · 0–15¢" value={analysis.zones.excellent} kind="excellent" /><Band label="Boa / aceitável · 15–30¢" value={analysis.zones.good} kind="good" /><Band label="Pede atenção · 30–45¢" value={analysis.zones.attention} kind="slight" /><Band label="Entre notas / muito instável · 45–50¢" value={analysis.zones.betweenNotes} kind="off" /></div></div><div className="panel timeline-panel"><div><h3>Curva de centralização</h3><p>Desvio em cents da nota cromática mais próxima. A área verde representa ±15 cents; os marcadores indicam momentos para revisar.</p></div><PitchTimeline analysis={analysis} onPlayIssue={onPlay} /></div><ReviewMoments moments={analysis.reviewMoments} onPlay={onPlay} /><TeacherInsights analysis={analysis} onPlay={onPlay} /></div>
}

function ReviewMoments({ moments, onPlay, title = 'Momentos para revisar' }: { moments: ReviewMoment[]; onPlay: (timestamp: number) => void; title?: string }) {
  return <section className="panel issue-panel"><div><h3>{title}</h3><p>Sinais sobrepostos são combinados no mesmo momento. Clique para ouvir a partir de 1,5 segundo antes.</p></div><div className="review-list">{moments.map((moment) => <button key={`${moment.timestamp}-${moment.note}`} onClick={() => onPlay(moment.timestamp)}><div className="review-time"><strong>{formatReviewMomentTime(moment)}</strong></div><div><div className="review-title"><strong>{moment.note} · {formatReviewSignals(moment.signals)}</strong><span className={`severity ${moment.severity}`}>{translateReviewSeverity(moment.severity)}</span></div><p>{moment.severity === 'minor' && Math.abs(moment.averageCents) <= 30 ? 'Trecho majoritariamente dentro da zona aceitável, com um sinal breve útil para comparação.' : moment.explanation}</p></div><div className="review-metrics"><span>Desvio médio {signed(moment.averageCents)}</span><span>Desvio máximo {Math.round(moment.maxDeviation)}¢</span>{moment.driftCents !== null ? <span>Deriva {signed(moment.driftCents)}</span> : null}{moment.stabilityCents !== null ? <span>Variação de estabilidade {Math.round(moment.stabilityCents)}¢</span> : null}{moment.endDropCents !== null ? <span>Queda final {Math.round(moment.endDropCents)}¢</span> : null}</div></button>)}</div></section>
}

function TeacherSummary({ analysis }: { analysis: PitchAnalysis }) {
  return <section className="teacher-summary"><header><span className="eyebrow">Visão do professor</span><h2>Resumo para a aula</h2></header><div className="summary-grid coach-summary-grid">{buildTeacherLessonSummary(analysis).map((metric) => <Summary key={metric.label} {...metric} />)}</div></section>
}

function TeacherInsights({ analysis, onPlay }: { analysis: PitchAnalysis; onPlay: (timestamp: number) => void }) {
  const drops = analysis.endOfPhraseDrops
  return <section className="coach-section"><header><span className="eyebrow">Visão do professor</span><h2>Indicadores para a aula</h2><p>Medidas úteis para revisar esta gravação com um professor. Elas descrevem padrões de altura detectados, não técnica ou saúde vocal.</p></header>
    <div className="coach-card-grid"><CoachCard title="Extensão usada"><dl className="coach-definition"><div><dt>Extremos confiáveis observados</dt><dd>{analysis.rangeUsed.lowestReliableNote}–{analysis.rangeUsed.highestReliableNote}</dd></div><div><dt>Extensão sustentada</dt><dd>{analysis.rangeUsed.lowestSustainedNote ?? '--'}–{analysis.rangeUsed.highestSustainedNote ?? '--'}</dd></div><div><dt>Extensão útil para a aula</dt><dd>{analysis.rangeUsed.practicalRange} · {analysis.rangeUsed.spanSemitones} semitons</dd></div></dl><small>A extensão útil prioriza notas sustentadas ou a região central utilizável; extremos raros permanecem separados.</small></CoachCard><CoachCard title="Tessitura / região principal"><strong className="coach-big-value">{analysis.tessitura.zone}</strong><p>70% central do tempo com voz · {analysis.tessitura.mostUsedOctave.replace('Octave', 'Oitava')}</p><div className="region-strip"><span style={{width:`${analysis.tessitura.lowPercent}%`}}>Grave {Math.round(analysis.tessitura.lowPercent)}%</span><span style={{width:`${analysis.tessitura.middlePercent}%`}}>Média {Math.round(analysis.tessitura.middlePercent)}%</span><span style={{width:`${analysis.tessitura.highPercent}%`}}>Aguda {Math.round(analysis.tessitura.highPercent)}%</span></div></CoachCard><TonalCenterCard analysis={analysis} /><RangeComparisonCard analysis={analysis} /></div>
    <CoachCard title="Distribuição de notas"><p>Notas mais usadas pelo tempo com voz.</p><div className="note-distribution">{analysis.noteDistribution.slice(0, 10).map((item) => <div key={item.note}><strong>{item.note}</strong><span><i style={{width:`${item.percent}%`}} /></span><small>{item.seconds.toFixed(1).replace('.', ',')}s · {Math.round(item.percent)}%</small></div>)}</div></CoachCard>
    <CoachCard title="Análise de notas sustentadas"><p>Trechos confiáveis na mesma nota com pelo menos 0,35 segundo.</p>{analysis.sustainedNotes.length ? <div className="coach-table-scroll"><table className="coach-table"><thead><tr><th>Tempo</th><th>Nota</th><th>Duração</th><th>Média</th><th>Deriva</th><th>Estabilidade</th><th>Ataque</th></tr></thead><tbody>{[...analysis.sustainedNotes].sort((a,b) => b.duration-a.duration).slice(0,12).map((note) => <tr key={`${note.start}-${note.note}`}><td>{formatTime(note.start)}–{formatTime(note.end)}</td><td><strong>{note.note}</strong></td><td>{note.duration.toFixed(1).replace('.', ',')}s</td><td>{signed(note.averageCents)}</td><td>{signed(note.driftCents)}</td><td>{translateSustainedClassification(note.classification)}</td><td>{translateAttackClassification(note.attack)}</td></tr>)}</tbody></table></div> : <p className="empty-state">Nenhuma nota sustentada de alta confiança foi longa o suficiente para classificação.</p>}</CoachCard>
    <div className="coach-card-grid"><CoachCard title="Quedas no fim de frase"><strong className="coach-big-value">{drops.length}</strong><p>{drops.length ? `Queda média ${Math.round(drops.reduce((sum,item)=>sum+item.dropCents,0)/drops.length)}¢ · maior ${Math.round(Math.max(...drops.map(item=>item.dropCents)))}¢` : 'Nenhuma queda de alta confiança foi detectada no fim das frases.'}</p><div className="mini-links">{drops.slice(0,4).map((drop) => <button key={drop.timestamp} onClick={() => onPlay(drop.timestamp)}>{formatTime(drop.timestamp)} · {drop.note} · queda {Math.round(drop.dropCents)}¢</button>)}</div><small>A queda representa movimento da altura, não o desvio médio da nota mais próxima, e não identifica uma causa.</small></CoachCard><CoachCard title="Sinais de ataque"><p>{analysis.attackInsights.length} ataques de notas sustentadas classificados com alta confiança.</p><ul className="compact-list">{analysis.attackInsights.slice(0,6).map((note) => <li key={`${note.start}-attack`}><strong>{formatTime(note.start)} · {note.note}</strong><span>{translateAttackClassification(note.attack)}</span></li>)}</ul><small>Deslizamentos intencionais e portamentos podem parecer um ataque corrigido ou deslizante.</small></CoachCard></div>
    <CoachCard title="Indicadores por frase"><div className="phrase-list">{analysis.phrases.map((phrase) => <button key={phrase.index} onClick={() => onPlay(phrase.start)}><strong>Frase {phrase.index} · {translatePhraseClassification(phrase.classification)}</strong><span>{formatTime(phrase.start)}–{formatTime(phrase.end)} · {phrase.region}</span><span>{Math.round(phrase.centeringPercent)}% dentro de 30¢ · {translateBias(phrase.bias)}</span><small>{phrase.biggestIssue}</small></button>)}</div></CoachCard>
  </section>
}

function TonalCenterCard({ analysis }: { analysis: PitchAnalysis }) { const tonal = analysis.tonalCenter; return <CoachCard title="Possível centro tonal">{tonal.confidence === 'Low' ? <><strong className="coach-big-value tonal-unreliable">Centro tonal: não confiável o suficiente</strong>{tonal.label ? <p>Possível candidato: {formatTonalLabel(tonal.label)}<br />Confiança: baixa<br />Classes de altura mais comuns: {tonal.commonPitchClasses.join(', ')}</p> : <p>{tonal.explanation}</p>}</> : tonal.label ? <><strong className="coach-big-value">{formatTonalLabel(tonal.label)}</strong><p>Confiança: {translateConfidence(tonal.confidence)}<br />Classes de altura mais comuns: {tonal.commonPitchClasses.join(', ')}</p></> : <p>{tonal.explanation}</p>}<small>{tonal.explanation}</small></CoachCard> }
function RangeComparisonCard({ analysis }: { analysis: PitchAnalysis }) { const range = analysis.rangeComparison; return <CoachCard title="Comparação com a extensão vocal salva">{range.available ? <><strong className="coach-big-value">{Math.round(range.withinPercent ?? 0)}%</strong><p>dentro da sua extensão detectada salva ({range.savedRange})</p><dl className="coach-definition"><div><dt>Perto do limite inferior</dt><dd>{Math.round(range.nearLowerPercent ?? 0)}%</dd></div><div><dt>Perto do limite superior</dt><dd>{Math.round(range.nearUpperPercent ?? 0)}%</dd></div><div><dt>Mais grave / mais aguda</dt><dd>{range.lowestRelation}; {range.highestRelation}</dd></div></dl><small>Estar perto ou fora dessa extensão detectada não significa que seja inseguro ou tecnicamente errado.</small></> : <><p>Faça primeiro o <a href="/range">teste de extensão vocal</a> para comparar esta gravação com sua extensão detectada.</p><small>Nenhum dado de extensão foi inventado para este relatório.</small></>}</CoachCard> }
function CoachCard({ title, children }: { title: string; children: React.ReactNode }) { return <section className="panel coach-card"><h3>{title}</h3>{children}</section> }

function PitchTimeline({ analysis, onPlayIssue }: { analysis: PitchAnalysis; onPlayIssue: (timestamp: number) => void }) {
  const width = 1000, height = 230, pad = 30
  const x = (time: number) => pad + (time / Math.max(analysis.duration, 0.1)) * (width - pad * 2)
  const y = (cents: number) => height / 2 - (Math.max(-75, Math.min(75, cents)) / 75) * (height / 2 - pad)
  const path = analysis.samples.map((sample, index) => `${index ? 'L' : 'M'} ${x(sample.timestamp).toFixed(1)} ${y(sample.cents).toFixed(1)}`).join(' ')
  return <div className="timeline-scroll"><svg className="pitch-timeline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Desvio de altura ao longo do tempo"><rect x={pad} y={y(15)} width={width - pad * 2} height={y(-15) - y(15)} className="good-zone" /><line x1={pad} x2={width-pad} y1={y(0)} y2={y(0)} className="center-line" /><text x="4" y={y(45)+4}>+45¢</text><text x="10" y={y(0)+4}>0¢</text><text x="4" y={y(-45)+4}>−45¢</text><path d={path} className="pitch-path" />{analysis.reviewMoments.map((issue) => <g key={`${issue.timestamp}-${issue.note}`} className="issue-marker" onClick={() => onPlayIssue(issue.timestamp)} role="button"><circle cx={x(issue.timestamp)} cy={y(issue.averageCents)} r="7" /><title>{`${formatTime(issue.timestamp)} ${issue.note} ${signed(issue.averageCents)}`}</title></g>)}</svg></div>
}

function Summary({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="summary-card"><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</div> }
function Band({ label, value, kind }: { label: string; value: number; kind: string }) { return <div className="band-row"><div><span>{label}</span><strong>{Math.round(value)}%</strong></div><div className="band-track"><span className={kind} style={{ width: `${value}%` }} /></div></div> }
function signed(value: number) { const rounded = Math.round(value); return `${rounded > 0 ? '+' : ''}${rounded}¢` }
function formatTime(seconds: number) { const whole = Math.max(0, Math.floor(seconds)); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}` }
function downloadJson(data: unknown, filename: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url) }
function extensionFor(mime: string) { return `pitch-replay.${mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm'}` }
