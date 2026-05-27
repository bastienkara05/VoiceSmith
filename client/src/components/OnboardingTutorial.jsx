import { useEffect, useRef, useState } from 'react'
import { ChevronRight, X, HelpCircle } from 'lucide-react'
import { STEP_TOOLTIPS } from '../hooks/useOnboarding'
import styles from './OnboardingTutorial.module.css'

export default function OnboardingTutorial({
  currentStep,
  isVisible,
  onNext,
  onSkip,
  targetRef,
  totalSteps
}) {
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [highlightBox, setHighlightBox] = useState(null)
  const [isInteracting, setIsInteracting] = useState(false)
  const tooltipRef = useRef(null)

  // Reset interaction state when step changes
  useEffect(() => {
    setIsInteracting(false)
  }, [currentStep])

  // Detect when user interacts with the target element
  useEffect(() => {
    if (!targetRef?.current) return

    const element = targetRef.current

    const handleClick = () => setIsInteracting(true)
    const handleInput = () => setIsInteracting(true)

    element.addEventListener('click', handleClick)
    element.addEventListener('input', handleInput)
    element.addEventListener('change', handleInput)

    return () => {
      element.removeEventListener('click', handleClick)
      element.removeEventListener('input', handleInput)
      element.removeEventListener('change', handleInput)
    }
  }, [targetRef])

  useEffect(() => {
    console.log('[OnboardingTutorial] Render - currentStep:', currentStep, 'isVisible:', isVisible, 'targetRef:', targetRef?.current)
    if (!isVisible || currentStep === null || !targetRef?.current) return

    console.log('[OnboardingTutorial] Showing tutorial for step:', currentStep)
    const updatePosition = () => {
      const element = targetRef.current
      if (!element) {
        console.log('[OnboardingTutorial] WARNING: targetRef is null for step:', currentStep)
        return
      }

      console.log('[OnboardingTutorial] Target element:', element.tagName, element.textContent?.slice(0, 30))

      // Scroll element into view if needed
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

      // Also scroll parent containers if needed
      let parent = element.parentElement
      while (parent) {
        if (parent.style.overflowY === 'auto' || parent.style.overflowY === 'scroll' || getComputedStyle(parent).overflowY === 'auto' || getComputedStyle(parent).overflowY === 'scroll') {
          parent.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
        parent = parent.parentElement
      }

      // Get position after scrolling
      setTimeout(() => {
        const rect = element.getBoundingClientRect()
        const scrollY = window.scrollY
        const scrollX = window.scrollX

        console.log('[OnboardingTutorial] Element rect:', {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          viewportHeight: window.innerHeight,
        })

        setHighlightBox({
          top: rect.top + scrollY,
          left: rect.left + scrollX,
          width: rect.width,
          height: rect.height,
        })

        // Try to position tooltip below the element, but adjust if it goes off-screen
        let tooltipTop = rect.top + scrollY + rect.height + 16
        let tooltipLeft = rect.left + scrollX + rect.width / 2

        // Check if tooltip would go off bottom, position above instead
        const tooltipHeight = 280 // approximate height of tooltip
        if (tooltipTop + tooltipHeight > window.innerHeight + scrollY) {
          tooltipTop = rect.top + scrollY - tooltipHeight - 16
        }

        // Ensure tooltip doesn't go off right side
        const tooltipWidth = 360
        const maxLeft = window.innerWidth - tooltipWidth - 20
        if (tooltipLeft + tooltipWidth / 2 > maxLeft) {
          tooltipLeft = maxLeft
        }
        // Ensure tooltip doesn't go off left side
        if (tooltipLeft - tooltipWidth / 2 < 20) {
          tooltipLeft = 20 + tooltipWidth / 2
        }

        setPosition({
          top: tooltipTop,
          left: tooltipLeft,
        })
      }, 300)
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isVisible, currentStep, targetRef])

  if (!isVisible || currentStep === null || !highlightBox || isInteracting) return null

  const tooltip = STEP_TOOLTIPS[currentStep]
  const isLastStep = currentStep === totalSteps - 1

  return (
    <>
      {/* Spotlight effect */}
      {highlightBox && (
        <svg className={styles.spotlight} width="100%" height="100%">
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={highlightBox.left}
                y={highlightBox.top}
                width={highlightBox.width}
                height={highlightBox.height}
                fill="black"
                rx="8"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.7)"
            mask="url(#spotlight-mask)"
          />
          <rect
            x={highlightBox.left}
            y={highlightBox.top}
            width={highlightBox.width}
            height={highlightBox.height}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            rx="8"
          />
        </svg>
      )}

      {/* Tooltip */}
      <div
        className={styles.tooltip}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
        ref={tooltipRef}
      >
        <h3 className={styles.tooltipTitle}>{tooltip.title}</h3>
        <p className={styles.tooltipText}>{tooltip.text}</p>
        <div className={styles.tooltipFooter}>
          <button className={styles.skipBtn} onClick={onSkip}>
            Skip Tutorial
          </button>
          <button className={styles.nextBtn} onClick={onNext}>
            {isLastStep ? 'Done' : 'Next'}
            <ChevronRight size={16} />
          </button>
        </div>
        <div className={styles.stepIndicator}>
          Step {currentStep + 1} of {totalSteps}
        </div>
      </div>
    </>
  )
}

export function HelpTrigger({ onRetrigger }) {
  return (
    <button
      className={styles.helpBtn}
      onClick={onRetrigger}
      title="Show tutorial again"
      aria-label="Show tutorial again"
    >
      <HelpCircle size={20} />
    </button>
  )
}
