import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config({ ignores: ['dist/**'] }, js.configs.recommended, ...tseslint.configs.recommended, {
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: { globals: Object.fromEntries(['window','document','navigator','globalThis','fetch','Headers','FormData','Blob','File','Image','URL','OffscreenCanvas','AbortController','BroadcastChannel','crypto','setTimeout','clearTimeout','console'].map(name => [name,'readonly'])) },
});
