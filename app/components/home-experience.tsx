'use client';

import { createElement, useEffect, useRef } from 'react';
import { createSerialTaskQueue } from '../../src/serial-task-queue.js';
import { Comments } from './comments';
import { ContentFeed } from './content-feed';

const productionStartupQueue = createSerialTaskQueue();

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
    let remoteData: any;
    window.__ORBIT_MANAGED_BOOTSTRAP__ = true;
    const orbitModuleUrl = import.meta.env.DEV
      ? '/main.js?v=20260724-7'
      : '/orbit/main.js?v=20260724-7';

    const applyRemoteData = async () => {
      if (disposed || !result || !remoteData) return;
      const data = remoteData;
      remoteData = null;
      try {
        await result?.updateData?.({
          ...(data.orbit ? { config: data.orbit } : {}),
          ...(data.platforms ? { platformData: data.platforms } : {}),
        });
      } catch (error) {
        if (!disposed) console.warn('Orbit remote configuration update failed', error);
      }
    };

    productionStartupQueue.run(async () => {
      if (disposed) return;
      const module = await import(/* @vite-ignore */ orbitModuleUrl);
      if (disposed) return;
      const value = await module.startProductionPage();
      if (disposed) {
        value?.destroy?.();
        return;
      }
      result = value;
      await applyRemoteData();
    }).catch((error) => {
      if (!disposed) console.error('Orbit bootstrap failed', error);
    });

    fetch('/api/public/config')
      .then((response) => response.ok ? response.json() : null)
      .then(async (payload) => {
        if (disposed || !payload?.ok) return;
        remoteData = payload.data;
        await applyRemoteData();
      })
      .catch(() => {});

    return () => {
      disposed = true;
      started.current = false;
      result?.destroy?.();
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
