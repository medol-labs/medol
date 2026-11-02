import type { ReactNode } from 'react';
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'MEDOL' }
    ]
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <main className="p-6">
      <h1>Page Not Found</h1>
      <a href="/">Return to Medol</a>
    </main>
  )
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
