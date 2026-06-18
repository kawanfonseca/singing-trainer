export type LessonCueMode = 'guide' | 'chord-guide' | 'chord-only' | 'root-only'

export type LessonGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export type CourseLesson = {
  id: string
  title: string
  description: string
  steps: number[]
  cueMode: LessonCueMode
  durationMs: number
  ungraded?: boolean
}

export type CourseStage = {
  id: string
  title: string
  description: string
  minimumGrade?: LessonGrade
  bonus?: boolean
  lessons: CourseLesson[]
}

export type CourseWorld = {
  id: string
  title: string
  description: string
  stages: CourseStage[]
}

export type LessonProgress = {
  bestScore: number
  grade: LessonGrade
  stars: number
  bestCombo: number
  completedAt: string
}

export type CourseProgress = Record<string, LessonProgress>

export const COURSE_PROGRESS_STORAGE_KEY = 'singing-trainer-course-progress'

export const COURSE: CourseWorld = {
  id: 'world-one',
  title: 'World One',
  description: 'Intervalos simples, padrões curtos e melodias guiadas.',
  stages: [
    {
      id: 'warmup',
      title: 'Warmup Stage',
      description: 'Entrando no centro da nota com exercícios curtos.',
      lessons: [
        {
          id: 'single-tones',
          title: 'Single Tones',
          description: 'Notas isoladas dentro da sua região confortável.',
          steps: [0, 2, 4, 5, 7],
          cueMode: 'guide',
          durationMs: 1350,
        },
        {
          id: 'first-five-notes',
          title: 'First Five Notes',
          description: 'Do-re-mi-fa-sol-fa-mi-re-do.',
          steps: [0, 2, 4, 5, 7, 5, 4, 2, 0],
          cueMode: 'guide',
          durationMs: 1050,
        },
        {
          id: 'major-arpeggio',
          title: 'Major Arpeggio',
          description: 'Tônica, terça, quinta e oitava em movimento.',
          steps: [0, 4, 7, 12, 7, 4, 0],
          cueMode: 'guide',
          durationMs: 1200,
        },
      ],
    },
    {
      id: 'major-thirds',
      title: 'Stage 1',
      description: 'Terças maiores. Tire B ou melhor para avançar.',
      minimumGrade: 'B',
      lessons: [
        {
          id: 'major-third',
          title: 'Major Third',
          description: 'Cante a terça maior a partir da raiz.',
          steps: [0, 4],
          cueMode: 'guide',
          durationMs: 1500,
        },
        {
          id: 'major-third-back',
          title: 'Major Third and Back',
          description: 'Suba uma terça maior e volte para a raiz.',
          steps: [0, 4, 0],
          cueMode: 'guide',
          durationMs: 1350,
        },
        {
          id: 'major-third-harmony',
          title: 'Major Third Harmony',
          description: 'Ouça a harmonia e cante as duas notas.',
          steps: [0, 4],
          cueMode: 'chord-guide',
          durationMs: 1500,
        },
        {
          id: 'major-third-harmony-test',
          title: 'Major Third Harmony Test',
          description: 'Ouça a harmonia sem guia individual.',
          steps: [0, 4],
          cueMode: 'chord-only',
          durationMs: 1550,
        },
        {
          id: 'major-third-root-test',
          title: 'Major Third Root Test',
          description: 'Ouça só a raiz e cante o intervalo completo.',
          steps: [0, 4],
          cueMode: 'root-only',
          durationMs: 1550,
        },
      ],
    },
    {
      id: 'minor-thirds',
      title: 'Stage 2',
      description: 'Terças menores e contraste entre maior e menor.',
      minimumGrade: 'B',
      lessons: [
        {
          id: 'minor-third',
          title: 'Minor Third',
          description: 'Cante a terça menor a partir da raiz.',
          steps: [0, 3],
          cueMode: 'guide',
          durationMs: 1500,
        },
        {
          id: 'minor-third-back',
          title: 'Minor Third and Back',
          description: 'Suba uma terça menor e volte para a raiz.',
          steps: [0, 3, 0],
          cueMode: 'guide',
          durationMs: 1350,
        },
        {
          id: 'minor-third-harmony',
          title: 'Minor Third Harmony',
          description: 'Ouça a harmonia menor e cante as duas notas.',
          steps: [0, 3],
          cueMode: 'chord-guide',
          durationMs: 1500,
        },
        {
          id: 'minor-third-harmony-test',
          title: 'Minor Third Harmony Test',
          description: 'Ouça a harmonia menor sem guia individual.',
          steps: [0, 3],
          cueMode: 'chord-only',
          durationMs: 1550,
        },
        {
          id: 'minor-third-root-test',
          title: 'Minor Third Root Test',
          description: 'Ouça só a raiz e cante a terça menor.',
          steps: [0, 3],
          cueMode: 'root-only',
          durationMs: 1550,
        },
        {
          id: 'major-to-minor',
          title: 'Major to Minor',
          description: 'Alterne entre terça maior e terça menor.',
          steps: [0, 4, 0, 3],
          cueMode: 'guide',
          durationMs: 1250,
        },
        {
          id: 'major-minor-harmony-test',
          title: 'Major and Minor Harmony Test',
          description: 'Use a harmonia para diferenciar os dois intervalos.',
          steps: [0, 4, 0, 3],
          cueMode: 'chord-only',
          durationMs: 1300,
        },
        {
          id: 'major-minor-root-test',
          title: 'Major and Minor Root Test',
          description: 'Ouça a raiz e cante maior, depois menor.',
          steps: [0, 4, 0, 3],
          cueMode: 'root-only',
          durationMs: 1300,
        },
      ],
    },
    {
      id: 'perfect-fourths',
      title: 'Stage 3',
      description: 'Quartas justas com guia, harmonia e teste de raiz.',
      minimumGrade: 'B',
      lessons: [
        {
          id: 'perfect-fourth',
          title: 'Perfect Fourth',
          description: 'Cante uma quarta justa a partir da raiz.',
          steps: [0, 5],
          cueMode: 'guide',
          durationMs: 1500,
        },
        {
          id: 'perfect-fourth-back',
          title: 'Perfect Fourth and Back',
          description: 'Suba uma quarta justa e volte para a raiz.',
          steps: [0, 5, 0],
          cueMode: 'guide',
          durationMs: 1350,
        },
        {
          id: 'perfect-fourth-harmony',
          title: 'Perfect Fourth Harmony',
          description: 'Ouça a quarta justa como harmonia.',
          steps: [0, 5],
          cueMode: 'chord-guide',
          durationMs: 1500,
        },
        {
          id: 'perfect-fourth-harmony-test',
          title: 'Perfect Fourth Harmony Test',
          description: 'Cante a quarta justa ouvindo só a harmonia.',
          steps: [0, 5],
          cueMode: 'chord-only',
          durationMs: 1550,
        },
        {
          id: 'perfect-fourth-root-test',
          title: 'Perfect Fourth Root Test',
          description: 'Ouça a raiz e cante as duas notas.',
          steps: [0, 5],
          cueMode: 'root-only',
          durationMs: 1550,
        },
      ],
    },
    {
      id: 'perfect-fifths',
      title: 'Stage 4',
      description: 'Quintas justas com variações de escuta.',
      minimumGrade: 'B',
      lessons: [
        {
          id: 'perfect-fifth',
          title: 'Perfect Fifth',
          description: 'Cante uma quinta justa a partir da raiz.',
          steps: [0, 7],
          cueMode: 'guide',
          durationMs: 1500,
        },
        {
          id: 'perfect-fifth-back',
          title: 'Perfect Fifth and Back',
          description: 'Suba uma quinta justa e volte para a raiz.',
          steps: [0, 7, 0],
          cueMode: 'guide',
          durationMs: 1350,
        },
        {
          id: 'perfect-fifth-harmony',
          title: 'Perfect Fifth Harmony',
          description: 'Ouça a quinta justa como harmonia.',
          steps: [0, 7],
          cueMode: 'chord-guide',
          durationMs: 1500,
        },
        {
          id: 'perfect-fifth-harmony-test',
          title: 'Perfect Fifth Harmony Test',
          description: 'Cante a quinta justa ouvindo só a harmonia.',
          steps: [0, 7],
          cueMode: 'chord-only',
          durationMs: 1550,
        },
        {
          id: 'perfect-fifth-root-test',
          title: 'Perfect Fifth Root Test',
          description: 'Ouça a raiz e cante as duas notas.',
          steps: [0, 7],
          cueMode: 'root-only',
          durationMs: 1550,
        },
      ],
    },
    {
      id: 'pentatonics',
      title: 'Bonus: Pentatonics',
      description: 'Escalas e riffs pentatônicos sem trava de progressão.',
      bonus: true,
      lessons: [
        {
          id: 'pentatonic-scale',
          title: 'Pentatonic Scale',
          description: 'Aprenda a forma principal da pentatônica.',
          steps: [0, 2, 4, 7, 9, 7, 4, 2, 0],
          cueMode: 'guide',
          durationMs: 1000,
          ungraded: true,
        },
        {
          id: 'pentatonic-intervals',
          title: 'Pentatonic Intervals',
          description: 'Pule entre notas da pentatônica sem perder o centro.',
          steps: [0, 2, 0, 4, 0, 7, 0, 9],
          cueMode: 'guide',
          durationMs: 1050,
          ungraded: true,
        },
        {
          id: 'pentatonic-lick-one',
          title: 'Pentatonic Lick 1',
          description: 'Padrão ascendente curto para ganhar agilidade.',
          steps: [0, 2, 4, 7, 2, 4, 7, 9],
          cueMode: 'guide',
          durationMs: 950,
          ungraded: true,
        },
      ],
    },
  ],
}

