/**
 * RagVyn AI Chat Themes Configuration
 * 
 * Each theme defines two distinct visual layers:
 * 1. outerBackground: The surrounding environment backdrop for the chatbot.
 * 2. chatSurface: The dedicated inner surface where conversation messages and input composer reside.
 * 
 * To add a new theme in the future:
 * Simply add a new object to RAGVYN_THEMES with the required fields below.
 */

export const RAGVYN_THEMES = [
  {
    id: 'ayurveda-cream',
    name: 'Government AYUSH Workspace',
    subtitle: 'Crisp light workspace • Clean official research layout',
    preview: {
      outer: '#f8fafc',
      surface: '#ffffff',
      accent: '#0d463b',
      userBubble: '#0d463b',
    },
    outerBackground: {
      color: '#f8fafc',
      image: 'none',
      size: 'cover',
      position: 'center',
      overlay: 'transparent',
    },
    chatSurface: {
      bg: '#ffffff',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      shadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
    },
    sidebar: {
      bg: 'linear-gradient(180deg, #06241a 0%, #0d3d2e 60%, #08281d 100%)',
      textPrimary: '#ffffff',
      textSecondary: 'rgba(255, 255, 255, 0.75)',
      border: 'rgba(255, 255, 255, 0.12)',
    },
    userMessage: {
      bg: 'linear-gradient(135deg, #0d463b 0%, #06241a 100%)',
      text: '#FFFFFF',
      border: '1px solid rgba(13, 70, 59, 0.4)',
      shadow: '0 4px 14px rgba(6, 36, 26, 0.16)',
    },
    aiMessage: {
      bg: '#FFFFFF',
      text: '#0f172a',
      border: '1px solid #e2e8f0',
      accentLeft: '#10B981',
      shadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
      timestamp: '#64748b',
    },
    composer: {
      barBg: '#ffffff',
      inputWrapBg: '#ffffff',
      text: '#0f172a',
      placeholder: '#64748b',
      border: '#cbd5e1',
      focusBorder: '#0d463b',
      borderTop: '#e2e8f0',
    },
    cards: {
      bg: '#FFFFFF',
      border: '#e2e8f0',
      headerText: '#0f172a',
      snippetText: '#334155',
    },
  },
  {
    id: 'vedic-botanical',
    name: 'Vedic Botanical',
    subtitle: 'Parchment canvas • Sanctuary botanical backdrop',
    preview: {
      outer: '#13392E',
      surface: '#F8F4EB',
      accent: '#D97706',
      userBubble: '#92400E',
    },
    outerBackground: {
      color: '#13392E',
      image: "url('/ragvyn-chat-bg.jpg')",
      size: 'cover',
      position: 'center',
      overlay: 'rgba(10, 30, 22, 0.52)',
    },
    chatSurface: {
      bg: '#F8F4EB',
      textPrimary: '#1E293B',
      textSecondary: '#475569',
      textMuted: '#64748B',
      border: 'rgba(19, 57, 46, 0.15)',
      shadow: '0 14px 40px rgba(0, 0, 0, 0.2)',
    },
    sidebar: {
      bg: 'rgba(10, 28, 22, 0.96)',
      textPrimary: '#F1F5F4',
      textSecondary: '#94A3B8',
      border: 'rgba(200, 122, 30, 0.2)',
    },
    userMessage: {
      bg: 'linear-gradient(135deg, #92400E 0%, #78350F 100%)',
      text: '#FFFFFF',
      border: '1px solid rgba(245, 158, 11, 0.35)',
      shadow: '0 4px 14px rgba(120, 53, 15, 0.25)',
    },
    aiMessage: {
      bg: '#FFFFFF',
      text: '#1E293B',
      border: '1px solid rgba(19, 57, 46, 0.14)',
      accentLeft: '#D97706',
      shadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
      timestamp: '#64748B',
    },
    composer: {
      barBg: '#F8F4EB',
      inputWrapBg: '#FFFFFF',
      text: '#1E293B',
      placeholder: '#64748B',
      border: 'rgba(19, 57, 46, 0.2)',
      focusBorder: '#D97706',
      borderTop: 'rgba(19, 57, 46, 0.14)',
    },
    cards: {
      bg: '#FFFFFF',
      border: 'rgba(19, 57, 46, 0.12)',
      headerText: '#1E293B',
      snippetText: '#334155',
    },
  },
  {
    id: 'royal-saffron',
    name: 'Royal Saffron Sandstone',
    subtitle: 'Sandstone beige • Warm golden aura',
    preview: {
      outer: '#1C160C',
      surface: '#FAF4E8',
      accent: '#C87A1E',
      userBubble: '#B45309',
    },
    outerBackground: {
      color: '#1C160C',
      image: "linear-gradient(135deg, #1C160C 0%, #2A1F13 50%, #17241A 100%)",
      size: 'cover',
      position: 'center',
      overlay: 'transparent',
    },
    chatSurface: {
      bg: '#FAF4E8',
      textPrimary: '#262016',
      textSecondary: '#544636',
      textMuted: '#7D6C58',
      border: 'rgba(200, 122, 30, 0.18)',
      shadow: '0 12px 36px rgba(0, 0, 0, 0.22)',
    },
    sidebar: {
      bg: 'rgba(24, 18, 12, 0.96)',
      textPrimary: '#FAF4E8',
      textSecondary: '#D4C4AE',
      border: 'rgba(200, 122, 30, 0.22)',
    },
    userMessage: {
      bg: 'linear-gradient(135deg, #B45309 0%, #92400E 100%)',
      text: '#FFFFFF',
      border: '1px solid rgba(245, 158, 11, 0.4)',
      shadow: '0 4px 14px rgba(180, 83, 9, 0.25)',
    },
    aiMessage: {
      bg: '#FFFFFF',
      text: '#262016',
      border: '1px solid rgba(200, 122, 30, 0.18)',
      accentLeft: '#C87A1E',
      shadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
      timestamp: '#7D6C58',
    },
    composer: {
      barBg: '#FAF4E8',
      inputWrapBg: '#FFFFFF',
      text: '#262016',
      placeholder: '#7D6C58',
      border: 'rgba(200, 122, 30, 0.22)',
      focusBorder: '#C87A1E',
      borderTop: 'rgba(200, 122, 30, 0.16)',
    },
    cards: {
      bg: '#FFFFFF',
      border: 'rgba(200, 122, 30, 0.15)',
      headerText: '#262016',
      snippetText: '#42372A',
    },
  },
  {
    id: 'midnight-scholar',
    name: 'Midnight Scholar (Dark)',
    subtitle: 'Obsidian slate surface • High-contrast night study',
    preview: {
      outer: '#060F0C',
      surface: '#0F1C18',
      accent: '#34D399',
      userBubble: '#059669',
    },
    outerBackground: {
      color: '#060F0C',
      image: "url('/ragvyn-doodle-bg.png')",
      size: 'cover',
      position: 'center',
      overlay: 'rgba(4, 12, 10, 0.76)',
    },
    chatSurface: {
      bg: '#0F1C18',
      textPrimary: '#F1F5F9',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      border: 'rgba(52, 211, 153, 0.18)',
      shadow: '0 16px 44px rgba(0, 0, 0, 0.65)',
    },
    sidebar: {
      bg: 'rgba(8, 18, 14, 0.97)',
      textPrimary: '#ECFDF5',
      textSecondary: '#6EE7B7',
      border: 'rgba(52, 211, 153, 0.14)',
    },
    userMessage: {
      bg: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      text: '#FFFFFF',
      border: '1px solid rgba(110, 231, 183, 0.35)',
      shadow: '0 4px 16px rgba(5, 150, 105, 0.4)',
    },
    aiMessage: {
      bg: '#142721',
      text: '#F1F5F9',
      border: '1px solid rgba(52, 211, 153, 0.22)',
      accentLeft: '#10B981',
      shadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
      timestamp: 'rgba(167, 243, 208, 0.65)',
    },
    composer: {
      barBg: '#0B1713',
      inputWrapBg: '#132620',
      text: '#F1F5F9',
      placeholder: '#64748B',
      border: 'rgba(52, 211, 153, 0.25)',
      focusBorder: '#34D399',
      borderTop: 'rgba(52, 211, 153, 0.15)',
    },
    cards: {
      bg: '#142721',
      border: 'rgba(52, 211, 153, 0.18)',
      headerText: '#ECFDF5',
      snippetText: '#D1FAE5',
    },
  },
];

