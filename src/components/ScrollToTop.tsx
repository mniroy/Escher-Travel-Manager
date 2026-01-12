import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        // Prevent browser's native scroll restoration
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
    }, []);

    useEffect(() => {
        // Force scroll to top on pathname change
        // A tiny timeout ensures it runs after any layout shifts or page transitions
        const timer = setTimeout(() => {
            window.scrollTo({
                top: 0,
                left: 0,
                behavior: 'instant' as ScrollBehavior
            });

            // Also check for any common scroll containers
            const mainContainer = document.querySelector('main');
            if (mainContainer) mainContainer.scrollTop = 0;

            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        }, 0);

        return () => clearTimeout(timer);
    }, [pathname]);

    return null;
}
