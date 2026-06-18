import { CheckCircle2, Lock, Star } from 'lucide-react'
import {
  COURSE,
  type CourseProgress,
  type CourseStage,
  isLessonUnlocked,
  isPassingGrade,
} from '../lib/course'

type CourseMapProps = {
  selectedLessonId: string
  progress: CourseProgress
  disabled: boolean
  onSelectLesson: (lessonId: string) => void
}

export function CourseMap({ selectedLessonId, progress, disabled, onSelectLesson }: CourseMapProps) {
  return (
    <aside className="course-map" aria-label="Mapa do curso">
      <div className="course-map-heading">
        <span className="eyebrow">{COURSE.title}</span>
        <h2>{COURSE.description}</h2>
      </div>

      <div className="stage-stack">
        {COURSE.stages.map((stage) => (
          <StageBlock
            key={stage.id}
            stage={stage}
            selectedLessonId={selectedLessonId}
            progress={progress}
            disabled={disabled}
            onSelectLesson={onSelectLesson}
          />
        ))}
      </div>
    </aside>
  )
}

type StageBlockProps = {
  stage: CourseStage
  selectedLessonId: string
  progress: CourseProgress
  disabled: boolean
  onSelectLesson: (lessonId: string) => void
}

function StageBlock({
  stage,
  selectedLessonId,
  progress,
  disabled,
  onSelectLesson,
}: StageBlockProps) {
  const completedLessons = stage.lessons.filter((lesson) => {
    if (lesson.ungraded) {
      return Boolean(progress[lesson.id])
    }

    const grade = progress[lesson.id]?.grade

    return grade ? isPassingGrade(grade) : false
  }).length

  return (
    <section className="stage-block">
      <div className="stage-heading">
        <div>
          <strong>{stage.title}</strong>
          <span>{stage.description}</span>
        </div>
        <small>
          {completedLessons}/{stage.lessons.length}
        </small>
      </div>

      <div className="lesson-list">
        {stage.lessons.map((lesson) => {
          const lessonProgress = progress[lesson.id]
          const unlocked = isLessonUnlocked(lesson.id, progress)
          const active = selectedLessonId === lesson.id
          const passed = lessonProgress?.grade ? isPassingGrade(lessonProgress.grade) : false
          const className = [
            'lesson-button',
            active ? 'active' : '',
            passed ? 'passed' : '',
            !unlocked ? 'locked' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <button
              key={lesson.id}
              type="button"
              className={className}
              disabled={disabled || !unlocked}
              onClick={() => onSelectLesson(lesson.id)}
            >
              <span className="lesson-status">
                {!unlocked ? <Lock size={15} /> : passed ? <CheckCircle2 size={15} /> : <Star size={15} />}
              </span>
              <span className="lesson-copy">
                <strong>{lesson.title}</strong>
                <small>{lesson.description}</small>
              </span>
              <span className="lesson-grade">{lesson.ungraded ? 'Bonus' : lessonProgress?.grade ?? '--'}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