export const DEFAULT_THEME_ID = 'ayurveda-cream';

export function getChatTheme(id) {
  return RAGVYN_THEMES.find(t => t.id === id) || RAGVYN_THEMES[0];
}

/**
 * Returns a CSS style object representing CSS custom properties
 * to be applied to the chat container root.
 */
export function getThemeCSSVariables(theme) {
  return {
    '--ragvyn-outer-bg-color': theme.outerBackground.color,
    '--ragvyn-outer-bg-image': theme.outerBackground.image,
    '--ragvyn-outer-bg-size': theme.outerBackground.size,
    '--ragvyn-outer-bg-position': theme.outerBackground.position,
    '--ragvyn-outer-overlay': theme.outerBackground.overlay,

    '--ragvyn-chat-surface': theme.chatSurface.bg,
    '--ragvyn-text-primary': theme.chatSurface.textPrimary,
    '--ragvyn-text-secondary': theme.chatSurface.textSecondary,
    '--ragvyn-text-muted': theme.chatSurface.textMuted,
    '--ragvyn-border': theme.chatSurface.border,
    '--ragvyn-surface-shadow': theme.chatSurface.shadow,

    '--ragvyn-sidebar-bg': theme.sidebar.bg,
    '--ragvyn-sidebar-text': theme.sidebar.textPrimary,
    '--ragvyn-sidebar-muted': theme.sidebar.textSecondary,
    '--ragvyn-sidebar-border': theme.sidebar.border,

    '--ragvyn-user-bubble-bg': theme.userMessage.bg,
    '--ragvyn-user-bubble-text': theme.userMessage.text,
    '--ragvyn-user-bubble-border': theme.userMessage.border,
    '--ragvyn-user-bubble-shadow': theme.userMessage.shadow,

    '--ragvyn-ai-bubble-bg': theme.aiMessage.bg,
    '--ragvyn-ai-bubble-text': theme.aiMessage.text,
    '--ragvyn-ai-bubble-border': theme.aiMessage.border,
    '--ragvyn-ai-bubble-accent': theme.aiMessage.accentLeft,
    '--ragvyn-ai-bubble-shadow': theme.aiMessage.shadow,
    '--ragvyn-ai-bubble-timestamp': theme.aiMessage.timestamp,

    '--ragvyn-composer-bar-bg': theme.composer.barBg,
    '--ragvyn-composer-input-bg': theme.composer.inputWrapBg,
    '--ragvyn-composer-text': theme.composer.text,
    '--ragvyn-composer-placeholder': theme.composer.placeholder,
    '--ragvyn-composer-border': theme.composer.border,
    '--ragvyn-composer-focus': theme.composer.focusBorder,
    '--ragvyn-composer-border-top': theme.composer.borderTop,

    '--ragvyn-card-bg': theme.cards.bg,
    '--ragvyn-card-border': theme.cards.border,
    '--ragvyn-card-header': theme.cards.headerText,
    '--ragvyn-card-snippet': theme.cards.snippetText,
  };
}
