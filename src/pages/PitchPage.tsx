import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Download, Mic, Square, Upload } from 'lucide-react'
import { decodeAndAnalyzeAudio, type PitchAnalysis, type ReviewMoment } from '../lib/pitchAnalysis'
import {
  buildPitchReviewPackage,
  buildSimpleViewMetrics,
  buildTeacherLessonSummary,
  formatReviewMomentTime,
  formatReviewSignals,
  getReviewPackageFilename,
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
      fail('This browser does not support microphone recording. Try importing an audio file instead.')
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
      fail(denied ? 'Microphone permission was denied. Allow access or import an audio file.' : 'The microphone could not be started. Check that another app is not using it.')
    }
  }

  function stopRecording() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    if (elapsed < 1) {
      discardRecordingRef.current = true
      recorderRef.current?.stop()
      fail('That recording was very short. For a useful result, record at least a few seconds of singing.')
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
      fail('Choose a common audio file such as WAV, MP3, M4A, OGG, or WebM.')
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
      if (blob.size < 1000) throw new Error('The audio is too short or empty.')
      const result = await decodeAndAnalyzeAudio(blob, readVocalRangeResult())
      if (result.buffer.duration < 1) throw new Error('The audio is too short. Use at least a few seconds of singing.')
      setAudioMetadata({ sourceType, fileName: name, mimeType: blob.type || undefined, durationSeconds: result.buffer.duration, sampleRate: result.buffer.sampleRate, channelCount: result.buffer.numberOfChannels })
      setAnalysis(result.analysis)
      setState('results')
    } catch (caught) {
      fail(caught instanceof Error && caught.message.startsWith('No clear') ? caught.message : 'The audio could not be decoded or analyzed. Try a browser-friendly WAV, MP3, OGG, or WebM file.')
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
      setExportError('The review package is not ready yet. Complete the audio analysis and try again.')
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
      setExportError('The review package could not be generated. Your analysis is still available; please try again.')
    }
  }

  return (
    <main className="app-shell pitch-page">
      <nav className="page-nav" aria-label="Main navigation"><a href="/">Training course</a><a href="/range">Vocal range</a><a className="active" href="/pitch">Pitch Replay</a></nav>
      <header className="pitch-page-header">
        <span className="eyebrow">Free singing analysis</span>
        <h1>Pitch Replay</h1>
        <p>Record or import your singing and see how close your voice stayed to the nearest musical notes.</p>
      </header>

      <aside className="pitch-disclaimer"><AlertCircle size={20} /><p><strong>What this measures:</strong> This tool does not compare your voice to the original melody of a song. It analyzes the pitch you actually sang and measures how centered each sung note was against the nearest chromatic note.</p></aside>

      {error ? <div className="error-banner" role="alert">{error}</div> : null}

      <section className="panel capture-panel">
        <div><span className="eyebrow">1 · Add your voice</span><h2>{state === 'recording' ? 'Recording…' : state === 'processing' ? 'Analyzing your singing…' : 'Record or import audio'}</h2><p>Acapella recordings in a quiet space give the clearest result.</p></div>
        {state === 'recording' ? <div className="recording-clock"><span className="recording-dot" />{formatTime(elapsed)}</div> : null}
        <div className="pitch-actions">
          {state === 'recording' ? <button className="button primary" onClick={stopRecording}><Square size={18} />Stop recording</button> : <button className="button primary" onClick={() => void startRecording()} disabled={state === 'processing'}><Mic size={18} />Start recording</button>}
          <label className={`button secondary upload-button ${state === 'recording' || state === 'processing' ? 'disabled' : ''}`}><Upload size={18} />Import audio<input type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.webm,.flac" onChange={(event) => void importAudio(event)} disabled={state === 'recording' || state === 'processing'} /></label>
        </div>
        {state === 'processing' ? <div className="analysis-loading"><span /><p>Detecting voiced sections, smoothing transitions, and measuring pitch centering…</p></div> : null}
      </section>

      {audioUrl ? <section className="panel audio-panel"><div><span className="eyebrow">Listen back</span><h2>Your audio</h2></div><audio ref={audioRef} controls src={audioUrl} /><a className="button secondary" href={audioUrl} download={audioName}><Download size={18} />Download audio</a></section> : null}

      {analysis ? <Results analysis={analysis} onPlayIssue={playIssue} onExport={exportReport} onDownloadPackage={downloadReviewPackage} packageReady={Boolean(audioMetadata)} packageError={exportError} /> : null}
    </main>
  )
}

