import { Flame, History, Star, Trophy } from 'lucide-react'
import type { SessionAttempt } from '../lib/scoring'

type SessionHistoryProps = {
  attempts: SessionAttempt[]
  latestScore: number | null
}

export function SessionHistory({ attempts, latestScore }: SessionHistoryProps) {
  return (
    <aside className="panel history-panel" aria-label="Histórico de treino">
      <div className="panel-heading">
        <div>
          <span>Progresso</span>
          <h2>Últimas aulas</h2>
        </div>
        <History size={20} aria-hidden="true" />
      </div>

      <div className="score-card">
        <Trophy size={22} aria-hidden="true" />
        <div>
          <span>Score atual</span>
          <strong>{latestScore ?? '--'}</strong>
        </div>
      </div>

      {attempts.length === 0 ? (
        <p className="empty-state">Complete uma aula para registrar score, grade e combo.</p>
      ) : (
        <ol className="history-list">
          {attempts.map((attempt) => (
            <li key={attempt.id}>
              <div>
                <strong>{attempt.mode ?? 'Treino'}</strong>
                <span>{attempt.note}</span>
                <small>{formatDate(attempt.createdAt)}</small>
              </div>
              <div>
                <strong>{attempt.score}</strong>
                <span>{attempt.grade ? `Grade ${attempt.grade}` : `${attempt.inTunePercent}% no alvo`}</span>
                <small className="history-badges">
                  <Star size={13} aria-hidden="true" />
                  {attempt.stars ?? 0}
                  <Flame size={13} aria-hidden="true" />
                  {attempt.bestCombo ?? 0}x
                </small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
