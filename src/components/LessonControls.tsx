import { Mic, MicOff, Play, RotateCcw, SlidersHorizontal, Volume2 } from 'lucide-react'
import type { CourseLesson } from '../lib/course'
import type { GameNote } from '../lib/game'
import type { NoteOption } from '../lib/music'

type LessonControlsProps = {
  lesson: CourseLesson
  baseNote: NoteOption
  baseNotes: NoteOption[]
  tolerance: number
  isListening: boolean
  isPlaying: boolean
  isLocked: boolean
  sequence: GameNote[]
  onBaseNoteChange: (midi: number) => void
  onToleranceChange: (tolerance: number) => void
  onToggleMic: () => void
  onPlayCue: () => void
  onStartLesson: () => void
  onStopLesson: () => void
}

export function LessonControls({
  lesson,
  baseNote,
  baseNotes,
  tolerance,
  isListening,
  isPlaying,
  isLocked,
  sequence,
  onBaseNoteChange,
  onToleranceChange,
  onToggleMic,
  onPlayCue,
  onStartLesson,
  onStopLesson,
}: LessonControlsProps) {
  return (
    <section className="panel controls-panel" aria-label="Controles da aula">
      <div className="lesson-control-header">
        <div>
          <span>Aula selecionada</span>
          <strong>{lesson.title}</strong>
        </div>
        <small>{sequence.map((note) => note.label).join(' ')}</small>
      </div>

      <div className="control-row arcade-control-row">
        <label className="field">
          <span>Nota base</span>
          <select
            value={baseNote.midi}
            disabled={isPlaying}
            onChange={(event) => onBaseNoteChange(Number(event.target.value))}
          >
            {baseNotes.map((note) => (
              <option key={note.midi} value={note.midi}>
                {note.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Tolerância</span>
          <div className="range-field">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={tolerance}
              disabled={isPlaying}
              onChange={(event) => onToleranceChange(Number(event.target.value))}
              aria-label="Tolerância em cents"
            />
            <strong>{tolerance}</strong>
          </div>
        </label>
      </div>

      <div className="button-grid arcade-button-grid">
        <button type="button" className="button secondary" onClick={onToggleMic}>
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          {isListening ? 'Parar mic' : 'Iniciar mic'}
        </button>

        <button type="button" className="button secondary" onClick={onPlayCue} disabled={isLocked}>
          <Volume2 size={18} />
          Ouvir guia
        </button>

        <button
          type="button"
          className="button primary"
          disabled={isLocked}
          onClick={isPlaying ? onStopLesson : onStartLesson}
        >
          {isPlaying ? <RotateCcw size={18} /> : <Play size={18} />}
          {isPlaying ? 'Cancelar aula' : 'Começar aula'}
        </button>
      </div>
    </section>
  )
}