function Results({ analysis, onPlayIssue, onExport, onDownloadPackage, packageReady, packageError }: { analysis: PitchAnalysis; onPlayIssue: (timestamp: number) => void; onExport: () => void; onDownloadPackage: () => void; packageReady: boolean; packageError: string | null }) {
  const [view, setView] = useState<'simple' | 'teacher'>('simple')
  return <section className="pitch-results" aria-live="polite">
    <div className="results-heading"><div><span className="eyebrow">2 · Your results</span><h2>How centered your sung notes were</h2></div><div className="export-actions"><button className="button secondary" onClick={onExport}><Download size={18} />Export JSON report</button><button className="button primary" onClick={onDownloadPackage} disabled={!packageReady}><Download size={18} />Download review package</button><small>Use this package to share the full analysis for review without copying the page.</small></div></div>
    {packageError ? <div className="error-banner" role="alert">{packageError}</div> : null}
    <div className="view-toggle" role="group" aria-label="Results detail"><button className={view === 'simple' ? 'active' : ''} onClick={() => setView('simple')}>Simple View</button><button className={view === 'teacher' ? 'active' : ''} onClick={() => setView('teacher')}>Teacher View</button></div>
    {view === 'simple' ? <SimpleResults analysis={analysis} onPlay={onPlayIssue} /> : <TeacherResults analysis={analysis} onPlay={onPlayIssue} />}
  </section>
}

function SimpleResults({ analysis, onPlay }: { analysis: PitchAnalysis; onPlay: (timestamp: number) => void }) {
  return <div className="simple-results"><div className="summary-grid simple-summary-grid">{buildSimpleViewMetrics(analysis).map((metric) => <Summary key={metric.label} {...metric} />)}</div><ReviewMoments moments={analysis.reviewMoments.slice(0, 3)} onPlay={onPlay} title="Top review moments" /></div>
}

function TeacherResults({ analysis, onPlay }: { analysis: PitchAnalysis; onPlay: (timestamp: number) => void }) {
  return <div className="teacher-results"><TeacherSummary analysis={analysis} /><div className="panel band-panel"><div><h3>Voiced time by nearest-note zone</h3><p className="section-note">Deviation is always measured from the nearest chromatic note, so the useful scale ends at 50 cents.</p></div><div className="band-bars"><Band label="Excellent / very centered · 0–15¢" value={analysis.zones.excellent} kind="excellent" /><Band label="Good / acceptable · 15–30¢" value={analysis.zones.good} kind="good" /><Band label="Needs attention · 30–45¢" value={analysis.zones.attention} kind="slight" /><Band label="Between notes / very unstable · 45–50¢" value={analysis.zones.betweenNotes} kind="off" /></div></div><div className="panel timeline-panel"><div><h3>Pitch-centering curve</h3><p>Cents from the nearest chromatic note. The green area is ±15 cents; markers show review moments.</p></div><PitchTimeline analysis={analysis} onPlayIssue={onPlay} /></div><ReviewMoments moments={analysis.reviewMoments} onPlay={onPlay} /><TeacherInsights analysis={analysis} onPlay={onPlay} /></div>
}

function ReviewMoments({ moments, onPlay, title = 'Moments to review' }: { moments: ReviewMoment[]; onPlay: (timestamp: number) => void; title?: string }) {
  return <section className="panel issue-panel"><div><h3>{title}</h3><p>Combined signals for overlapping moments. Click to hear from 1.5 seconds before.</p></div><div className="review-list">{moments.map((moment) => <button key={`${moment.timestamp}-${moment.note}`} onClick={() => onPlay(moment.timestamp)}><div className="review-time"><strong>{formatReviewMomentTime(moment)}</strong></div><div><div className="review-title"><strong>{moment.note} · {formatReviewSignals(moment.signals)}</strong><span className={`severity ${moment.severity}`}>{moment.severity}</span></div><p>{moment.severity === 'minor' && Math.abs(moment.averageCents) <= 30 ? 'Mostly within the acceptable zone, with a brief signal worth comparing.' : moment.explanation}</p></div><div className="review-metrics"><span>Avg deviation {signed(moment.averageCents)}</span><span>Max deviation {Math.round(moment.maxDeviation)}¢</span>{moment.driftCents !== null ? <span>Drift {signed(moment.driftCents)}</span> : null}{moment.stabilityCents !== null ? <span>Stability spread {Math.round(moment.stabilityCents)}¢</span> : null}{moment.endDropCents !== null ? <span>End drop {Math.round(moment.endDropCents)}¢</span> : null}</div></button>)}</div></section>
}

function TeacherSummary({ analysis }: { analysis: PitchAnalysis }) {
  return <section className="teacher-summary"><header><span className="eyebrow">Teacher View</span><h2>Lesson summary</h2></header><div className="summary-grid coach-summary-grid">{buildTeacherLessonSummary(analysis).map((metric) => <Summary key={metric.label} {...metric} />)}</div></section>
}

