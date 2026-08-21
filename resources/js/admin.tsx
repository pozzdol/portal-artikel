import { createInertiaApp } from '@inertiajs/react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'ALMAIDAH';

createInertiaApp({
    title: (title) => (title ? `${title} | ${appName}` : appName),
    resolve: (name) => {
        const pages = import.meta.glob('./admin/Pages/**/*.tsx', { eager: true });
        const page = pages[`./admin/Pages/${name}.tsx`];

        if (!page) {
            throw new Error(`Inertia page not found: ./admin/Pages/${name}.tsx`);
        }

        return page as { default: ComponentType };
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: {
        color: '#C9A227',
    },
});
