import { useAuth0 } from '@auth0/auth0-react'
import { useNavigate } from 'react-router-dom'
import { Hammer, Zap, Package, Layers, ChevronRight, Play } from 'lucide-react'
import styles from './Landing.module.css'

const DEMO_PRESETS = [
  { key: 'warrior', emoji: '⚔️', name: 'Warrior',    color: '#c84040', line: '"For the king! To arms!"' },
  { key: 'wizard',  emoji: '🔮', name: 'Wizard',     color: '#7c5cbf', line: '"The ancient runes speak of doom."' },
  { key: 'medic',   emoji: '🏥', name: 'Field Medic',color: '#40a88c', line: '"Hold still — you\'re going to be alright."' },
]

const FEATURES = [
  { icon: Zap,     title: 'Instant voice generation',     desc: 'Type a line, pick a character, get audio in seconds via ElevenLabs AI.' },
  { icon: Layers,  title: 'Scene-based project dashboard', desc: 'Organise every voice line by project, scene, and character. Like a proper script.' },
  { icon: Package, title: 'Export ready for Unity',        desc: 'Download named WAV files with a manifest.json — drop straight into Assets.' },
]

const PRICING = [
  { name: 'Free',   price: '$0',  gens: '20 generations/mo',  features: ['5 voice presets', 'Single project', 'WAV export'], cta: 'Start free',   highlight: false },
  { name: 'Indie',  price: '$19', gens: '500 generations/mo', features: ['5 voice presets', 'Unlimited projects', 'ZIP + manifest export', 'Priority generation'], cta: 'Get Indie', highlight: true },
  { name: 'Studio', price: '$49', gens: 'Unlimited',          features: ['5 voice presets', 'Unlimited projects', 'ZIP + manifest export', 'Priority generation', 'Early access to new features'], cta: 'Get Studio', highlight: false },
]

export default function Landing() {
  const { loginWithRedirect, isAuthenticated } = useAuth0()
  const navigate = useNavigate()

  const handleCTA = () => {
    if (isAuthenticated) navigate('/dashboard')
    else loginWithRedirect()
  }

  const handlePreviewVoice = async (presetKey) => {
    try {
      const response = await fetch(`/api/voice/preview/${presetKey}`)
      if (!response.ok) throw new Error('Failed to load preview')

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audio.play()
    } catch (error) {
      console.error('Preview error:', error)
      alert('Could not play preview. Please try again.')
    }
  }

  return (
    <div className={styles.page}>

      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <Hammer size={18} color="var(--accent2)" />
            <span className={styles.brandName}>VoiceSmith</span>
          </div>
          <div className={styles.navRight}>
            <a href="#pricing" className={styles.navLink}>Pricing</a>
            <button className={styles.navCta} onClick={handleCTA}>
              {isAuthenticated ? 'Go to dashboard' : 'Start free'} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroTag}>Built for indie game devs</div>
        <h1 className={styles.heroTitle}>
          AI voice lines.<br />
          <span className={styles.heroAccent}>Ship your game faster.</span>
        </h1>
        <p className={styles.heroSub}>
          Generate character voice lines in seconds. Organise by scene. Export directly to Unity.
          No voice actors. No recording sessions. No waiting.
        </p>
        <div className={styles.heroCtas}>
          <button className={styles.ctaPrimary} onClick={handleCTA}>
            Start free — 20 lines/month
          </button>
          <a href="#demo" className={styles.ctaSecondary}>
            <Play size={14} /> Hear the voices
          </a>
        </div>
        <p className={styles.heroNote}>No credit card required</p>
      </section>

      {/* Demo presets */}
      <section className={styles.demo} id="demo">
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Five character voices, ready to use</h2>
          <p className={styles.sectionSub}>Each preset is tuned for game dialogue — not podcasts, not customer service.</p>
          <div className={styles.presetGrid}>
            {DEMO_PRESETS.map(p => (
              <div key={p.key} className={styles.presetCard} style={{ '--c': p.color }}>
                <div className={styles.presetTop}>
                  <span className={styles.presetEmoji}>{p.emoji}</span>
                  <span className={styles.presetName} style={{ color: p.color }}>{p.name}</span>
                </div>
                <p className={styles.presetLine}>{p.line}</p>
                <button className={styles.presetPlay} onClick={() => handlePreviewVoice(p.key)}>
                  <Play size={12} /> Preview voice
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Everything a game dev needs</h2>
          <div className={styles.featureGrid}>
            {FEATURES.map(f => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}><f.icon size={20} color="var(--accent2)" /></div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className={styles.pricing} id="pricing">
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle}>Simple pricing</h2>
          <p className={styles.sectionSub}>Start free. Upgrade when your game grows.</p>
          <div className={styles.pricingGrid}>
            {PRICING.map(p => (
              <div key={p.name} className={`${styles.pricingCard} ${p.highlight ? styles.pricingHighlight : ''}`}>
                {p.highlight && <div className={styles.popularBadge}>Most popular</div>}
                <div className={styles.pricingName}>{p.name}</div>
                <div className={styles.pricingPrice}>{p.price}<span>/mo</span></div>
                <div className={styles.pricingGens}>{p.gens}</div>
                <ul className={styles.pricingFeatures}>
                  {p.features.map(f => <li key={f}>{f}</li>)}
                </ul>
                <button
                  className={`${styles.pricingCta} ${p.highlight ? styles.pricingCtaHighlight : ''}`}
                  onClick={handleCTA}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Hammer size={14} color="var(--accent)" />
            <span>VoiceSmith</span>
          </div>
          <p className={styles.footerNote}>Built for indie game developers. Powered by ElevenLabs AI.</p>
        </div>
      </footer>

    </div>
  )
}
