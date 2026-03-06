#!/bin/bash
# Downloads color maps + PBR maps for existing 100 textures
# Color maps: 1024x1024, PBR data maps: 512x512
DEST=/opt/vibexe/media-stock/games-3d/textures
mkdir -p "$DEST"
TEXTURES=(Ground103 Ground104 Ground037 Ground054 Ground080 Ground068 Ground085 Ground048 Ground102 Ground093C Grass005 Grass001 Grass004 Grass008 Grass006 Rock063 Rock058 Rock060 Rock051 Rock035 Rock061 Rock020 Rock030 Rock050 Rock062 PavingStones150 PavingStones138 PavingStones142 PavingStones128 PavingStones146 Bricks102 Bricks101 Bricks097 Bricks075A Bricks085 Bricks092 Bricks094 Bricks060 Bricks066 Bricks059 Bricks084 Bricks100 Wood094 Wood092 Wood051 Wood066 Wood049 Wood058 Wood067 Wood060 Wood048 WoodFloor051 WoodFloor064 WoodFloor070 WoodFloor071 WoodFloor043 WoodFloor040 Metal049A Metal055A Metal046B Metal048A Metal061B Metal032 Metal041A Metal053C Metal050A Metal046A Concrete048 Concrete047A Concrete034 Concrete046 Concrete042A Concrete031 Concrete030 Concrete044D Concrete036 Concrete032 Tiles138 Tiles107 Tiles133A Tiles132A Tiles040 Tiles078 Tiles074 Tiles131 Tiles052 Tiles093 Fabric083 Fabric081C Fabric061 Fabric066 Fabric030 Fabric082A Leather037 Leather038 Snow015 Snow014 Snow013 Marble012 Marble016)
for ID in "${TEXTURES[@]}"; do
  if [ -f "$DEST/${ID}.jpg" ] && [ -f "$DEST/${ID}_Normal.jpg" ]; then
    echo "SKIP $ID (already complete)"
    continue
  fi
  echo "Downloading $ID..."
  cd /tmp
  curl -sL -o "${ID}.zip" "https://ambientcg.com/get?file=${ID}_1K-JPG.zip"
  mkdir -p "${ID}_tmp"
  unzip -qo "${ID}.zip" -d "${ID}_tmp" 2>/dev/null
  # Color map → 1024x1024
  COLOR=$(find "${ID}_tmp" -name "*_Color.*" -o -name "*_Diffuse.*" 2>/dev/null | head -1)
  if [ -n "$COLOR" ]; then
    convert "$COLOR" -resize 1024x1024! -quality 85 "$DEST/${ID}.jpg"
    echo "  OK: ${ID}.jpg (1024px)"
  else
    echo "  WARN: No color map for $ID"
  fi
  # PBR data maps → 512x512
  for MAP in Normal Roughness Metalness AmbientOcclusion Displacement; do
    OUTNAME="${MAP}"
    if [ "$MAP" = "AmbientOcclusion" ]; then OUTNAME="AO"; fi
    SRC=$(find "${ID}_tmp" -name "*_${MAP}.*" 2>/dev/null | head -1)
    if [ -n "$SRC" ]; then
      convert "$SRC" -resize 512x512! -quality 85 "$DEST/${ID}_${OUTNAME}.jpg"
      echo "  OK: ${ID}_${OUTNAME}.jpg"
    fi
  done
  rm -rf "${ID}.zip" "${ID}_tmp"
done
echo "Done! Total files:"
ls -1 "$DEST"/*.jpg 2>/dev/null | wc -l
