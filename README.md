# Singing Trainer

MVP de curso vocal gamificado com feedback de afinação em tempo real no navegador.

## Funcionalidades

- Captura de microfone com Web Audio API.
- Detecção de pitch com `pitchy`.
- Reprodução de nota alvo com `tone`.
- Medidor de desvio em cents.
- World One com warmup, terças maiores, terças menores, quartas, quintas e bônus pentatônico.
- Aulas com guia nota a nota, harmonia, teste por harmonia e teste por raiz.
- Bloqueio de progressão por grade B ou melhor.
- Sequência automática de notas com feedback por bloco.
- Score, combo, energia, estrelas, grade A-F e diagnóstico final.
- Histórico das últimas 10 aulas em `localStorage`.
- Progresso do curso salvo localmente.
- Diagnóstico vocal em modal com voz falada, grave confortável, quebra vocal, agudo denso e agudo leve.
- Resultado com oitavas, classificação aproximada, zona provável de quebra e nota base sugerida.
- Relatório detalhado com range absoluto, sustentado, usável, tessitura confortável, eventos de quebra, zonas prováveis e qualidade por nota.
- Labels de transição e registro são apresentados como estimativas acústicas, não diagnóstico fisiológico.

## Comandos

```bash
npm install
npm run dev
npm run build
npm run lint
```

O servidor de desenvolvimento usa Vite. A URL padrão é:

```text
http://127.0.0.1:5173
```

## Estrutura

```text
src/
  components/
    CourseMap.tsx
    LessonControls.tsx
    LessonStage.tsx
    VocalRangeTool.tsx
  hooks/
    useMicrophonePitch.ts
  lib/
    course.ts
    music.ts
    scoring.ts
    vocalRange.ts
  App.tsx
  App.css
```

## Observações

O navegador precisa de permissão de microfone. A qualidade da detecção depende de volume estável, baixo ruído ambiente e uso de fones para evitar vazamento da nota de referência no microfone.
