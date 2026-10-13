set -e
cd /c/Users/Marc/Documents/GitHub/HexaView_Demo/promo-video
R=out/_render
for pair in "HexaViewPromo:HexaView video/HexaView.io.mp4" "HexaViewCyberDockside:HexaView video/HexaView_CyberDockside.mp4" "HexaViewPromoBritish:HexaView video/HexaView.io_British.mp4" "HexaViewCyberDocksideBritish:HexaView video/HexaView_CyberDockside_British.mp4" "HexaViewLinkedInSquare:HexaView LinkedIn/HexaView_LinkedIn.mp4"; do
  comp=${pair%%:*}; dst=${pair#*:}
  echo "== $comp"
  npx remotion render src/index.ts "$comp" "$R/$comp.mp4" --codec=h264 --crf=18 --log=error
  node scripts-master.mjs "$R/$comp.mp4" "out/$dst" 2>/dev/null
done
echo ALL-DONE
