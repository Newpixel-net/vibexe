#!/bin/bash
# Download PBR maps (Normal, Roughness, Metalness) for all ambientCG textures.
# Run on server via WHM terminal. Downloads 1K ZIPs, extracts + resizes to 512x512.
# Safe to re-run — skips textures that already have Normal maps.

DEST=/opt/vibexe/media-stock/games-3d/textures
mkdir -p "$DEST"

TEXTURES=(Ground103 Ground104 Ground037 Ground054 Ground080 Ground068 Ground085 Ground048 Ground102 Ground093C Grass005 Grass001 Grass004 Grass008 Grass006 Rock063 Rock058 Rock060 Rock051 Rock035 Rock061 Rock020 Rock030 Rock050 Rock062 PavingStones150 PavingStones138 PavingStones142 PavingStones128 PavingStones146 Bricks102 Bricks101 Bricks097 Bricks075A Bricks085 Bricks092 Bricks094 Bricks060 Bricks066 Bricks059 Bricks084 Bricks100 Wood094 Wood092 Wood051 Wood066 Wood049 Wood058 Wood067 Wood060 Wood048 WoodFloor051 WoodFloor064 WoodFloor070 WoodFloor071 WoodFloor043 WoodFloor040 Metal049A Metal055A Metal046B Metal048A Metal061B Metal032 Metal041A Metal053C Metal050A Metal046A Concrete048 Concrete047A Concrete034 Concrete046 Concrete042A Concrete031 Concrete030 Concrete044D Concrete036 Concrete032 Tiles138 Tiles107 Tiles133A Tiles132A Tiles040 Tiles078 Tiles074 Tiles131 Tiles052 Tiles093 Fabric083 Fabric081C Fabric061 Fabric066 Fabric030 Fabric082A Leather037 Leather038 Snow015 Snow014 Snow013 Marble012 Marble016)

TOTAL=${#TEXTURES[@]}
COUNT=0
SKIPPED=0

for ID in "${TEXTURES[@]}"; do
  COUNT=$((COUNT + 1))

  # Skip if Normal map already exists (means PBR was already downloaded)
  if [ -f "$DEST/${ID}_Normal.jpg" ]; then
    SKIPPED=$((SKIPPED + 1))
    echo "[$COUNT/$TOTAL] SKIP $ID (PBR maps exist)"
    continue
  fi

  echo "[$COUNT/$TOTAL] Downloading PBR maps for $ID..."
  cd /tmp

  # Download 1K ZIP from ambientCG
  curl -sL -o "${ID}_pbr.zip" "https://ambientcg.com/get?file=${ID}_1K-JPG.zip"

  mkdir -p "${ID}_pbr_tmp"
  unzip -qo "${ID}_pbr.zip" -d "${ID}_pbr_tmp" 2>/dev/null

  # Extract Normal map (OpenGL format = NormalGL for Three.js)
  NORMAL=$(find "${ID}_pbr_tmp" -name "*_NormalGL.*" 2>/dev/null | head -1)
  if [ -z "$NORMAL" ]; then
    # Fallback to any Normal map if NormalGL not available
    NORMAL=$(find "${ID}_pbr_tmp" -name "*_Normal.*" 2>/dev/null | head -1)
  fi
  if [ -n "$NORMAL" ]; then
    convert "$NORMAL" -resize 512x512! -quality 85 "$DEST/${ID}_Normal.jpg"
    echo "  Normal: OK"
  else
    echo "  Normal: not found"
  fi

  # Extract Roughness map
  ROUGHNESS=$(find "${ID}_pbr_tmp" -name "*_Roughness.*" 2>/dev/null | head -1)
  if [ -n "$ROUGHNESS" ]; then
    convert "$ROUGHNESS" -resize 512x512! -quality 85 "$DEST/${ID}_Roughness.jpg"
    echo "  Roughness: OK"
  else
    echo "  Roughness: not found"
  fi

  # Extract Metalness map (only metals have this)
  METALNESS=$(find "${ID}_pbr_tmp" -name "*_Metalness.*" 2>/dev/null | head -1)
  if [ -n "$METALNESS" ]; then
    convert "$METALNESS" -resize 512x512! -quality 85 "$DEST/${ID}_Metalness.jpg"
    echo "  Metalness: OK"
  else
    echo "  Metalness: n/a (non-metal)"
  fi

  # Cleanup
  rm -rf "${ID}_pbr.zip" "${ID}_pbr_tmp"
done

echo ""
echo "=== PBR Download Complete ==="
echo "Total textures: $TOTAL"
echo "Skipped (already had PBR): $SKIPPED"
echo "Normal maps:"
ls -1 "$DEST"/*_Normal.jpg 2>/dev/null | wc -l
echo "Roughness maps:"
ls -1 "$DEST"/*_Roughness.jpg 2>/dev/null | wc -l
echo "Metalness maps:"
ls -1 "$DEST"/*_Metalness.jpg 2>/dev/null | wc -l
