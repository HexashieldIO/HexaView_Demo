set -e
cd /c/Users/Marc/Documents/GitHub/HexaView_Demo/promo-video
mkdir -p "out/HexaView TAFA Healthcare"
npx remotion render src/index.ts HexaViewTafaHealthcare out/_hc/raw.mp4 --codec=h264 --crf=18 --log=error
node scripts-master.mjs out/_hc/raw.mp4 "out/HexaView TAFA Healthcare/HexaView_TAFA_Singapore_Healthcare.mp4" 2>/dev/null
echo ALL-DONE
