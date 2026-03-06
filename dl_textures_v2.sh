#!/bin/bash
# Downloads 200 NEW textures from ambientCG (Color 1024px + PBR maps 512px)
# Runs in batches to avoid overloading server
DEST=/opt/vibexe/media-stock/games-3d/textures
mkdir -p "$DEST"

TEXTURES=(
  # Ground +15
  Ground055 Ground069 Ground078 Gravel036 Gravel023 Gravel042 Sand005 Sand002 Ground046 Ground082 Ground067 Ground079 Grass009 Ground042 Ground044
  # Stone +15
  Rock064 Rock065 Rock052 PavingStones151 PavingStones139 PavingStones143 Rock040 Rock041 Rock045 PavingStones130 PavingStones135 Rock033 Rock036 PavingStones136 PavingStones137
  # Brick +15
  Bricks098 Bricks103 Bricks076 Bricks086 Bricks093 PaintedBricks001 Bricks074 Bricks083 Bricks070 Bricks068 Bricks071 Bricks090 Bricks088 Bricks096 Bricks091
  # Wood +20
  Wood095 Wood093 Wood052 Planks021 Planks033 WoodSiding011 Bark009 Wood054 Wood056 Wood062 WoodFloor046 WoodFloor048 WoodFloor052 Planks024 Planks030 WoodSiding009 Wood063 Wood064 Bark007 Wood070
  # Metal +25
  Metal054 Metal055B Metal047 CorrugatedSteel005 DiamondPlate008 PaintedMetal010 Rust004 Metal033 Metal034 Metal035 Metal036 Metal037 Metal038 Metal039 Metal040 Metal042 Metal043 Metal044 Metal045 Metal051 Metal052 Metal056 Metal057 Metal058 Metal060
  # Concrete +15
  Concrete049 Concrete035 Concrete047B Plaster004 Plaster007 PaintedPlaster013 Concrete033 Concrete037 Concrete038 Concrete039 Concrete040 Concrete041 Plaster005 Plaster006 Concrete043
  # Tiles +20
  Tiles139 Tiles108 Tiles134 Terrazzo007 Terrazzo003 GlazedTerracotta001 Tiles095 Tiles096 Tiles097 Tiles098 Tiles100 Tiles101 Tiles102 Tiles103 Tiles106 Tiles110 Tiles111 Tiles112 Tiles113 Tiles115
  # Fabric +20
  Fabric084 Fabric085 Leather039 Leather041 Carpet008 Carpet012 Wicker002 Fabric032 Fabric035 Fabric040 Fabric045 Fabric050 Fabric055 Fabric060 Fabric062 Fabric064 Fabric068 Fabric070 Leather035 Leather036
  # Nature +15
  Snow016 Snow017 Ice004 Moss005 Leaf003 ScatteredLeaves001 Grass010 Snow010 Snow011 Ice003 Moss003 Moss004 Snow012 Ice005 Leaf004
  # Marble +20
  Marble013 Marble017 Marble023 Granite004 Granite008 Onyx006 Travertine005 Marble014 Marble015 Marble018 Marble019 Marble020 Marble021 Marble022 Granite005 Granite006 Granite007 Travertine006
  # Road +10
  Asphalt026 Asphalt019 Asphalt030 Road007 Road003 TactilePaving004 Asphalt020 Asphalt022 Asphalt024 Road005
  # Special +10
  ChristmasTreeOrnament007 Lava005 Lava003 Chainmail004 DiamondPlate010 Rust008 Rust005 Rust006 Lava004 ChristmasTreeOrnament003
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

  if [ ! -f "${ID}.zip" ] || [ ! -s "${ID}.zip" ]; then
    echo "  FAIL: Download failed for $ID"
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
