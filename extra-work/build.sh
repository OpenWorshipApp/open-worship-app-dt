#!/bin/bash
set -e

current_script_dir=$(dirname "$0")
cd "$current_script_dir/.."

# Runs on the `install` npm lifecycle, so it must stay non-fatal on a platform
# with no committed media binaries -- build-extra-bin.mjs warns and exits 0.
node ./extra-work/build-extra-bin.mjs

# A language's own dependencies (its song plugin) live in its own folder, so
# the app's install puts them there too -- typecheck and its tests read them.
# Non-fatal for the same reason: the plugin build installs them again, loudly.
node ./extra-work/install-lang-deps.mjs --warn-only
