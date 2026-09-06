// Standalone client-only entry used for the GitHub Pages build.
// The app has no server-rendered data, so the whole thing mounts in the browser.
// The Cloudflare/vinext build in vite.config.ts remains the primary deployment.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../app/globals.css';
import Home from '../app/page';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);
