'use client';

import { createElement, useEffect, useRef } from 'react';
import { Comments } from './comments';
import { ContentFeed } from './content-feed';

declare global {
  interface Window { __ORBIT_MANAGED_BOOTSTRAP__?: boolean }
}

export function HomeExperience() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let disposed = false;
    let result: any;
    window.__ORBIT_MANAGED_BOOTSTRAP__ = true;
    const orbitModuleUrl = '/orbit/main.js?v=20260724-2';
    Promise.all([
      import(/* @vite-ignore */ orbitModuleUrl),
      fetch('/api/public/config').then((response) => response.ok ? response.json() : null).catch(() => null),
    ]).then(([module, payload]) => {
      if (disposed) return;
      const data = payload?.ok ? payload.data : undefined;
      return module.startProductionPage({
        ...(data?.orbit ? { config: data.orbit } : {}),
        ...(data?.platforms ? { platformData: data.platforms } : {}),
      });
    }).then((value) => { result = value; }).catch((error) => {
      console.error('Orbit bootstrap failed', error);
    });
    return () => {
      disposed = true;
      started.current = false;
      result?.introController?.destroy?.();
      result?.platformView?.destroy?.();
      result?.host?.destroy?.();
    };
  }, []);

  return (
    <main className="homepage">
      <section className="intro-sequence" aria-labelledby="platform-heading">
        <div className="intro-scene">
          {createElement('orbit-text-reveal', { hidden: true })}
          <section className="platforms" aria-labelledby="platform-heading">
            <h1 id="platform-heading" className="platforms__heading">找到我</h1>
            <div id="platform-grid" className="platform-grid" />
          </section>
        </div>
      </section>
      <section id="content-stream" className="page-band" aria-labelledby="content-heading">
        <div className="page-column">
          <h2 id="content-heading" className="section-heading">最近在做</h2>
          <ContentFeed />
        </div>
      </section>
      <section id="comments-section" className="page-band page-band--comments" aria-labelledby="comments-heading">
        <div className="page-column">
          <h2 id="comments-heading" className="section-heading">留言</h2>
          <Comments />
        </div>
      </section>
    </main>
  );
}
