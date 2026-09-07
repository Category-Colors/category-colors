/* eslint-disable react/only-export-components -- this is the Vite entry point, not a refresh boundary */
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '@/components/dialkit/theme.css'
import './index.css'
import App from './App.tsx'

// The story harness and the design-system reference are development surfaces
// reached by URL; loading them lazily keeps them out of the app's bundle.
const StoryPage = import.meta.env.DEV ? lazy(() => import('./dev/stories.tsx').then((m) => ({ default: m.StoryPage }))) : null
const DesignSystemPage = import.meta.env.DEV ? lazy(() =>
  import('./dev/design-system.tsx').then((m) => ({ default: m.DesignSystemPage }))
) : null

const story = import.meta.env.DEV ? new URLSearchParams(location.search).get('story') : null
const designSystem = import.meta.env.DEV && location.pathname === '/design-system'
const root = document.getElementById('root')
if (!root) throw new Error('Missing #root application mount point')

createRoot(root).render(
  <StrictMode>
    {story !== null && StoryPage ? (
      <Suspense fallback={null}>
        <StoryPage name={story} />
      </Suspense>
    ) : designSystem && DesignSystemPage ? (
      <Suspense fallback={null}>
        <DesignSystemPage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>
)
