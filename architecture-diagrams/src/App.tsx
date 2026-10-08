import { ConfigProvider, Layout, Space, Tag, Typography } from 'antd'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DeploymentUnitOutlined, ExportOutlined } from '@ant-design/icons'
import { appTheme, brand } from './theme'
import { DiagramListPage } from './pages/DiagramListPage'
import { DiagramEditorPage } from './pages/DiagramEditorPage'
import { REGISTRY_APP_URL } from './config'

/**
 * Оболочка SPA модуля «Архитектурные схемы».
 * Модуль работает как отдельное приложение и отдельный контейнер,
 * поэтому навигация внутри модуля независима от основного реестра (ТЗ §21).
 */
export function App() {
  const location = useLocation()
  const isEditor = /^\/diagrams\/[^/]+$/.test(location.pathname)

  return (
    <ConfigProvider theme={appTheme}>
      <Layout className="arch-shell">
        {!isEditor ? (
          <Layout.Header className="arch-shell__header">
            <Space size={10} align="center">
              <span className="arch-shell__logo">
                <DeploymentUnitOutlined />
              </span>
              <div>
                <Typography.Text strong style={{ fontSize: 14 }}>
                  Архитектурные схемы
                </Typography.Text>
                <span className="arch-shell__subtitle">Модуль визуализации Единого архитектурного реестра</span>
              </div>
            </Space>
            <Space size={8}>
              <Tag bordered={false} style={{ background: '#eef2ff', color: brand.primary }}>
                C4 · React Flow
              </Tag>
              <a href={REGISTRY_APP_URL} target="_blank" rel="noreferrer" className="arch-shell__link">
                Открыть реестр <ExportOutlined />
              </a>
            </Space>
          </Layout.Header>
        ) : null}

        <Layout.Content className="arch-shell__content">
          <Routes>
            <Route path="/" element={<Navigate to="/diagrams" replace />} />
            <Route path="/diagrams" element={<DiagramListPage />} />
            <Route path="/diagrams/:id" element={<DiagramEditorPage />} />
            <Route path="*" element={<Navigate to="/diagrams" replace />} />
          </Routes>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  )
}
