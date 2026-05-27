// ElevenLabs voice IDs for each preset
// Find voice IDs at: https://api.elevenlabs.io/v1/voices
const VOICE_PRESETS = {
  warrior: {
    name: 'Warrior',
    emoji: '⚔️',
    description: 'Battle-hardened fighter. Deep, commanding voice for combat lines.',
    elevenlabs_voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam
    default_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.6 },
    demo_line: 'For the king! To arms!',
  },
  wizard: {
    name: 'Wizard',
    emoji: '🔮',
    description: 'Ancient and mysterious. Measured cadence for arcane dialogue.',
    elevenlabs_voice_id: 'N2lVS1w4EtoT3dr4eOWO', // Callum
    default_settings: { stability: 0.7, similarity_boost: 0.7, style: 0.4 },
    demo_line: 'The ancient runes speak of doom.',
  },
  villain: {
    name: 'Villain',
    emoji: '💀',
    description: 'Sinister and threatening. Cold delivery for antagonist lines.',
    elevenlabs_voice_id: 'nPczCjzI2devNBz1zQrb', // Brian
    default_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.7 },
    demo_line: 'You have made a grave mistake.',
  },
  narrator: {
    name: 'Narrator',
    emoji: '📜',
    description: 'Clear and authoritative. Perfect for cutscenes and lore.',
    elevenlabs_voice_id: 'onwK4e9ZLuTAKqWW03F9', // Daniel
    default_settings: { stability: 0.8, similarity_boost: 0.75, style: 0.2 },
    demo_line: 'And so begins our tale of adventure and mystery.',
  },
  medic: {
    name: 'Field Medic',
    emoji: '🏥',
    description: 'Calm and reassuring. Warm voice for healing and support lines.',
    elevenlabs_voice_id: 'XrExE9yKIg1WjnnlVkGX', // Matilda
    default_settings: { stability: 0.75, similarity_boost: 0.8, style: 0.3 },
    demo_line: 'Hold still — you\'re going to be alright.',
  },
};

// Emotion modifiers — adjust ElevenLabs settings per emotion
const EMOTION_MODIFIERS = {
  neutral:  { stability: 0,     style: 0 },
  intense:  { stability: -0.2,  style: +0.3 },
  whisper:  { stability: +0.2,  style: -0.2 },
  shout:    { stability: -0.3,  style: +0.4 },
};

// Limits per plan
const PLAN_LIMITS = {
  free:   { generations: 20 },
  pro:    { generations: 500 }, // Legacy: now called "Indie" in UI
  indie:  { generations: 500 },
  studio: { generations: Infinity },
};

module.exports = { VOICE_PRESETS, EMOTION_MODIFIERS, PLAN_LIMITS };
