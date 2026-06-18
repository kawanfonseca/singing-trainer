import { Activity, Gauge, Music2, RadioTower } from 'lucide-react'
import { clamp, formatCents, formatFrequency, type PitchStatus } from '../lib/music'

type PitchMeterProps = {
  targetNote: string
  targetFrequency: number
  detectedNote: string | null
  frequency: number | null
  cents: number | null
  clarity: number
  volume: number
  status: PitchStatus
  tolerance: number
  isListening: boolean
}

const STATUS_LABELS: Record<PitchStatus, string> = {
  idle: 'Aguardando voz',
  low: 'Baixo',
  target: 'No alvo',
  high: 'Alto',
}

export function PitchMeter({
  targetNote,
  targetFrequency,
  detectedNote,
  frequency,
  cents,
  clarity,
  volume,
  status,
  tolerance,
  isListening,
}: PitchMeterProps) {
  const markerPosition = cents === null ? 50 : clamp(((cents + 100) / 200) * 100, 0, 100)
  const targetWidth = clamp((tolerance / 100) * 100, 6, 50)
  const statusClass = `status-pill ${status}`

  return (
    <section className="pitch-stage" aria-label="Medidor de afinação">
      <div className="target-strip">
        <div>
          <span>Alvo</span>
          <strong>{targetNote}</strong>
        </div>
        <div>
          <span>Frequência</span>
          <strong>{Math.round(targetFrequency)} Hz</strong>
        </div>
      </div>

      <div className="meter-shell">
        <div className="meter-scale" aria-hidden="true">
          <span>-100</span>
          <span>0</span>
          <span>+100</span>
        </div>
        <div className="meter-track">
          <div className="target-zone" style={{ width: `${targetWidth}%` }} />
          <div className={`pitch-marker ${status}`} style={{ left: `${markerPosition}%` }} />
        </div>
        <div className="meter-caption">
          <span>mais grave</span>
          <span>mais agudo</span>
        </div>
      </div>

      <div className={statusClass}>{STATUS_LABELS[status]}</div>

      <div className="stat-grid">
        <Stat icon={<Music2 size={18} />} label="Nota detectada" value={detectedNote ?? '--'} />
        <Stat icon={<Gauge size={18} />} label="Desvio" value={formatCents(cents)} />
        <Stat icon={<RadioTower size={18} />} label="Voz" value={formatFrequency(frequency)} />
        <Stat
          icon={<Activity size={18} />}
          label="Clareza"
          value={isListening ? `${Math.round(clarity * 100)}%` : '--'}
          helper={isListening ? `${Math.round(volume * 1000) / 10}% volume` : undefined}
        />
      </div>
    </section>
  )
}

type StatProps = {
  icon: React.ReactNode
  label: string
  value: string
  helper?: string
}

function Stat({ icon, label, value, helper }: StatProps) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <small>{helper}</small> : null}
      </div>
    </div>
  )
}
