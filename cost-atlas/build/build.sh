#!/usr/bin/env bash
# Rebuild index.html from a CoST export: ./build/build.sh path/to/AT_xxxx.xlsx
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
python3 "$here/prep.py" "$1" "$here/data.json"
python3 - "$here" <<'PY'
import sys; h=sys.argv[1]
t=open(h+'/template.html').read()
t=t.replace('__DATA__',open(h+'/data.json').read()).replace('__GEO__',open(h+'/provinces_simplified.geojson').read())
open(h+'/../index.html','w').write(t)
PY
rm "$here/data.json"
