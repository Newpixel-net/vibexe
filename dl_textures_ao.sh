#!/bin/bash
# Downloads AO (Ambient Occlusion) maps for existing 100 textures
# Only downloads if AO map doesn't exist yet
DEST=/opt/vibexe/media-stock/games-3d/textures
mkdir -p "$DEST"

TEXTURES=(Ground103 Ground104 Ground037 Ground054 Ground080 Ground068 Ground085 Ground048 Ground102 Ground093C Grass005 Grass001 Grass004 Grass008 Grass006 Rock063 Rock058 Rock060 Rock051 Rock035 Rock061 Rock020 Rock030 Rock050 Rock062 PavingStones150 PavingStones138 PavingStones142 PavingStones128 PavingStones146 Bricks102 Bricks101 Bricks097 Bricks075A Bricks085 Bricks092 Bricks094 Bricks060 Bricks066 Bricks059 Bricks084 Bricks100 Wood094 Wood092 Wood051 Wood066 Wood049 Wood058 Wood067 Wood060 Wood048 WoodFloor051 WoodFloor064 WoodFloor070 WoodFloor071 WoodFloor043 WoodFloor040 Metal049A Metal055A Metal046B Metal048A Metal061B Metal032 Metal041A Metal053C Metal050A Metal046A Concrete048 Concrete047A Concrete034 Concrete046 Concrete042A Concrete031 Concrete030 Concrete044D Concrete036 Concrete032 Tiles138 Tiles107 Tiles133A Tiles132A Tiles040 Tiles078 Tiles074 Tiles131 Tiles052 Tiles093 Fabric083 Fabric081C Fabric061 Fabric066 Fabric030 Fabric082A Leather037 Leather038 Snow015 Snow014 Snow013 Marble012 Marble016)

TOTAL=${#TEXTURES[@]}
COUNT=0
SKIP=0

echo "=== Downloading AO maps for $TOTAL textures ==="

for ID in "${TEXTURES[@]}"; do
  COUNT=$((COUNT + 1))
  if [ -f "$DEST/${ID}_AO.jpg" ]; then
    SKIP=$((SKIP + 1))
    echo "[$COUNT/$TOTAL] SKIP $ID (AO exists)"
    continue
  fi

  echo "[$COUNT/$TOTAL] Checking AO for $ID..."
  cd /tmp
  curl -sL -o "${ID}.zip" "https://ambientcg.com/get?file=${ID}_1K-JPG.zip" 2>/dev/null

  if [ ! -f "${ID}.zip" ] || [ ! -s "${ID}.zip" ]; then
    echo "  SKIP: No download for $ID"
    rm -f "${ID}.zip"
    continue
  fi

  mkdir -p "${ID}_tmp"
  unzip -qo "${ID}.zip" -d "${ID}_tmp" 2>/dev/null

  AO=$(find "${ID}_tmp" -name "*_AmbientOcclusion.*" 2>/dev/null | head -1)
  if [ -n "$AO" ]; then
    convert "$AO" -resize 512x512! -quality 85 "$DEST/${ID}_AO.jpg"
    echo "  OK: ${ID}_AO.jpg"
  else
    echo "  INFO: No AO map available for $ID"
  fi

  rm -rf "${ID}.zip" "${ID}_tmp"
done

echo ""
echo "=== DONE ==="
echo "Processed: $COUNT"
echo "Skipped: $SKIP"
echo "AO files:"
ls -1 "$DEST"/*_AO.jpg 2>/dev/null | wc -l
