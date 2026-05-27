import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { VOICE_PRESETS } from '../lib/presets'
import Button from './ui/Button'
import styles from './VoiceAssignment.module.css'

export default function VoiceAssignment({ projectId, character, onAssigned, isSelected, onSelect }) {
  const api = useApi()
  const [isOpen, setIsOpen] = useState(false)
  const [currentPreset, setCurrentPreset] = useState(character.preset_key || 'narrator')
  const [previewingId, setPreviewingId] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (currentPreset === character.preset_key) {
      setIsOpen(false)
      return
    }

    setSaving(true)
    try {
      await api.patch(`/voice/characters/${character.id}`, {
        preset_key: currentPreset,
      })
      onAssigned?.()
      setIsOpen(false)
    } catch (err) {
      console.error(err)
      alert('Failed to update character voice')
    } finally {
      setSaving(false)
    }
  }

  const previewVoice = async (presetKey) => {
    setPreviewingId(presetKey)
    try {
      const response = await fetch(`/api/voice/preview/${presetKey}`)
      const audioBlob = await response.blob()
      const audio = new Audio(URL.createObjectURL(audioBlob))
      audio.play()
      audio.onended = () => setPreviewingId(null)
    } catch (err) {
      console.error('Preview failed:', err)
      setPreviewingId(null)
    }
  }

  const currentPresetData = VOICE_PRESETS[currentPreset]

  const handleTriggerClick = (e) => {
    if (e.detail === 2) {
      // Double click opens voice assignment
      setIsOpen(!isOpen)
    } else {
      // Single click selects character
      onSelect?.(character.id)
    }
  }

  return (
    <div className={`${styles.container} ${isSelected ? styles.containerSelected : ''}`}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        title={`Select voice for ${character.name}`}
      >
        <span className={styles.emoji}>{currentPresetData?.emoji}</span>
        <span className={styles.name}>{character.name}</span>
        <span className={styles.preset}>{currentPresetData?.name}</span>
        <ChevronDown size={14} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.voiceList}>
            {Object.entries(VOICE_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                className={`${styles.voiceListItem} ${currentPreset === key ? styles.voiceListItemSelected : ''}`}
                onClick={() => {
                  setCurrentPreset(key)
                  handleSave()
                }}
              >
                <span className={styles.voiceListEmoji}>{preset.emoji}</span>
                <span className={styles.voiceListName}>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
