import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useChat } from '@/lib/ws'

interface DonationAlert {
  id: string
  donatorName: string
  amount: number
  donateMessage: string | null
  ttsAudio?: string | null
  phase: 'in' | 'hold' | 'out'
}

// Split template into segments coloring {name}, {amount}, {message} individually
function renderTemplate(
  tpl: string,
  name: string,
  amount: number,
  msg: string | null,
  nameColor: string,
  amountColor: string,
  msgColor: string,
  defaultColor: string,
): React.ReactNode[] {
  // tokenise by placeholders
  const parts = tpl.split(/(\{name\}|\{amount\}|\{message\})/gi)
  return parts.map((part, i) => {
    const low = part.toLowerCase()
    if (low === '{name}') return <span key={i} style={{ color: nameColor }}>{name}</span>
    if (low === '{amount}') return <span key={i} style={{ color: amountColor }}>฿{amount.toLocaleString('th-TH')}</span>
    if (low === '{message}') return <span key={i} style={{ color: msgColor }}>{msg ?? ''}</span>
    return <span key={i} style={{ color: defaultColor }}>{part}</span>
  })
}

export default function DonationOverlay() {
  const [searchParams] = useSearchParams()
  const token        = searchParams.get('token') ?? undefined
  const nameColor    = searchParams.get('nameColor')   ?? '#FFD700'
  const amountColor  = searchParams.get('amountColor') ?? '#4ADE80'
  const msgColor     = searchParams.get('msgColor')    ?? '#FFFFFF'
  const defaultColor = searchParams.get('textColor')   ?? '#FFFFFF'
  const template     = searchParams.get('template')    ?? '{name} donated ฿{amount}!'
  const fadeIn       = parseFloat(searchParams.get('fadeIn')    ?? '0.5')
  const fadeOut      = parseFloat(searchParams.get('fadeOut')   ?? '0.5')
  const holdTime     = parseFloat(searchParams.get('holdTime')  ?? '5')
  const imageUrl     = searchParams.get('imageUrl') ?? ''
  const soundUrl     = searchParams.get('soundUrl') ?? ''
  const ttsEnabled   = searchParams.get('tts') === '1'
  const ttsVoice     = searchParams.get('ttsVoice') ?? 'Zephyr'

  const { messages } = useChat(token)
  const queueRef     = useRef<DonationAlert[]>([])
  const busyRef      = useRef(false)
  const processedRef = useRef(new Set<string>())
  const audioRef     = useRef<HTMLAudioElement | null>(null)

  const [current, setCurrent] = useState<DonationAlert | null>(null)

  // transparent OBS bg
  useEffect(() => {
    document.body.classList.add('overlay-mode')
    return () => document.body.classList.remove('overlay-mode')
  }, [])

  const showNext = useCallback(() => {
    const next = queueRef.current.shift()
    if (!next) {
      busyRef.current = false
      setCurrent(null)
      return
    }
    busyRef.current = true

    // fade in (mount at opacity 0)
    setCurrent({ ...next, phase: 'in' })

    let audioFinished = false

    const triggerFadeOut = () => {
      setCurrent((prev) => prev ? { ...prev, phase: 'out' } : prev)
      setTimeout(() => {
        showNext()
      }, fadeOut * 1000)
    }

    const startHoldTimer = () => {
      // Start the hold timer ONLY after audio has completely finished
      setTimeout(() => {
        triggerFadeOut()
      }, holdTime * 1000)
    }

    // Helper to play TTS
    const hasTts = ttsEnabled && !!next.ttsAudio
    const hasSound = !!soundUrl

    const playTts = () => {
      if (hasTts) {
        audioRef.current = new Audio(next.ttsAudio!)
        audioRef.current.onended = () => {
          if (!audioFinished) {
            audioFinished = true
            startHoldTimer()
          }
        }
        audioRef.current.onerror = () => {
          if (!audioFinished) {
            audioFinished = true
            startHoldTimer()
          }
        }
        audioRef.current.play().catch((err) => {
          console.warn('Failed to play TTS:', err)
          if (!audioFinished) {
            audioFinished = true
            startHoldTimer()
          }
        })
      } else {
        if (!audioFinished) {
          audioFinished = true
          startHoldTimer()
        }
      }
    }

    // Handle Audio
    if (!hasTts && !hasSound) {
      audioFinished = true
      startHoldTimer()
    } else {
      if (hasSound) {
        const alertAudio = new Audio(soundUrl)
        alertAudio.onended = playTts
        alertAudio.onerror = playTts // fallback to TTS if alert fails
        alertAudio.play().catch((err) => {
          console.warn('Failed to play alert sound:', err)
          playTts()
        })
      } else {
        playTts()
      }
    }

    // next frame: trigger CSS transition to opacity 1
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setCurrent((prev) => prev ? { ...prev, phase: 'hold' } : prev)
      })
    })
  }, [fadeIn, holdTime, fadeOut, ttsEnabled, soundUrl])

  // enqueue new donation messages
  useEffect(() => {
    const donations = messages.filter(
      (m) => m.type === 'donation' && !processedRef.current.has(m.id)
    ) as Array<{
      id: string; type: 'donation'; donatorName: string; amount: number
      donateMessage: string | null;
    }>

    if (donations.length === 0) return

    donations.forEach((d) => {
      processedRef.current.add(d.id)

      const enqueue = (audioUrl?: string) => {
        queueRef.current.push({
          id: d.id,
          donatorName: d.donatorName,
          amount: d.amount,
          donateMessage: d.donateMessage,
          ttsAudio: audioUrl,
          phase: 'in',
        })
        if (!busyRef.current) showNext()
      }

      if (ttsEnabled) {
        // Pre-fetch TTS using the visual template
        const ttsBase = template
          .replace(/\{name\}/gi, d.donatorName)
          .replace(/\{amount\}/gi, d.amount.toString())
          .replace(/\{message\}/gi, '')
          .replace(/฿/gi, 'บาท') // Replace thai baht symbol for better TTS reading
        
        const messageParts = [ttsBase.trim()]
        if (d.donateMessage && !template.toLowerCase().includes('{message}')) {
          messageParts.push(d.donateMessage)
        }
        
        const ttsText = messageParts.join(" ")

        const apiUrl = import.meta.env.VITE_API_ORIGIN || window.location.origin
        fetch(`${apiUrl}/api/tts?text=${encodeURIComponent(ttsText)}&voice=${encodeURIComponent(ttsVoice)}`)
          .then(res => res.json())
          .then(data => {
            enqueue(data.audio)
          })
          .catch(err => {
            console.error('[DonationOverlay] Failed to fetch TTS:', err)
            enqueue()
          })
      } else {
        enqueue()
      }
    })
  }, [messages, showNext, ttsEnabled, ttsVoice, template])

  if (!current) return null

  const opacity  = current.phase === 'hold' ? 1 : 0
  const scale    = current.phase === 'hold' ? 1 : 0.85
  const duration = current.phase === 'hold' ? fadeIn : current.phase === 'out' ? fadeOut : 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          transition: duration > 0
            ? `opacity ${duration}s ease, transform ${duration}s ease`
            : 'none',
          width: '95vw',
          padding: '2vw',
          textAlign: 'center',
          textShadow: '0 0.3vw 1vw rgba(0,0,0,0.8), 0 0 0.3vw rgba(0,0,0,1)',
        }}
      >
        {/* Donation icon or custom GIF */}
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt="Donation Alert" 
            style={{ 
              height: '15vw', 
              margin: '0 auto 2vw', 
              display: 'block',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0.5vw 1.5vw rgba(0,0,0,0.5))' 
            }} 
          />
        ) : (
          <div style={{ fontSize: '10vw', marginBottom: '2vw', lineHeight: 1, filter: 'drop-shadow(0 0.5vw 1.5vw rgba(0,0,0,0.5))' }}>💰</div>
        )}

        {/* Template text */}
        <p
          style={{
            fontSize: '5vw',
            fontWeight: 800,
            lineHeight: 1.2,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          {renderTemplate(template, current.donatorName, current.amount, current.donateMessage, nameColor, amountColor, msgColor, defaultColor)}
        </p>

        {/* Donation message (if separate from template) */}
        {current.donateMessage && !template.toLowerCase().includes('{message}') && (
          <p
            style={{
              marginTop: '1.5vw',
              fontSize: '3.5vw',
              color: msgColor,
              opacity: 0.9,
              fontStyle: 'italic',
              lineHeight: 1.4,
            }}
          >
            "{current.donateMessage}"
          </p>
        )}
      </div>
    </div>
  )
}
