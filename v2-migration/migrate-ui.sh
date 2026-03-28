#!/bin/bash
# migrate-ui.sh — Copy all UI-related files from cleo-app v1 to a new v2 repo
# Usage: ./migrate-ui.sh /path/to/new-repo

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: ./migrate-ui.sh /path/to/new-repo"
  exit 1
fi

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$1"

echo "==> Source: $SRC"
echo "==> Dest:  $DEST"
echo ""

# Create directory structure
mkdir -p "$DEST/src/tokens"
mkdir -p "$DEST/src/hooks"
mkdir -p "$DEST/src/components"
mkdir -p "$DEST/src/screens/home"
mkdir -p "$DEST/src/screens/player"
mkdir -p "$DEST/src/screens/arc"
mkdir -p "$DEST/src/screens/archive"
mkdir -p "$DEST/src/screens/settings"
mkdir -p "$DEST/src/screens/onboarding"
mkdir -p "$DEST/src/screens/curate"
mkdir -p "$DEST/app/(auth)"
mkdir -p "$DEST/app/(onboarding)"
mkdir -p "$DEST/app/(main)/(broadcast)"
mkdir -p "$DEST/app/(main)/(arc)"
mkdir -p "$DEST/app/(main)/(archive)"
mkdir -p "$DEST/app/(main)/(cleo)"
mkdir -p "$DEST/assets/cleo"
mkdir -p "$DEST/assets/fonts"
mkdir -p "$DEST/assets/textures"
mkdir -p "$DEST/plugins"
mkdir -p "$DEST/src/config"

echo "==> Copying design tokens..."
cp "$SRC/src/tokens/design-tokens.ts" "$DEST/src/tokens/"

echo "==> Copying hooks..."
cp "$SRC/src/hooks/useAppActive.ts" "$DEST/src/hooks/"

echo "==> Copying components..."
for f in \
  AppHeader.tsx \
  CleoOrb.tsx \
  CleoPulseDot.tsx \
  CleoSpeakingOverlay.tsx \
  ErrorBoundary.tsx \
  ErrorState.tsx \
  GlassCard.tsx \
  OfflineBanner.tsx \
  OnayCharacter.tsx \
  SectionLabel.tsx \
  StationCard.tsx \
  TabBar.tsx \
  TabIcon.tsx \
  VibePicker.tsx \
  WaveformBars.tsx \
; do
  cp "$SRC/src/components/$f" "$DEST/src/components/"
done

echo "==> Copying screens..."
cp "$SRC/src/screens/home/HomeScreenRedesign.tsx"    "$DEST/src/screens/home/"
cp "$SRC/src/screens/player/BroadcastScreen.tsx"     "$DEST/src/screens/player/"
cp "$SRC/src/screens/arc/SessionArcScreen.tsx"       "$DEST/src/screens/arc/"
cp "$SRC/src/screens/archive/ArchiveScreen.tsx"      "$DEST/src/screens/archive/"
cp "$SRC/src/screens/settings/ProfileScreen.tsx"     "$DEST/src/screens/settings/"
cp "$SRC/src/screens/onboarding/CleoOnboarding.tsx"  "$DEST/src/screens/onboarding/"
cp "$SRC/src/screens/curate/AskOnayScreen.tsx"       "$DEST/src/screens/curate/"

echo "==> Copying Expo Router layouts & routes..."
cp "$SRC/app/_layout.tsx"                            "$DEST/app/"
cp "$SRC/app/index.tsx"                              "$DEST/app/"
cp "$SRC/app/(auth)/_layout.tsx"                     "$DEST/app/(auth)/"
cp "$SRC/app/(auth)/login.tsx"                       "$DEST/app/(auth)/"
cp "$SRC/app/(onboarding)/_layout.tsx"               "$DEST/app/(onboarding)/"
cp "$SRC/app/(onboarding)/welcome.tsx"               "$DEST/app/(onboarding)/"
cp "$SRC/app/(onboarding)/music-auth.tsx"            "$DEST/app/(onboarding)/"
cp "$SRC/app/(onboarding)/cleo-setup.tsx"            "$DEST/app/(onboarding)/"
cp "$SRC/app/(main)/_layout.tsx"                     "$DEST/app/(main)/"
cp "$SRC/app/(main)/index.tsx"                       "$DEST/app/(main)/"
cp "$SRC/app/(main)/(broadcast)/_layout.tsx"         "$DEST/app/(main)/(broadcast)/"
cp "$SRC/app/(main)/(broadcast)/index.tsx"           "$DEST/app/(main)/(broadcast)/"
cp "$SRC/app/(main)/(broadcast)/player.tsx"          "$DEST/app/(main)/(broadcast)/"
cp "$SRC/app/(main)/(broadcast)/ask-onay.tsx"        "$DEST/app/(main)/(broadcast)/"
cp "$SRC/app/(main)/(arc)/_layout.tsx"               "$DEST/app/(main)/(arc)/"
cp "$SRC/app/(main)/(arc)/index.tsx"                 "$DEST/app/(main)/(arc)/"
cp "$SRC/app/(main)/(archive)/_layout.tsx"           "$DEST/app/(main)/(archive)/"
cp "$SRC/app/(main)/(archive)/index.tsx"             "$DEST/app/(main)/(archive)/"
cp "$SRC/app/(main)/(cleo)/_layout.tsx"              "$DEST/app/(main)/(cleo)/"
cp "$SRC/app/(main)/(cleo)/index.tsx"                "$DEST/app/(main)/(cleo)/"

echo "==> Copying assets..."
cp "$SRC/assets/icon.png"                            "$DEST/assets/"
cp "$SRC/assets/splash-icon.png"                     "$DEST/assets/"
cp "$SRC/assets/favicon.png"                         "$DEST/assets/"
cp "$SRC/assets/android-icon-foreground.png"         "$DEST/assets/"
cp "$SRC/assets/android-icon-background.png"         "$DEST/assets/"
cp "$SRC/assets/android-icon-monochrome.png"         "$DEST/assets/"
cp "$SRC/assets/textures/grain.png"                  "$DEST/assets/textures/"
cp "$SRC/assets/cleo/onay-frame-1.png"               "$DEST/assets/cleo/"
cp "$SRC/assets/cleo/onay-frame-2.png"               "$DEST/assets/cleo/"
cp "$SRC/assets/cleo/onay-frame-3.png"               "$DEST/assets/cleo/"
cp "$SRC/assets/cleo/onay-animation.mp4"             "$DEST/assets/cleo/"

echo "==> Copying config files..."
cp "$SRC/tsconfig.json"                              "$DEST/"
cp "$SRC/plugins/firebase-modular-headers.js"        "$DEST/plugins/"
cp "$SRC/src/config/featureFlags.ts"                 "$DEST/src/config/"

echo ""
echo "==> Done! Files copied to $DEST"
echo ""
echo "Next steps:"
echo "  1. cd $DEST"
echo "  2. Copy deps from v2-migration/package-ui-deps.json into package.json"
echo "  3. Copy app.json from v2-migration/app-v2.json"
echo "  4. npm install"
echo "  5. Copy stubs from v2-migration/stubs/ into src/ to satisfy imports"
