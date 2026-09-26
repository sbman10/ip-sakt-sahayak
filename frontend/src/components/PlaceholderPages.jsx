/**
 * RAGVYN Placeholder Pages
 *
 * Future-feature routes: Agent, Customize, Pulse, Gallery
 * Clean empty states — no API calls, no mock data.
 * Ready for future feature integration.
 */
import {
  IconBot,
  IconSettings,
  IconActivity,
  IconGrid,
} from './Icons'

export function AgentPage() {
  return (
    <div className="ragvyn-placeholder-page">
      <div className="ragvyn-placeholder-page__icon">
        <IconBot size={32} />
      </div>
      <h1 className="ragvyn-placeholder-page__title">Agent</h1>
      <p className="ragvyn-placeholder-page__desc">
        AI agent capabilities for autonomous patent research, prior art analysis, and regulatory compliance workflows.
      </p>
      <span className="ragvyn-placeholder-page__badge">Coming soon</span>
    </div>
  )
}

export function CustomizePage() {
  return (
    <div className="ragvyn-placeholder-page">
      <div className="ragvyn-placeholder-page__icon">
        <IconSettings size={32} />
      </div>
      <h1 className="ragvyn-placeholder-page__title">Customize</h1>
      <p className="ragvyn-placeholder-page__desc">
        Personalize your RAGVYN experience — configure research preferences, citation styles, jurisdiction defaults, and more.
      </p>
      <span className="ragvyn-placeholder-page__badge">Coming soon</span>
    </div>
  )
}

export function PulsePage() {
  return (
    <div className="ragvyn-placeholder-page">
      <div className="ragvyn-placeholder-page__icon">
        <IconActivity size={32} />
      </div>
      <h1 className="ragvyn-placeholder-page__title">Pulse</h1>
      <p className="ragvyn-placeholder-page__desc">
        Real-time monitoring of patent filings, regulatory updates, and IP landscape changes relevant to your formulations.
      </p>
      <span className="ragvyn-placeholder-page__badge">Coming soon</span>
    </div>
  )
}

export function GalleryPage() {
  return (
    <div className="ragvyn-placeholder-page">
      <div className="ragvyn-placeholder-page__icon">
        <IconGrid size={32} />
      </div>
      <h1 className="ragvyn-placeholder-page__title">Gallery</h1>
      <p className="ragvyn-placeholder-page__desc">
        Browse curated patent analysis templates, research workflows, and pre-built compliance checks.
      </p>
      <span className="ragvyn-placeholder-page__badge">Coming soon</span>
    </div>
  )
}
