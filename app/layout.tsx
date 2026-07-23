import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Luke',
  description: 'Luke 的个人网页',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="stylesheet" href="/orbit/src/base.css?v=20260724-1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
