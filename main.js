import { animationConfig, platformConfig } from './config.js?v=20260718-3';
 import { renderPlatformCards } from './src/platform-renderer.js?v=20260718-3';
 import { createIntroScrollController } from './src/intro-scroll.js?v=20260718-4';

export async function startProductionPage({
   documentRef = globalThis.document,
   windowRef = globalThis,
   config = animationConfig,
   platformData = platformConfig,
   loadComponent = () => import('./src/orbit-text-reveal.js?v=20260718-2'),
   renderCards = renderPlatformCards,
   createController = createIntroScrollController,
   recordEvent
 } = {}) {
   const record = recordEvent ?? (() => {});

   record('fonts-ready');
   await documentRef.fonts.ready;

   record('load-component');
   await loadComponent();

   const host = documentRef.querySelector('orbit-text-reveal');
   const sequence = documentRef.querySelector('.intro-sequence');
   const platforms = documentRef.querySelector('.platforms');
   const grid = documentRef.querySelector('#platform-grid');

   if (!host || !sequence || !platforms || !grid) {
     throw new Error('startProductionPage: missing required DOM elements');
   }

   record('assign-orbit-config');
   documentRef.documentElement.style.setProperty(
     '--orbit-page-background',
     config.style.background
   );
   host.config = config;

   record('render-platforms');
   const platformView = renderCards(grid, platformData);

   record('start-intro');
   const introController = createController({
     windowRef,
     documentRef,
     sequence,
     host,
     platforms
   });

   record('show-orbit');
   host.hidden = false;

   return { host, platformView, introController };
 }

 if (typeof document !== 'undefined') {
   await startProductionPage();
 }
