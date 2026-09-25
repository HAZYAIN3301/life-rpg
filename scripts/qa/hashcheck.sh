#!/bin/bash
# Usage: scripts/qa/hashcheck.sh <commit> file1 file2 ...   (paths relative to public/)
# Compares the published files on both production domains with the blobs of <commit>.
set -u
commit="$1"; shift
ok=0; bad=0
for f in "$@"; do
  l=$(git show "$commit:public/$f" | shasum -a 256 | cut -d' ' -f1)
  for d in https://satoruapp.com https://life-rpg-production-416a.up.railway.app; do
    r=$(curl -s --max-time 20 "$d/$f" | shasum -a 256 | cut -d' ' -f1)
    if [ "$l" = "$r" ]; then ok=$((ok+1)); else bad=$((bad+1)); echo "MISMATCH $d/$f"; fi
  done
done
echo "match=$ok mismatch=$bad"
