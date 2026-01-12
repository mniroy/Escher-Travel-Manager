import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
            manifest: {
                name: 'Escher Travel Manager',
                short_name: 'EscherTravel',
                description: 'Premium Travel Management App',
                theme_color: '#0f172a',
                background_color: '#000000',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/',
                start_url: '/',
                categories: ['travel', 'productivity', 'lifestyle'],
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable'
                    }
                ]
            },
            workbox: {
                // Cache app shell
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                // Runtime caching strategies
                runtimeCaching: [
                    {
                        // Cache API responses
                        urlPattern: /^\/api\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 // 24 hours
                            },
                            networkTimeoutSeconds: 10,
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Cache images
                        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'image-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                            }
                        }
                    },
                    {
                        // Cache external images (Unsplash, etc.)
                        urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'external-image-cache',
                            expiration: {
                                maxEntries: 30,
                                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
                            }
                        }
                    },
                    {
                        // Cache Google Fonts
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'google-fonts-stylesheets'
                        }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-webfonts',
                            expiration: {
                                maxEntries: 20,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                            }
                        }
                    }
                ]
            },
            devOptions: {
                enabled: false,
                type: 'module'
            }
        })
    ],
});
