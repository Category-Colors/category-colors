import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@/components/dialkit/theme.css'
import './index.css'
import App from './App.tsx'

// The story harness and the design-system reference are development surfaces
// reached by URL; loading them lazily keeps them out of the app's bundle.
const StoryPage = lazy(() => import('./dev/stories.tsx').then((m) => ({ default: m.StoryPage })))
const DesignSystemPage = lazy(() =>
  import('./dev/design-system.tsx').then((m) => ({ default: m.DesignSystemPage }))
)

const story = new URLSearchParams(location.search).get('story')
const designSystem = location.pathname === '/design-system'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {story !== null ? (
      <Suspense fallback={null}>
        <StoryPage name={story} />
      </Suspense>
    ) : designSystem ? (
      <Suspense fallback={null}>
        <DesignSystemPage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>
)
