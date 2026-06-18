import { Flame, HeartPulse, Music2, Star, Trophy } from 'lucide-react'
import { getCueLabel, type CourseLesson, type CourseStage, type LessonGrade } from '../lib/course'
import type { ArcadeStats, GameNote, SegmentResult } from '../lib/game'
import { getStars } from '../lib/game'
import { type PitchStatus } from '../lib/music'

type LessonStageProps = {
  stage: CourseStage
  lesson: CourseLesson
  sequence: GameNote[]
  activeIndex: number
  progress: number
  noteProgress: number
  stats: ArcadeStats
  segmentResults: SegmentResult[]
  status: PitchStatus
  isPlaying: boolean
  isLocked: boolean
  grade: LessonGrade | null
  diagnosis: string | null
}

const STATUS_LABELS: Record<PitchStatus, string> = {
  idle: 'Aguardando',
  low: 'Suba',
  target: 'Acertou',
  high: 'Desça',
}

export function LessonStage({
  stage,
  lesson,
  sequence,
  activeIndex,
  progress,
  noteProgress,
  stats,
  segmentResults,
  status,
  isPlaying,
  isLocked,
  grade,
  diagnosis,
}: LessonStageProps) {
  const activeNote = sequence[activeIndex] ?? sequence[0]
  const stars = getStars(stats.score)

  return (
    <section className="arcade-stage lesson-stage" aria-label="Aula">
      <div className="arcade-topline">
        <div>
          <span className="eyebrow">{stage.title}</span>
          <h2>{lesson.title}</h2>
          <p>{lesson.description}</p>
        </div>
        <div className="lesson-result">
          <div className="star-row" aria-label={`${stars} estrelas`}>
            {[0, 1, 2].map((star) => (
              <Star key={star} size={22} className={star < stars ? 'filled' : ''} aria-hidden="true" />
            ))}
          </div>
          <strong>{lesson.ungraded ? 'Bonus' : grade ?? '--'}</strong>
        </div>
      </div>

      <div className="lesson-meta-row">
        <span>{getCueLabel(lesson.cueMode)}</span>
        <span>{lesson.ungraded ? 'Sem trava de progresso' : 'B ou melhor libera a próxima aula'}</span>
        {isLocked ? <span>Bloqueada</span> : null}
      </div>

      <div className="game-hud">
        <HudItem icon={<Trophy size={18} />} label="Score" value={stats.score.toString()} />
        <HudItem icon={<Flame size={18} />} label="Combo" value={`${stats.combo}x`} />
        <HudItem icon={<HeartPulse size={18} />} label="Energia" value={`${Math.round(stats.energy)}%`} />
        <HudItem icon={<Music2 size={18} />} label="Nota" value={activeNote.label} />
      </div>

      <div className="note-runner">
        <div className="runner-progress" style={{ width: `${Math.round(progress * 100)}%` }} />
        <div
          className="note-lane"
          style={{ '--note-count': sequence.length } as React.CSSProperties}
        >
          {sequence.map((note, index) => (
            <div
              key={note.id}
              className={`note-tile ${segmentResults[index]} ${index === activeIndex ? 'current' : ''}`}
            >
              <span>{index + 1}</span>
              <strong>{note.label}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className={`arcade-target ${status}`}>
        <div>
          <span>Nota atual</span>
          <strong>{activeNote.label}</strong>
        </div>
        <div className="target-response">{isPlaying ? STATUS_LABELS[status] : isLocked ? 'Bloqueada' : 'Pronto'}</div>
      </div>

      <div className="note-timer" aria-label="Progresso da nota atual">
        <span style={{ width: `${Math.round(noteProgress * 100)}%` }} />
      </div>

      {diagnosis ? <p className="diagnosis">{diagnosis}</p> : null}
    </section>
  )
}

type HudItemProps = {
  icon: React.ReactNode
  label: string
  value: string
}

function HudItem({ icon, label, value }: HudItemProps) {
  return (
    <div className="hud-item">
      <div className="hud-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}
