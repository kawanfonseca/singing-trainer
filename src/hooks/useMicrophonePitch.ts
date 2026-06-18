import { useCallback, useEffect, useRef, useState } from 'react'
import { PitchDetector } from 'pitchy'

const INPUT_SIZE = 2048
const CLARITY_THRESHOLD = 0.86
const MIN_FREQUENCY = 70
const MAX_FREQUENCY = 1200

export type PitchReading = {
  frequency: number | null
  clarity: number
  volume: number
  isVoiceDetected: boolean
}

export function useMicrophonePitch() {
  const [reading, setReading] = useState<PitchReading>({
    frequency: null,
    clarity: 0,
    volume: 0,
    isVoiceDetected: false,
  })
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const detectorRef = useRef(PitchDetector.forFloat32Array(INPUT_SIZE))
  const bufferRef = useRef(new Float32Array(INPUT_SIZE))

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    void audioContextRef.current?.close()
    audioContextRef.current = null
    analyserRef.current = null

    setIsListening(false)
    setReading({
      frequency: null,
      clarity: 0,
      volume: 0,
      isVoiceDetected: false,
    })
  }, [])

  const start = useCallback(async () => {
    if (isListening) {
      return
    }

    try {
      setError(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
      const audioContext = new AudioContextConstructor()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)

      analyser.fftSize = INPUT_SIZE
      analyser.smoothingTimeConstant = 0.12
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser
      streamRef.current = stream
      setIsListening(true)

      const update = () => {
        const activeAnalyser = analyserRef.current
        const activeAudioContext = audioContextRef.current

        if (!activeAnalyser || !activeAudioContext) {
          return
        }

        const buffer = bufferRef.current
        activeAnalyser.getFloatTimeDomainData(buffer)

        const [frequency, clarity] = detectorRef.current.findPitch(buffer, activeAudioContext.sampleRate)
        const volume = getRms(buffer)
        const isFrequencyValid = frequency >= MIN_FREQUENCY && frequency <= MAX_FREQUENCY
        const isVoiceDetected = clarity >= CLARITY_THRESHOLD && volume >= 0.01 && isFrequencyValid

        setReading({
          frequency: isVoiceDetected ? smoothFrequency(frequency) : null,
          clarity,
          volume,
          isVoiceDetected,
        })

        frameRef.current = requestAnimationFrame(update)
      }

      frameRef.current = requestAnimationFrame(update)
    } catch {
      setError('Não foi possível acessar o microfone.')
      stop()
    }
  }, [isListening, stop])

  useEffect(() => stop, [stop])

  return {
    reading,
    isListening,
    error,
    start,
    stop,
  }
}

function getRms(buffer: Float32Array) {
  let sum = 0

  for (const value of buffer) {
    sum += value * value
  }

  return Math.sqrt(sum / buffer.length)
}

function smoothFrequency(frequency: number) {
  return Math.round(frequency * 10) / 10
}
