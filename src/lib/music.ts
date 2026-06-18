export type PitchStatus = 'low' | 'target' | 'high' | 'idle'

export type NoteOption = {
  label: string
  midi: number
  frequency: number
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const NOTE_OPTIONS: NoteOption[] = Array.from({ length: 25 }, (_, index) => {
  const midi = 48 + index

  return {
    label: midiToNoteName(midi) ?? '--',
    midi,
    frequency: midiToFrequency(midi),
  }
})

export function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12)
}

export function frequencyToMidi(frequency: number) {
  return 69 + 12 * Math.log2(frequency / 440)
}

export function frequencyToNoteName(frequency: number | null | undefined) {
  if (frequency == null || !Number.isFinite(frequency) || frequency <= 0) {
    return null
  }

  return midiToNoteName(frequencyToMidi(frequency))
}

export function midiToNoteName(midi: number | null | undefined) {
  if (midi == null || !Number.isFinite(midi)) {
    return null
  }

  const rounded = Math.round(midi)
  const noteIndex = ((rounded % 12) + 12) % 12
  const note = NOTE_NAMES[noteIndex]
  const octave = Math.floor(rounded / 12) - 1

  if (!note) {
    return null
  }

  return `${note}${octave}`
}

export function centsBetween(frequency: number, targetFrequency: number) {
  return 1200 * Math.log2(frequency / targetFrequency)
}

export function centsFromNearestSemitone(frequency: number) {
  const midi = frequencyToMidi(frequency)

  return (midi - Math.round(midi)) * 100
}

export function centsBetweenFrequencyAndMidi(frequency: number, midi: number) {
  return centsBetween(frequency, midiToFrequency(midi))
}

export function getPitchStatus(cents: number | null, tolerance: number): PitchStatus {
  if (cents === null) {
    return 'idle'
  }

  if (Math.abs(cents) <= tolerance) {
    return 'target'
  }

  return cents < 0 ? 'low' : 'high'
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function formatFrequency(frequency: number | null) {
  if (frequency === null) {
    return '--'
  }

  return `${Math.round(frequency)} Hz`
}

export function formatCents(cents: number | null) {
  if (cents === null) {
    return '--'
  }

  const rounded = Math.round(cents)

  return `${rounded > 0 ? '+' : ''}${rounded} cents`
}
