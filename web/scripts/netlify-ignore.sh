#!/usr/bin/env bash
# Netlify "ignore"-kommando. Koeres fra base directory (web/).
# Exit 0 = spring bygget over, alt andet = byg.
#
# Hvorfor: commits der kun roerer rod-scripts (Python-import, migrations, docs)
# udloeste et fuldt bygge og brugte Netlify-credits uden at aendre sitet.
#
# Sitet afhaenger af web/ OG ../shared (tsconfig-alias @shared/*), saa begge
# skal med. Netlifys standard med base=web ville kun se paa web/ og dermed
# springe aendringer i shared/ over.
#
# Byg altid, naar vi ikke kan afgoere det sikkert:
#  - manuel "Trigger deploy" / createSiteBuild genbygger samme commit
#    (CACHED_COMMIT_REF == COMMIT_REF). Den bruges bevidst, fx efter en
#    shelter-import, fordi detaljesiderne har dynamicParams=false.
#  - mangler en af refs, eller fejler git (exit 128 i shallow clone), bygges der.

set -u

if [ -z "${CACHED_COMMIT_REF:-}" ] || [ -z "${COMMIT_REF:-}" ]; then
  echo "netlify-ignore: mangler commit-refs, bygger"
  exit 1
fi

if [ "$CACHED_COMMIT_REF" = "$COMMIT_REF" ]; then
  echo "netlify-ignore: samme commit som sidst (manuelt bygge), bygger"
  exit 1
fi

git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- . ../shared
status=$?

if [ "$status" -eq 0 ]; then
  echo "netlify-ignore: ingen aendringer i web/ eller shared/, springer over"
  exit 0
fi

if [ "$status" -eq 1 ]; then
  echo "netlify-ignore: aendringer i web/ eller shared/, bygger"
else
  echo "netlify-ignore: git diff fejlede ($status), bygger"
fi
exit 1