export function flattenLessons(course = COURSE) {
  return course.stages.flatMap((stage) =>
    stage.lessons.map((lesson) => ({
      stage,
      lesson,
    })),
  )
}

export function getLessonById(lessonId: string) {
  return flattenLessons().find((item) => item.lesson.id === lessonId) ?? flattenLessons()[0]
}

export function readCourseProgress(): CourseProgress {
  try {
    const saved = localStorage.getItem(COURSE_PROGRESS_STORAGE_KEY)

    if (!saved) {
      return {}
    }

    const parsed = JSON.parse(saved)

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return parsed
  } catch {
    return {}
  }
}

export function saveLessonProgress(
  progress: CourseProgress,
  lessonId: string,
  result: LessonProgress,
) {
  const current = progress[lessonId]
  const nextProgress = {
    ...progress,
    [lessonId]:
      current && current.bestScore > result.bestScore
        ? current
        : result,
  }

  localStorage.setItem(COURSE_PROGRESS_STORAGE_KEY, JSON.stringify(nextProgress))

  return nextProgress
}

export function getGrade(score: number): LessonGrade {
  if (score >= 90) {
    return 'A'
  }

  if (score >= 78) {
    return 'B'
  }

  if (score >= 62) {
    return 'C'
  }

  if (score >= 45) {
    return 'D'
  }

  return 'F'
}