function TeacherInsights({ analysis, onPlay }: { analysis: PitchAnalysis; onPlay: (timestamp: number) => void }) {
  const drops = analysis.endOfPhraseDrops
  return <section className="coach-section"><header><span className="eyebrow">Teacher View</span><h2>Vocal Coach Insights</h2><p>Useful measurements for reviewing this take with a teacher. They describe detected pitch patterns, not technique or vocal health.</p></header>
    <div className="coach-card-grid"><CoachCard title="Range used"><dl className="coach-definition"><div><dt>Observed reliable extremes</dt><dd>{analysis.rangeUsed.lowestReliableNote}–{analysis.rangeUsed.highestReliableNote}</dd></div><div><dt>Sustained range</dt><dd>{analysis.rangeUsed.lowestSustainedNote ?? '--'}–{analysis.rangeUsed.highestSustainedNote ?? '--'}</dd></div><div><dt>Lesson-useful range</dt><dd>{analysis.rangeUsed.practicalRange} · {analysis.rangeUsed.spanSemitones} semitones</dd></div></dl><small>Lesson-useful range uses the {analysis.rangeUsed.practicalRangeSource}; rare reliable extremes remain separate.</small></CoachCard><CoachCard title="Tessitura / main zone"><strong className="coach-big-value">{analysis.tessitura.zone}</strong><p>Central 70% by voiced time · {analysis.tessitura.mostUsedOctave}</p><div className="region-strip"><span style={{width:`${analysis.tessitura.lowPercent}%`}}>Low {Math.round(analysis.tessitura.lowPercent)}%</span><span style={{width:`${analysis.tessitura.middlePercent}%`}}>Mid {Math.round(analysis.tessitura.middlePercent)}%</span><span style={{width:`${analysis.tessitura.highPercent}%`}}>High {Math.round(analysis.tessitura.highPercent)}%</span></div></CoachCard><TonalCenterCard analysis={analysis} /><RangeComparisonCard analysis={analysis} /></div>
    <CoachCard title="Note distribution"><p>Most used notes by voiced time.</p><div className="note-distribution">{analysis.noteDistribution.slice(0, 10).map((item) => <div key={item.note}><strong>{item.note}</strong><span><i style={{width:`${item.percent}%`}} /></span><small>{item.seconds.toFixed(1)}s · {Math.round(item.percent)}%</small></div>)}</div></CoachCard>
    <CoachCard title="Sustained notes analysis"><p>Reliable same-note segments of at least 0.35 seconds.</p>{analysis.sustainedNotes.length ? <div className="coach-table-scroll"><table className="coach-table"><thead><tr><th>Time</th><th>Note</th><th>Duration</th><th>Average</th><th>Drift</th><th>Stability</th><th>Attack</th></tr></thead><tbody>{[...analysis.sustainedNotes].sort((a,b) => b.duration-a.duration).slice(0,12).map((note) => <tr key={`${note.start}-${note.note}`}><td>{formatTime(note.start)}–{formatTime(note.end)}</td><td><strong>{note.note}</strong></td><td>{note.duration.toFixed(1)}s</td><td>{signed(note.averageCents)}</td><td>{signed(note.driftCents)}</td><td>{note.classification}</td><td>{note.attack}</td></tr>)}</tbody></table></div> : <p className="empty-state">No high-confidence sustained notes were long enough to classify.</p>}</CoachCard>
    <div className="coach-card-grid"><CoachCard title="End-of-phrase drops"><strong className="coach-big-value">{drops.length}</strong><p>{drops.length ? `Average drop ${Math.round(drops.reduce((sum,item)=>sum+item.dropCents,0)/drops.length)}¢ · largest ${Math.round(Math.max(...drops.map(item=>item.dropCents)))}¢` : 'No high-confidence phrase-ending drops detected.'}</p><div className="mini-links">{drops.slice(0,4).map((drop) => <button key={drop.timestamp} onClick={() => onPlay(drop.timestamp)}>{formatTime(drop.timestamp)} · {drop.note} · drop {Math.round(drop.dropCents)}¢</button>)}</div><small>Drop amount is pitch movement, not average deviation from the nearest note. This signal does not identify a cause.</small></CoachCard><CoachCard title="Attack signals"><p>{analysis.attackInsights.length} high-confidence sustained-note attacks classified.</p><ul className="compact-list">{analysis.attackInsights.slice(0,6).map((note) => <li key={`${note.start}-attack`}><strong>{formatTime(note.start)} · {note.note}</strong><span>{note.attack}</span></li>)}</ul><small>Intentional slides and portamento may resemble a corrected or sliding attack.</small></CoachCard></div>
    <CoachCard title="Phrase-level insights"><div className="phrase-list">{analysis.phrases.map((phrase) => <button key={phrase.index} onClick={() => onPlay(phrase.start)}><strong>Phrase {phrase.index} · {phrase.classification}</strong><span>{formatTime(phrase.start)}–{formatTime(phrase.end)} · {phrase.region}</span><span>{Math.round(phrase.centeringPercent)}% within 30¢ · {phrase.bias}</span><small>{phrase.biggestIssue}</small></button>)}</div></CoachCard>
  </section>
}

