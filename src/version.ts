// The app version comes from package.json at build time (vite.config.ts `define`).
// Each push to the live site bumps the patch number: `npm run bump` (1.0.1 → 1.0.2).
declare const __APP_VERSION__: string;
declare const __APP_BUILT__: string;

export const APP_VERSION: string = __APP_VERSION__;
export const APP_BUILT: string = __APP_BUILT__;

/** Short release notes shown under Help & support → What's new. Newest first. */
export const RELEASE_NOTES: { version: string; items: string[] }[] = [
  {
    version: '1.0.7',
    items: [
      'SoSafe added to the HexaCore Marketplace under Awareness',
      'Reads Human Risk Scores, training completion, phishing-simulation results and Phish Report Button reports',
      'Five write-back actions, from enrolling a user to launching a phishing campaign',
    ],
  },
  {
    version: '1.0.6',
    items: [
      'New look in line with HexaEngine: navy and teal, IBM Plex type, neon tabs, glowing stat tiles and hex-orb module headers',
      'Smoother motion: cards rise in, pages fade between routes and a short intro when you switch module',
      'Sign-in matches HexaEngine, with a Back to HexaEngine link when you arrive from it',
      'A hexagon wave welcome sequence after you sign in, before the Command Centre opens',
    ],
  },
  {
    version: '1.0.5',
    items: [
      'HexaView now ships from the HexaShield enterprise GitHub organisation',
      'Release routine updated for the new repository',
    ],
  },
  {
    version: '1.0.4',
    items: [
      'Command Centre: redesigned role starting points with your profile, module tiles and an assurance panel',
      'Starting-point tiles show which module and page each link opens',
      'Shared Claude skills for releases, smoke tests, localhost and new modules',
    ],
  },
  {
    version: '1.0.3',
    items: [
      'HexaShield services retainer: buy $10k–$100k a year and draw down for AI pen testing, IR hours and consultancy',
      'Log IR hours against the retainer from the Incident Response war room',
      'Removed "New module" badges',
    ],
  },
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
