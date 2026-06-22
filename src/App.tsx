import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Tone from 'tone'
import { CourseMap } from './components/CourseMap'
import { LessonControls } from './components/LessonControls'
import { LessonStage } from './components/LessonStage'
import { PitchMeter } from './components/PitchMeter'
import { SessionHistory } from './components/SessionHistory'
import { VocalRangeTool } from './components/VocalRangeTool'
import { useMicrophonePitch } from './hooks/useMicrophonePitch'
import {
  COURSE,
  getGrade,
  getLessonById,
  isLessonUnlocked,
  readCourseProgress,
  saveLessonProgress,
  type CourseProgress,
  type CourseStage,
  type LessonGrade,
} from './lib/course'
import {
  buildLessonSequence,
  calculateArcadeScore,
  createEmptyStats,
  createSegmentResults,
  createSegmentStats,
  evaluateSegment,
  getActiveNoteIndex,
  getArcadeDiagnosis,
  getNoteProgress,
  getStars,
  getTotalDuration,
  recordArcadeSample,
  type ArcadeStats,
  type GameNote,
  type SegmentStats,
} from './lib/game'
import { NOTE_OPTIONS, centsBetween, frequencyToNoteName, getPitchStatus } from './lib/music'
import { type SessionAttempt, readHistory, saveAttempt } from './lib/scoring'
import './App.css'

type GameState = 'idle' | 'playing' | 'finished'

const DEFAULT_BASE_MIDI = 57
const TICK_MS = 80

