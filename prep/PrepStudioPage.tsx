import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '@google/model-viewer'
import PrepStudio from './PrepStudio'
import prepStyles from './prep-styles.css?inline'
import biomedStyles from './prep-biomed.css?inline'

type PrepStudioPageProps = {
  onBack: () => void
}

export default function PrepStudioPage({ onBack }: PrepStudioPageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' })
    if (!root.querySelector('style[data-prep-studio]')) {
      const style = document.createElement('style')
      style.dataset.prepStudio = 'true'
      style.textContent = `${prepStyles}\n:host{display:block;min-height:100vh;background:#f5f7fb;font-family:'Manrope','Noto Sans SC',sans-serif}\n${biomedStyles}`
      root.appendChild(style)
    }
    setShadowRoot(root)
  }, [])

  return (
    <div ref={hostRef} className="min-h-screen bg-[#f5f7fb]">
      {shadowRoot ? createPortal(<PrepStudio onBack={onBack} />, shadowRoot) : null}
    </div>
  )
}
