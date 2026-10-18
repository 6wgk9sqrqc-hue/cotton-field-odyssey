import os, sys, glob
from fontTools.ttLib import TTFont
src = sys.argv[1]; dst = os.path.expanduser("~/.local/share/fonts/vid"); os.makedirs(dst, exist_ok=True)
want = {"audiowide-latin-400": "VAudiowide", "exo-2-latin-700": "VExo2 Bold", "exo-2-latin-800": "VExo2 XB",
        "exo-2-latin-900": "VExo2 Black", "nunito-latin-800": "VNunito XB", "nunito-latin-900": "VNunito Black",
        "share-tech-mono-latin-400": "VShareTech", "orbitron-latin-700": "VOrbitron Bold", "orbitron-latin-900": "VOrbitron Black"}
for key, fam in want.items():
    f = glob.glob(f"{src}/*/package/files/{key}-normal.woff2")[0]
    t = TTFont(f); t.flavor = None
    for rec in t["name"].names:
        if rec.nameID in (1, 16): rec.string = fam
        elif rec.nameID in (2, 17): rec.string = "Regular"
        elif rec.nameID == 4: rec.string = fam
        elif rec.nameID == 6: rec.string = fam.replace(" ", "")
    t["OS/2"].usWeightClass = 400
    t.save(os.path.join(dst, fam.replace(" ", "") + ".ttf")); print("ok", fam)
