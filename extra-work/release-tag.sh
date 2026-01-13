#!/bin/bash

current_script_dir=$(dirname "$0")
cd "$current_script_dir/.."
pwd

package_version=$(node -p "require('./package.json').version")
tag="release-$package_version"
echo "Adding git tag: $tag"
read -p "Do you want to continue? (y/n): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Tagging process aborted."
    exit 1
fi

git tag "$tag"
git push origin "$tag"

echo "Tag $tag added and pushed successfully."
