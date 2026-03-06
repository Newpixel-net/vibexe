#!/bin/bash
# Downloads NEW textures from ambientCG (Color 1024px + PBR maps 512px)
# Runs in batches to avoid overloading server
# v2.1: Fixed IDs with proper ambientCG suffixes
DEST=/opt/vibexe/media-stock/games-3d/textures
mkdir -p "$DEST"

TEXTURES=(
  # Ground
  Ground105 Ground069 Ground078 Ground086 Gravel023 Gravel042 Ground046 Ground082S Ground067 Ground079S Ground042 Ground044
  # Stone
  Rock029 Rock057 Rock052 PavingStones139 PavingStones143 Rock040 Rock041 Rock045 PavingStones130 PavingStones135 Rock033 Rock036 PavingStones136 PavingStones137
  # Brick
  Bricks098 Bricks103 Bricks076A Bricks086 Bricks093 PaintedBricks001 Bricks074 Bricks083 Bricks070 Bricks068 Bricks071 Bricks090 Bricks088 Bricks096 Bricks091
  # Wood
  Bark014 Wood093 Wood052 Planks021 Planks033A WoodSiding011 Bark009 Wood054 Wood056 Wood062 WoodFloor046 WoodFloor048 WoodFloor052 Planks024A Planks030A WoodSiding009 Wood063 Wood064 Bark007 Wood070
  # Metal
  Metal054A Metal055B Metal047A CorrugatedSteel005 DiamondPlate008A PaintedMetal010 Rust004 Metal033 Metal034 Metal035 Metal036 Metal037 Metal038 Metal039 Metal040 Metal042A Metal043A Metal044A Metal045A Metal051A Metal052A Metal056A Metal057A Metal058A Metal060A
  # Concrete
  Concrete045 Concrete035 Concrete047B Plaster004 Plaster007 PaintedPlaster013 Concrete033 Concrete037 Concrete038 Concrete039 Concrete040 Concrete041B Plaster005 Plaster006 Concrete044C
  # Tiles
  Tiles105 Tiles108 Tiles075 Terrazzo007 Terrazzo003 GlazedTerracotta001 Tiles095 Tiles096 Tiles097 Tiles098 Tiles100 Tiles101 Tiles102 Tiles103 Tiles106 Tiles110 Tiles111 Tiles112 Tiles113 Tiles115
  # Fabric
  Fabric036 Fabric019 Leather039 Leather030 Carpet008 Carpet012 Wicker002 Fabric032 Fabric035 Fabric040 Fabric045 Fabric050 Fabric055 Fabric060 Fabric062 Fabric064 Fabric068 Fabric070 Leather035D Leather034C
  # Nature
  Snow006 Snow008A Ice004 Leaf003 ScatteredLeaves001 Snow010A Snow011 Ice003 Moss003 Moss004 Snow012
  # Marble
  Marble013 Marble017 Marble023 Granite004A Granite007A Onyx006 Travertine005 Marble014 Marble015 Marble018 Marble019 Marble020 Marble021 Marble022 Granite005A Granite006A Granite007B Travertine006
  # Road
  Asphalt026C Asphalt019 Asphalt030 Road007 Road003 TactilePaving004 Asphalt020L Asphalt022 Asphalt024A Road005
  # Special
  ChristmasTreeOrnament007 Lava005 Lava003 Chainmail004 DiamondPlate009 Rust008 Rust005 Rust006 Lava004 ChristmasTreeOrnament003
)

TOTAL=${#TEXTURES[@]}
BATCH=25
COUNT=0
SKIP=0
FAIL=0

echo "=== Downloading $TOTAL new textures ==="

for ID in "${TEXTURES[@]}"; do
  COUNT=$((COUNT + 1))
  if [ -f "$DEST/${ID}.jpg" ]; then
    SKIP=$((SKIP + 1))
    echo "[$COUNT/$TOTAL] SKIP $ID"
    continue
  fi

  echo "[$COUNT/$TOTAL] Downloading $ID..."
  cd /tmp
  curl -sL -o "${ID}.zip" "https://ambientcg.com/get?file=${ID}_1K-JPG.zip" 2>/dev/null

  # Validate download: must exist, be non-empty, AND be >1KB (tiny files = 404/error)
  if [ ! -f "${ID}.zip" ] || [ ! -s "${ID}.zip" ]; then
    echo "  FAIL: Download failed for $ID"
    FAIL=$((FAIL + 1))
    rm -f "${ID}.zip"
    continue
  fi
  FSIZE=$(stat -c%s "${ID}.zip" 2>/dev/null || stat -f%z "${ID}.zip" 2>/dev/null)
  if [ "$FSIZE" -lt 1024 ]; then
    echo "  FAIL: Invalid ZIP for $ID (${FSIZE} bytes - likely 404)"
    FAIL=$((FAIL + 1))
    rm -f "${ID}.zip"
    continue
  fi

  mkdir -p "${ID}_tmp"
  unzip -qo "${ID}.zip" -d "${ID}_tmp" 2>/dev/null

  # Color map → 1024x1024
  COLOR=$(find "${ID}_tmp" -name "*_Color.*" -o -name "*_Diffuse.*" 2>/dev/null | head -1)
  if [ -n "$COLOR" ]; then
    convert "$COLOR" -resize 1024x1024! -quality 85 "$DEST/${ID}.jpg"
    echo "  OK: ${ID}.jpg (1024px)"
  else
    echo "  WARN: No color map for $ID"
    FAIL=$((FAIL + 1))
  fi

  # PBR data maps → 512x512
  for MAP in Normal Roughness Metalness AmbientOcclusion; do
    OUTNAME="${MAP}"
    if [ "$MAP" = "AmbientOcclusion" ]; then OUTNAME="AO"; fi
    SRC=$(find "${ID}_tmp" -name "*_${MAP}.*" 2>/dev/null | head -1)
    if [ -n "$SRC" ]; then
      convert "$SRC" -resize 512x512! -quality 85 "$DEST/${ID}_${OUTNAME}.jpg"
      echo "  OK: ${ID}_${OUTNAME}.jpg"
    fi
  done

  rm -rf "${ID}.zip" "${ID}_tmp"

  # Batch pause every 25 textures
  if [ $((COUNT % BATCH)) -eq 0 ] && [ $COUNT -lt $TOTAL ]; then
    echo "--- Batch pause (2s) ---"
    sleep 2
  fi
done

echo ""
echo "=== DONE ==="
echo "Downloaded: $((COUNT - SKIP - FAIL))"
echo "Skipped: $SKIP"
echo "Failed: $FAIL"
echo "Total files in textures dir:"
ls -1 "$DEST"/*.jpg 2>/dev/null | wc -l