function TonalCenterCard({ analysis }: { analysis: PitchAnalysis }) { const tonal = analysis.tonalCenter; return <CoachCard title="Possible tonal center">{tonal.confidence === 'Low' ? <><strong className="coach-big-value tonal-unreliable">Tonal center: not reliable enough</strong>{tonal.label ? <p>Possible candidate: {tonal.label}<br />Confidence: Low<br />Most common pitch classes: {tonal.commonPitchClasses.join(', ')}</p> : <p>{tonal.explanation}</p>}</> : tonal.label ? <><strong className="coach-big-value">{tonal.label}</strong><p>Confidence: {tonal.confidence}<br />Common pitch classes: {tonal.commonPitchClasses.join(', ')}</p></> : <p>{tonal.explanation}</p>}<small>{tonal.explanation}</small></CoachCard> }
function RangeComparisonCard({ analysis }: { analysis: PitchAnalysis }) { const range = analysis.rangeComparison; return <CoachCard title="Saved vocal-range comparison">{range.available ? <><strong className="coach-big-value">{Math.round(range.withinPercent ?? 0)}%</strong><p>within your saved detected range ({range.savedRange})</p><dl className="coach-definition"><div><dt>Near lower limit</dt><dd>{Math.round(range.nearLowerPercent ?? 0)}%</dd></div><div><dt>Near upper limit</dt><dd>{Math.round(range.nearUpperPercent ?? 0)}%</dd></div><div><dt>Lowest / highest</dt><dd>{range.lowestRelation}; {range.highestRelation}</dd></div></dl><small>Being near or outside this detected range does not mean unsafe or technically wrong.</small></> : <><p>Run the <a href="/range">Vocal Range test</a> first to compare this take against your detected range.</p><small>No range data was invented for this report.</small></>}</CoachCard> }
function CoachCard({ title, children }: { title: string; children: React.ReactNode }) { return <section className="panel coach-card"><h3>{title}</h3>{children}</section> }

function PitchTimeline({ analysis, onPlayIssue }: { analysis: PitchAnalysis; onPlayIssue: (timestamp: number) => void }) {
  const width = 1000, height = 230, pad = 30
  const x = (time: number) => pad + (time / Math.max(analysis.duration, 0.1)) * (width - pad * 2)
  const y = (cents: number) => height / 2 - (Math.max(-75, Math.min(75, cents)) / 75) * (height / 2 - pad)
  const path = analysis.samples.map((sample, index) => `${index ? 'L' : 'M'} ${x(sample.timestamp).toFixed(1)} ${y(sample.cents).toFixed(1)}`).join(' ')
  return <div className="timeline-scroll"><svg className="pitch-timeline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Pitch deviation over time"><rect x={pad} y={y(15)} width={width - pad * 2} height={y(-15) - y(15)} className="good-zone" /><line x1={pad} x2={width-pad} y1={y(0)} y2={y(0)} className="center-line" /><text x="4" y={y(45)+4}>+45¢</text><text x="10" y={y(0)+4}>0¢</text><text x="4" y={y(-45)+4}>−45¢</text><path d={path} className="pitch-path" />{analysis.reviewMoments.map((issue) => <g key={`${issue.timestamp}-${issue.note}`} className="issue-marker" onClick={() => onPlayIssue(issue.timestamp)} role="button"><circle cx={x(issue.timestamp)} cy={y(issue.averageCents)} r="7" /><title>{`${formatTime(issue.timestamp)} ${issue.note} ${signed(issue.averageCents)}`}</title></g>)}</svg></div>
}

function Summary({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="summary-card"><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</div> }
function Band({ label, value, kind }: { label: string; value: number; kind: string }) { return <div className="band-row"><div><span>{label}</span><strong>{Math.round(value)}%</strong></div><div className="band-track"><span className={kind} style={{ width: `${value}%` }} /></div></div> }
function signed(value: number) { const rounded = Math.round(value); return `${rounded > 0 ? '+' : ''}${rounded}¢` }
function formatTime(seconds: number) { const whole = Math.max(0, Math.floor(seconds)); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}` }
function downloadJson(data: unknown, filename: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url) }
function extensionFor(mime: string) { return `pitch-replay.${mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm'}` }
