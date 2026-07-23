import { animationConfig, platformConfig } from './config.js?v=20260718-3';
 import { renderPlatformCards } from './src/platform-renderer.js?v=20260724-1';
 import { createIntroScrollController } from './src/intro-scroll.js?v=20260724-5';

export function resolvePlatformAssets(entries, baseUrl = import.meta.url) {
  return entries.map((entry) => ({
    ...entry,
    icon: new URL(entry.icon, baseUrl).href,
  }));
}

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
   let destroyed = false;
   let updateRevision = 0;

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

   const applyOrbitConfig = (nextConfig) => {
     if (!nextConfig) return;
     if (nextConfig.style?.background) {
       documentRef.documentElement.style.setProperty(
         '--orbit-page-background',
         nextConfig.style.background
       );
     }
     host.config = nextConfig;
   };

   record('assign-orbit-config');
   applyOrbitConfig(config);

   record('render-platforms');
   let platformView = await renderCards(grid, resolvePlatformAssets(platformData));

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

   return {
     host,
     get platformView() { return platformView; },
     introController,
     async updateData({ config: nextConfig, platformData: nextPlatforms } = {}) {
       if (destroyed) return false;
       const revision = ++updateRevision;
       applyOrbitConfig(nextConfig);
       if (nextPlatforms) {
         const nextView = await renderCards(grid, resolvePlatformAssets(nextPlatforms));
         if (destroyed) {
           nextView?.destroy?.();
           return false;
         }
         if (revision !== updateRevision) {
           nextView?.destroy?.({ clear: false });
           return false;
         }
         const previousView = platformView;
         platformView = nextView;
         previousView?.destroy?.({ clear: false });
         introController.refreshCards?.();
       }
       return true;
     },
     destroy() {
       if (destroyed) return;
       destroyed = true;
       updateRevision += 1;
       introController.destroy?.();
       platformView?.destroy?.();
       host.destroy?.();
     }
   };
 }

 if (typeof document !== 'undefined' && !globalThis.__ORBIT_MANAGED_BOOTSTRAP__) {
   await startProductionPage();
 }