export function isPassingGrade(grade: LessonGrade) {
  return grade === 'A' || grade === 'B'
}

export function isLessonUnlocked(lessonId: string, progress: CourseProgress) {
  const lessons = flattenLessons()
  const targetIndex = lessons.findIndex((item) => item.lesson.id === lessonId)

  if (targetIndex <= 0) {
    return true
  }

  const target = lessons[targetIndex]

  if (target.stage.bonus) {
    return lessons
      .slice(0, targetIndex)
      .filter((item) => !item.stage.bonus && !item.lesson.ungraded)
      .every((item) => {
        const grade = progress[item.lesson.id]?.grade

        return grade ? isPassingGrade(grade) : false
      })
  }

  return lessons
    .slice(0, targetIndex)
    .filter((item) => !item.lesson.ungraded)
    .every((item) => {
      const grade = progress[item.lesson.id]?.grade

      return grade ? isPassingGrade(grade) : false
    })
}

export function getCueLabel(cueMode: LessonCueMode) {
  if (cueMode === 'chord-guide') {
    return 'Harmonia + guia'
  }

  if (cueMode === 'chord-only') {
    return 'Só harmonia'
  }

  if (cueMode === 'root-only') {
    return 'Só raiz'
  }

  return 'Guia nota a nota'
}
