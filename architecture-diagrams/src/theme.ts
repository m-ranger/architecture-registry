import type { ThemeConfig } from 'antd'

/**
 * Тема модуля — продолжение корпоративного стиля «Архитектурный реестр»
 * (утверждение корпоративного стиля — ТЗ §28, п. 3).
 */
export const brand = {
  primary: '#2f6bff',
  navy: '#0e1c30',
  navySoft: '#16273f',
  ink: '#1f2a37',
  muted: '#64748b',
  pageBg: '#f4f6fa',
  border: '#eef1f6',
  blue: '#2f6bff',
  violet: '#7c5cff',
  green: '#22c55e',
  orange: '#f59e0b',
  cyan: '#06b6d4',
  red: '#ef4444',
} as const

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: brand.primary,
    colorInfo: brand.primary,
    colorLink: brand.primary,
    colorSuccess: brand.green,
    colorWarning: brand.orange,
    colorError: brand.red,
    colorBgLayout: brand.pageBg,
    colorTextBase: brand.ink,
    colorBorderSecondary: brand.border,
    borderRadius: 10,
    fontSize: 13,
    controlHeight: 34,
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 58,
      headerPadding: '0 20px',
      bodyBg: brand.pageBg,
      siderBg: '#fbfcfe',
    },
    Card: { borderRadiusLG: 14, paddingLG: 18 },
    Table: {
      headerBg: '#f7f9fc',
      headerColor: brand.muted,
      headerSplitColor: 'transparent',
      borderColor: brand.border,
      rowHoverBg: '#f7f9fc',
      cellPaddingBlock: 11,
      cellPaddingInline: 14,
    },
    Button: { borderRadius: 8, primaryShadow: 'none', controlHeight: 34 },
    Input: { borderRadius: 8, controlHeight: 34 },
    Select: { borderRadius: 8, controlHeight: 34 },
    Tabs: { itemColor: brand.muted, titleFontSize: 13 },
    Drawer: { paddingLG: 18 },
  },
}
