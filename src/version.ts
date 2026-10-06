// The app version comes from package.json at build time (vite.config.ts `define`).
// Each push to the live site bumps the patch number: `npm run bump` (1.0.1 → 1.0.2).
declare const __APP_VERSION__: string;
declare const __APP_BUILT__: string;

export const APP_VERSION: string = __APP_VERSION__;
export const APP_BUILT: string = __APP_BUILT__;

/** Short release notes shown under Help & support → What's new. Newest first. */
export const RELEASE_NOTES: { version: string; items: string[] }[] = [
  {
    version: '1.0.2',
    items: [
      'Version number on the sign-in screen',
      'Help & support in your profile: support chat, tickets, incident reporting, hotline, shortcuts and what’s new',
      'Profile panel stays fully on screen',
    ],
  },
  {
    version: '1.0.1',
    items: [
      'HexaStrike AI Penetration Testing: scoping, signed authorisation, live testing, reports and retests',
      'Incident Response (L4) module under Communications Hub',
      'Calendar pop-up for date fields',
    ],
  },
];
