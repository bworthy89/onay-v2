# ONAY v2 — UI Migration Guide

## What's Here

```
v2-migration/
├── migrate-ui.sh             ← Copies all UI files to a new repo
├── package-ui-deps.json      ← npm dependencies (UI-only + optional)
├── app-v2.json               ← Clean app.json template
├── MIGRATION.md              ← This file
└── stubs/
    ├── services/
    │   ├── Storage.ts         ← MMKV persistence
    │   ├── AuthService.ts     ← Auth state + sign-in
    │   ├── api.ts             ← authenticatedFetch
    │   ├── SessionMemory.ts   ← Session history
    │   ├── logger.ts          ← Error tracking
    │   └── music/
    │       └── MusicProvider.ts  ← Music playback abstraction
    ├── engines/
    │   ├── SessionEngine.ts
    │   ├── AudioCoordinator.ts
    │   ├── SegmentController.ts
    │   ├── TransitionPreloader.ts
    │   ├── QueueManager.ts
    │   └── PlaylistCurator.ts
    └── cleo/
        └── fallbacks.ts       ← Vibe definitions
```

## Setup

```bash
# 1. Create new repo
mkdir onay-v2 && cd onay-v2 && git init
npx create-expo-app@latest . --template blank-typescript

# 2. Copy UI files
/path/to/cleo-app/v2-migration/migrate-ui.sh /path/to/onay-v2

# 3. Copy stubs
cp -r /path/to/cleo-app/v2-migration/stubs/services /path/to/onay-v2/src/
cp -r /path/to/cleo-app/v2-migration/stubs/engines  /path/to/onay-v2/src/
cp -r /path/to/cleo-app/v2-migration/stubs/cleo     /path/to/onay-v2/src/

# 4. Copy app.json
cp /path/to/cleo-app/v2-migration/app-v2.json /path/to/onay-v2/app.json

# 5. Merge deps from package-ui-deps.json into package.json, then:
npm install
```

## What Gets Copied (50+ files)

| Category | Count | Description |
|----------|-------|-------------|
| Design tokens | 1 | Colors, surfaces, typography, spacing, radii, animations |
| Components | 15 | AppHeader, CleoOrb, CleoPulseDot, CleoSpeakingOverlay, ErrorBoundary, ErrorState, GlassCard, OfflineBanner, OnayCharacter, SectionLabel, StationCard, TabBar, TabIcon, VibePicker, WaveformBars |
| Screens | 7 | Home, Broadcast, SessionArc, Archive, Profile, Onboarding, AskOnay |
| Routing | 20 | Full Expo Router layout (auth, onboarding, 4 tab groups) |
| Hooks | 1 | useAppActive (background/foreground detection) |
| Assets | 11 | Icons, splash, ONAY character frames, animation, grain texture |
| Config | 3 | tsconfig, firebase plugin, feature flags |

## Stubs — What to Implement

Every stub has `// TODO:` markers. The interfaces match what the screens expect.

| Stub | Screens Using It |
|------|-----------------|
| Storage | 7 screens + app/index |
| AuthService | login, index, ProfileScreen |
| api | HomeScreenRedesign |
| MusicProvider | Home, Broadcast, Arc, Profile, music-auth |
| SessionEngine | Home, Broadcast, Arc, AskOnay |
| AudioCoordinator | BroadcastScreen |
| SegmentController | BroadcastScreen |
| TransitionPreloader | BroadcastScreen |
| QueueManager | BroadcastScreen, AskOnay |
| PlaylistCurator | AskOnayScreen |
| SessionMemory | ArchiveScreen |
| fallbacks | VibePicker, Home, Archive, Broadcast |

## Native Module (expo-music-kit)

5 screens import directly from `modules/expo-music-kit`. You have two options:
- **Port it**: Copy `modules/expo-music-kit/` and add autolinking to package.json
- **Abstract it**: Update imports to use the `MusicProvider` stub instead

## Fonts (loaded in app/_layout.tsx)

| Font | Token | Used For |
|------|-------|----------|
| Playfair Display 400 | `PlayfairDisplay_400Regular` | Display headings |
| Inter 400/500/600 | `Inter_*` | Body text |
| EB Garamond 400 Italic | `EBGaramond_400Regular_Italic` | ONAY's dialogue |
| DM Mono 400 | `DMMono_400Regular` | Section labels, UI chrome |

## Design System Quick Ref

- **Background**: `#0D0D0D` — **Accent**: `#C8832A` (gold)
- **Gold left-edge cards**: 2px gold left border on dark cards
- **Mono labels**: DM Mono, 10px, ALL CAPS, letter-spacing 2.5
- **Sharp corners**: 4px radius throughout
- **12 vibes** with unique accent colors
