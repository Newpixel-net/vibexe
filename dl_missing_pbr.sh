#!/bin/bash
# Download ONLY missing PBR maps (Normal/AO) for textures that already have color maps
DEST=/opt/vibexe/media-stock/games-3d/textures

# Textures with missing PBR maps (from 404 errors in console)
TEXTURES=(Bricks097 WoodFloor040 Ice004 Lava005 Bricks059 Metal034 Ground082S Ground067 Road007 Snow006)

COUNT=0
OK=0
FAIL=0

echo "=== Downloading missing PBR maps ==="

for ID in "${TEXTURES[@]}"; do
  COUNT=$((COUNT + 1))

  # Check which maps are missing
  NEED_DL=0
  for MAP in Normal AO; do
    if [ ! -f "$DEST/${ID}_${MAP}.jpg" ]; then
      NEED_DL=1
      break
    fi
  done

  if [ $NEED_DL -eq 0 ]; then
    echo "[$COUNT] SKIP $ID (all PBR maps present)"
    continue
  fi

  echo "[$COUNT] Downloading $ID PBR maps..."
  cd /tmp
  rm -rf "${ID}.zip" "${ID}_pbr_tmp"
  curl -sL -o "${ID}.zip" "https://ambientcg.com/get?file=${ID}_1K-JPG.zip" 2>/dev/null

  FSIZE=$(stat -c%s "${ID}.zip" 2>/dev/null || stat -f%z "${ID}.zip" 2>/dev/null)
  if [ ! -f "${ID}.zip" ] || [ "$FSIZE" -lt 1024 ]; then
    echo "  FAIL: Download failed for $ID"
    FAIL=$((FAIL + 1))
    rm -f "${ID}.zip"
    continue
  fi

  mkdir -p "${ID}_pbr_tmp"
  unzip -qo "${ID}.zip" -d "${ID}_pbr_tmp" 2>/dev/null

  for MAP in Normal AmbientOcclusion; do
    OUTNAME="${MAP}"
    if [ "$MAP" = "AmbientOcclusion" ]; then OUTNAME="AO"; fi

    if [ -f "$DEST/${ID}_${OUTNAME}.jpg" ]; then
      echo "  SKIP: ${ID}_${OUTNAME}.jpg (exists)"
      continue
    fi

    SRC=$(find "${ID}_pbr_tmp" -name "*_${MAP}.*" 2>/dev/null | head -1)
    if [ -n "$SRC" ]; then
      convert "$SRC" -resize 512x512! -quality 85 "$DEST/${ID}_${OUTNAME}.jpg"
      echo "  OK: ${ID}_${OUTNAME}.jpg"
      OK=$((OK + 1))
    else
      echo "  MISS: No ${MAP} map found in ZIP for $ID"
    fi
  done

  rm -rf "${ID}.zip" "${ID}_pbr_tmp"
done

echo ""
echo "=== DONE ==="
echo "Downloaded: $OK"
echo "Failed: $FAIL"
echo "Checked: $COUNT textures"
