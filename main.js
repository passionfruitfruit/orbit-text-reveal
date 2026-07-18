import { animationConfig } from './config.js?v=20260711-5';

export async function startProductionPage({
  documentRef = globalThis.document,
  config = animationConfig,
  loadComponent = () => import('./src/orbit-text-reveal.js?v=20260718-2')
} = {}) {
  await documentRef.fonts.ready;
  await loadComponent();

  const host = documentRef.querySelector('orbit-text-reveal');
  documentRef.documentElement.style.setProperty(
    '--orbit-page-background',
    config.style.background
  );
  host.config = config;
  host.hidden = false;
}

if (typeof document !== 'undefined') {
  await startProductionPage();
}
