#!/bin/bash
set -e

current_script_dir=$(dirname "$0")
cd "$current_script_dir/.."

# Runs on the `install` npm lifecycle, so it must stay non-fatal on a platform
# with no committed media binaries -- build-extra-bin.mjs warns and exits 0.
node ./extra-work/build-extra-bin.mjs
