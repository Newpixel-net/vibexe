#!/bin/bash
# Download PBR maps (Roughness, AO) + upgrade to 2K resolution for terrain textures
# Target: Ground037, Grass004, Rock035, Snow006
DEST=/opt/vibexe/media-stock/games-3d/textures

TEXTURES=(Ground037 Grass004 Rock035 Snow006)

COUNT=0
OK=0
FAIL=0

echo "=== Terrain PBR Texture Upgrade ==="
echo "Downloading 2K diffuse + 1K normal + roughness + AO maps"
echo ""

for ID in "${TEXTURES[@]}"; do
  COUNT=$((COUNT + 1))
  echo "[$COUNT/${#TEXTURES[@]}] Processing $ID..."

  cd /tmp
  rm -rf "${ID}.zip" "${ID}_pbr_tmp"

  # Download 2K-JPG package from ambientCG
  curl -sL -o "${ID}.zip" "https://ambientcg.com/get?file=${ID}_2K-JPG.zip" 2>/dev/null

  FSIZE=$(stat -c%s "${ID}.zip" 2>/dev/null || stat -f%z "${ID}.zip" 2>/dev/null)
  if [ ! -f "${ID}.zip" ] || [ "$FSIZE" -lt 1024 ]; then
    echo "  WARN: 2K download failed, trying 1K..."
    curl -sL -o "${ID}.zip" "https://ambientcg.com/get?file=${ID}_1K-JPG.zip" 2>/dev/null
    FSIZE=$(stat -c%s "${ID}.zip" 2>/dev/null || stat -f%z "${ID}.zip" 2>/dev/null)
    if [ ! -f "${ID}.zip" ] || [ "$FSIZE" -lt 1024 ]; then
      echo "  FAIL: Download failed for $ID"
      FAIL=$((FAIL + 1))
      rm -f "${ID}.zip"
      continue
    fi
  fi

  mkdir -p "${ID}_pbr_tmp"
  unzip -qo "${ID}.zip" -d "${ID}_pbr_tmp" 2>/dev/null

  echo "  Files in ZIP:"
  ls -la "${ID}_pbr_tmp"/ 2>/dev/null | head -10

  # Map names: ambientCG uses Color, NormalGL, Roughness, AmbientOcclusion, Displacement
  declare -A MAP_NAMES
  MAP_NAMES=(
    [Color]=""
    [NormalGL]="_Normal"
    [Roughness]="_Roughness"
    [AmbientOcclusion]="_AO"
  )

  for SRC_NAME in Color NormalGL Roughness AmbientOcclusion; do
    OUT_SUFFIX="${MAP_NAMES[$SRC_NAME]}"
    OUT_FILE="${DEST}/${ID}${OUT_SUFFIX}.jpg"

    # Find the source file in the extracted ZIP
    SRC=$(find "${ID}_pbr_tmp" -name "*_${SRC_NAME}.*" 2>/dev/null | head -1)

    if [ -z "$SRC" ]; then
      echo "  MISS: No ${SRC_NAME} map in ZIP"
      continue
    fi

    # Determine target resolution: 2048 for Color, 1024 for PBR maps
    if [ "$SRC_NAME" = "Color" ]; then
      RES="2048x2048"
    else
      RES="1024x1024"
    fi

    # Convert to target resolution
    if command -v convert &>/dev/null; then
      convert "$SRC" -resize "${RES}!" -quality 90 "$OUT_FILE"
      echo "  OK: ${ID}${OUT_SUFFIX}.jpg (${RES})"
      OK=$((OK + 1))
    else
      # No ImageMagick — just copy
      cp "$SRC" "$OUT_FILE"
      echo "  OK: ${ID}${OUT_SUFFIX}.jpg (original size, no ImageMagick)"
      OK=$((OK + 1))
    fi
  done

  rm -rf "${ID}.zip" "${ID}_pbr_tmp"
  echo ""
done

echo "=== DONE ==="
echo "Processed: $COUNT textures"
echo "Files created/updated: $OK"
echo "Failed: $FAIL"
