import type { ThemeConfig } from 'antd'

/**
 * Палитра интерфейса — соответствует макету «Архитектурный реестр».
 * Тёмно-синяя навигация, белый хедер, светло-серый фон контента, синий акцент.
 */
export const brand = {
  primary: '#2f6bff',
  navy: '#0e1c30',
  navySoft: '#16273f',
  ink: '#1f2a37',
  muted: '#64748b',
  pageBg: '#f4f6fa',
  border: '#eef1f6',
  /* Акцентные цвета иконок KPI и диаграмм */
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
    controlHeight: 36,
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 60,
      headerPadding: '0 24px',
      siderBg: brand.navy,
      bodyBg: brand.pageBg,
    },
    Menu: {
      darkItemBg: brand.navy,
      darkSubMenuItemBg: brand.navySoft,
      darkItemColor: 'rgba(255,255,255,0.72)',
      darkItemHoverColor: '#ffffff',
      darkItemHoverBg: 'rgba(255,255,255,0.08)',
      darkItemSelectedBg: brand.primary,
      darkItemSelectedColor: '#ffffff',
      darkGroupTitleColor: 'rgba(255,255,255,0.38)',
      itemBorderRadius: 8,
      itemMarginInline: 8,
      itemMarginBlock: 4,
      itemHeight: 40,
    },
    Card: {
      borderRadiusLG: 14,
      paddingLG: 20,
    },
    Table: {
      headerBg: '#f7f9fc',
      headerColor: brand.muted,
      headerSplitColor: 'transparent',
      borderColor: brand.border,
      rowHoverBg: '#f7f9fc',
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },
    Button: {
      borderRadius: 8,
      primaryShadow: 'none',
      controlHeight: 36,
    },
    Input: { borderRadius: 8, controlHeight: 36 },
    Select: { borderRadius: 8, controlHeight: 36 },
    Tabs: { itemColor: brand.muted, titleFontSize: 13 },
    Drawer: { paddingLG: 20 },
  },
}
