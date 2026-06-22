import { VocalRangeTool } from '../components/VocalRangeTool'
import { useMicrophonePitch } from '../hooks/useMicrophonePitch'

export function RangePage() {
  const { reading, isListening, error, start } = useMicrophonePitch()

  return (
    <main className="app-shell range-page">
      <nav className="page-nav" aria-label="Main navigation">
        <a href="/">Training course</a>
        <a className="active" href="/range">Vocal range</a>
        <a href="/pitch">Pitch Replay</a>
      </nav>
      <header className="range-page-header">
        <span className="eyebrow">Singing Trainer</span>
        <h1>Teste de perfil vocal</h1>
        <p>
          Faça um teste simples para descobrir sua região de fala, grave confortável, agudo com voz
          cheia, agudo com voz leve e possíveis zonas de transição vocal.
        </p>
        <p className="range-page-note">
          Use em um lugar silencioso, sem forçar a voz. O resultado é uma estimativa acústica feita
          pelo microfone, não um diagnóstico médico. Depois de terminar, use o botão
          &ldquo;Compartilhar resultado&rdquo; para enviar o resumo.
        </p>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="range-page-tool">
        <VocalRangeTool
          reading={reading}
          isListening={isListening}
          disabled={false}
          onStartMicrophone={start}
          onApplyBaseNote={() => {}}
        />
      </div>
    </main>
  )
}