function App() {
  const firstLesson = COURSE.stages[0].lessons[0]
  const [selectedLessonId, setSelectedLessonId] = useState(firstLesson.id)
  const [baseMidi, setBaseMidi] = useState(DEFAULT_BASE_MIDI)
  const [tolerance, setTolerance] = useState(25)
  const [history, setHistory] = useState<SessionAttempt[]>(() => readHistory())
  const [courseProgress, setCourseProgress] = useState<CourseProgress>(() => readCourseProgress())
  const [latestScore, setLatestScore] = useState<number | null>(null)
  const [latestGrade, setLatestGrade] = useState<LessonGrade | null>(null)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [activeIndex, setActiveIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [noteProgress, setNoteProgress] = useState(0)
  const [liveStats, setLiveStats] = useState<ArcadeStats>(() => createEmptyStats())
  const [segmentResults, setSegmentResults] = useState(() => createSegmentResults(firstLesson.steps.length))
  const [diagnosis, setDiagnosis] = useState<string | null>(null)
  const gameStartedAtRef = useRef(0)
  const lastActiveIndexRef = useRef(0)
  const synthRef = useRef<Tone.PolySynth | null>(null)
  const statsRef = useRef(createEmptyStats())
  const segmentStatsRef = useRef<SegmentStats[]>([])
  const sequenceRef = useRef<GameNote[]>([])
  const { reading, isListening, error, start, stop } = useMicrophonePitch()
  const readingRef = useRef(reading)

  const selectedItem = useMemo(() => getLessonById(selectedLessonId), [selectedLessonId])
  const selectedLesson = selectedItem.lesson
  const selectedStage = selectedItem.stage
  const baseNotes = useMemo(() => NOTE_OPTIONS.filter((note) => note.midi <= 60), [])
  const baseNote = useMemo(
    () => baseNotes.find((note) => note.midi === baseMidi) ?? baseNotes[9],
    [baseMidi, baseNotes],
  )
  const sequence = useMemo(
    () => buildLessonSequence(selectedLesson, baseNote.midi),
    [selectedLesson, baseNote.midi],
  )
  sequenceRef.current = sequence
  const targetNote = sequence[activeIndex] ?? sequence[0]
  const cents = reading.frequency === null ? null : centsBetween(reading.frequency, targetNote.frequency)
  const detectedNote = reading.frequency === null ? null : frequencyToNoteName(reading.frequency)
  const status = getPitchStatus(cents, tolerance)
  const isPlaying = gameState === 'playing'
  const isLocked = !isLessonUnlocked(selectedLesson.id, courseProgress)
  const displayedGrade = latestGrade ?? courseProgress[selectedLesson.id]?.grade ?? null

  useEffect(() => {
    readingRef.current = reading
  }, [reading])

  useEffect(() => {
    return () => {
      synthRef.current?.dispose()
    }
  }, [])

  const playNotes = useCallback(async (notes: string[], duration = '0.75s') => {
    await Tone.start()

    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.02,
          decay: 0.08,
          sustain: 0.6,
          release: 0.28,
        },
      }).toDestination()
    }

    synthRef.current.triggerAttackRelease(notes, duration)
  }, [])

  const playLessonCue = useCallback(
    async (currentIndex = activeIndex) => {
      const currentSequence = sequenceRef.current
      const currentLesson = getLessonById(selectedLessonId).lesson

      if (currentLesson.cueMode === 'root-only') {
        await playNotes([currentSequence[0].label], '0.9s')
        return
      }

      if (currentLesson.cueMode === 'chord-only' || currentLesson.cueMode === 'chord-guide') {
        const chord = getCueChord(currentSequence)

        await playNotes(chord, '0.9s')
        return
      }

      await playNotes([currentSequence[currentIndex].label], '0.75s')
    },
    [activeIndex, playNotes, selectedLessonId],
  )

  const finishLesson = useCallback(() => {
    const currentSequence = sequenceRef.current
    const currentStats = statsRef.current
    const finalResults = segmentStatsRef.current.map(evaluateSegment)
    const finalScore = calculateArcadeScore(currentStats, tolerance)
    const finalStats = {
      ...currentStats,
      score: finalScore,
    }
    const grade = getGrade(finalScore)
    const inTunePercent =
      finalStats.voicedSamples > 0
        ? Math.round((finalStats.inTuneSamples / finalStats.voicedSamples) * 100)
        : 0
    const averageError =
      finalStats.voicedSamples > 0 ? finalStats.errorSum / finalStats.voicedSamples : null
    const stars = getStars(finalScore)
    const attempt: SessionAttempt = {
      id: crypto.randomUUID(),
      note: currentSequence.map((note) => note.label).join(' '),
      mode: selectedLesson.title,
      score: finalScore,
      grade,
      inTunePercent,
      averageError,
      stars,
      bestCombo: finalStats.bestCombo,
      createdAt: new Date().toISOString(),
    }
    const nextCourseProgress = saveLessonProgress(courseProgress, selectedLesson.id, {
      bestScore: finalScore,
      grade,
      stars,
      bestCombo: finalStats.bestCombo,
      completedAt: attempt.createdAt,
    })

    statsRef.current = finalStats
    setCourseProgress(nextCourseProgress)
    setLiveStats(finalStats)
    setSegmentResults(finalResults)
    setHistory(saveAttempt(attempt))
    setLatestScore(finalScore)
    setLatestGrade(grade)
    setDiagnosis(getArcadeDiagnosis(finalStats, tolerance))
    setGameState('finished')
    setProgress(1)
    setNoteProgress(1)
  }, [courseProgress, selectedLesson, tolerance])

  useEffect(() => {
    if (!isPlaying) {
      return
    }

    const interval = window.setInterval(() => {
      const currentSequence = sequenceRef.current
      const currentLesson = getLessonById(selectedLessonId).lesson
      const totalDuration = getTotalDuration(currentSequence)
      const elapsed = performance.now() - gameStartedAtRef.current

      if (elapsed >= totalDuration) {
        finishLesson()
        return
      }

      const nextActiveIndex = getActiveNoteIndex(currentSequence, elapsed)

      if (nextActiveIndex !== lastActiveIndexRef.current) {
        const previousIndex = lastActiveIndexRef.current
        const previousResult = evaluateSegment(segmentStatsRef.current[previousIndex])

        lastActiveIndexRef.current = nextActiveIndex
        setActiveIndex(nextActiveIndex)
        setSegmentResults((currentResults) =>
          currentResults.map((result, index) => {
            if (index === previousIndex) {
              return previousResult
            }

            if (index === nextActiveIndex) {
              return 'active'
            }

            return result
          }),
        )

        if (currentLesson.cueMode === 'guide' || currentLesson.cueMode === 'chord-guide') {
          void playNotes([currentSequence[nextActiveIndex].label], '0.65s')
        }
      }

      const activeNote = currentSequence[nextActiveIndex]
      const currentReading = readingRef.current
      const sampleCents =
        currentReading.frequency === null ? null : centsBetween(currentReading.frequency, activeNote.frequency)

      recordArcadeSample(
        statsRef.current,
        segmentStatsRef.current[nextActiveIndex],
        sampleCents,
        currentReading.isVoiceDetected,
        tolerance,
      )

      setLiveStats({ ...statsRef.current })
      setProgress(elapsed / totalDuration)
      setNoteProgress(getNoteProgress(currentSequence, nextActiveIndex, elapsed))
    }, TICK_MS)

    return () => window.clearInterval(interval)
  }, [finishLesson, isPlaying, playNotes, selectedLessonId, tolerance])

  async function toggleMic() {
    if (isListening) {
      stop()
      stopLesson()
      return
    }

    await start()
  }

  async function startLesson() {
    if (isLocked) {
      return
    }

    if (!isListening) {
      await start()
    }

    const currentSequence = sequenceRef.current

    statsRef.current = createEmptyStats()
    segmentStatsRef.current = createSegmentStats(currentSequence.length)
    lastActiveIndexRef.current = 0
    gameStartedAtRef.current = performance.now()
    setLiveStats(statsRef.current)
    setSegmentResults(createSegmentResults(currentSequence.length))
    setActiveIndex(0)
    setProgress(0)
    setNoteProgress(0)
    setLatestScore(null)
    setLatestGrade(null)
    setDiagnosis(null)
    setGameState('playing')
    void playLessonCue(0)
  }

  function stopLesson() {
    statsRef.current = createEmptyStats()
    segmentStatsRef.current = createSegmentStats(sequenceRef.current.length)
    lastActiveIndexRef.current = 0
    setGameState('idle')
    setLiveStats(statsRef.current)
    setSegmentResults(createSegmentResults(sequenceRef.current.length))
    setActiveIndex(0)
    setProgress(0)
    setNoteProgress(0)
    setDiagnosis(null)
  }

  function resetLesson(nextSequence: GameNote[]) {
    statsRef.current = createEmptyStats()
    segmentStatsRef.current = createSegmentStats(nextSequence.length)
    lastActiveIndexRef.current = 0
    setGameState('idle')
    setLiveStats(statsRef.current)
    setSegmentResults(createSegmentResults(nextSequence.length))
    setActiveIndex(0)
    setProgress(0)
    setNoteProgress(0)
    setLatestScore(null)
    setLatestGrade(null)
    setDiagnosis(null)
  }

  function selectLesson(lessonId: string) {
    if (!isLessonUnlocked(lessonId, courseProgress)) {
      return
    }

    const nextLesson = getLessonById(lessonId).lesson
    const nextSequence = buildLessonSequence(nextLesson, baseNote.midi)

    setSelectedLessonId(lessonId)
    resetLesson(nextSequence)
  }

  function changeBaseNote(nextMidi: number) {
    const nextBaseNote = baseNotes.find((note) => note.midi === nextMidi) ?? baseNotes[9]
    const nextSequence = buildLessonSequence(selectedLesson, nextBaseNote.midi)

    setBaseMidi(nextMidi)
    resetLesson(nextSequence)
  }

  return (
    <main className="app-shell course-shell">
      <nav className="page-nav" aria-label="Main navigation">
        <a className="active" href="/">Curso de canto</a>
        <a href="/range">Extensão vocal</a>
        <a href="/pitch">Pitch Replay</a>
      </nav>
      <header className="app-header">
        <div>
          <span className="eyebrow">Singing trainer</span>
          <h1>Curso de intervalos cantados</h1>
        </div>
        <p>
          Passe por aulas curtas, cante os alvos na pista e tire B ou melhor para liberar o próximo
          exercício.
        </p>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="course-workspace">
        <CourseMap
          selectedLessonId={selectedLesson.id}
          progress={courseProgress}
          disabled={isPlaying}
          onSelectLesson={selectLesson}
        />

        <div className="main-column">
          <LessonStage
            stage={selectedStage as CourseStage}
            lesson={selectedLesson}
            sequence={sequence}
            activeIndex={activeIndex}
            progress={progress}
            noteProgress={noteProgress}
            stats={liveStats}
            segmentResults={segmentResults}
            status={status}
            isPlaying={isPlaying}
            isLocked={isLocked}
            grade={displayedGrade}
            diagnosis={diagnosis}
          />

          <PitchMeter
            targetNote={targetNote.label}
            targetFrequency={targetNote.frequency}
            detectedNote={detectedNote}
            frequency={reading.frequency}
            cents={cents}
            clarity={reading.clarity}
            volume={reading.volume}
            status={status}
            tolerance={tolerance}
            isListening={isListening}
          />

          <LessonControls
            lesson={selectedLesson}
            baseNote={baseNote}
            baseNotes={baseNotes}
            tolerance={tolerance}
            isListening={isListening}
            isPlaying={isPlaying}
            isLocked={isLocked}
            sequence={sequence}
            onBaseNoteChange={changeBaseNote}
            onToleranceChange={setTolerance}
            onToggleMic={toggleMic}
            onPlayCue={() => void playLessonCue()}
            onStartLesson={startLesson}
            onStopLesson={stopLesson}
          />
        </div>

        <div className="side-column">
          <VocalRangeTool
            reading={reading}
            isListening={isListening}
            disabled={isPlaying}
            onStartMicrophone={start}
            onApplyBaseNote={changeBaseNote}
          />

          <SessionHistory attempts={history} latestScore={latestScore} />
        </div>
      </div>
    </main>
  )
}

function getCueChord(sequence: GameNote[]) {
  const labels = Array.from(new Set(sequence.map((note) => note.label)))

  return labels.slice(0, 3)
}

export default App
