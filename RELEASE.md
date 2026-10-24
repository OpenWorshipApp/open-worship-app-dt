## How to Release

```bash
npm run release:version
npm run release:tag
# Run on all platforms
npm run release
```

## Dry Run

```bash
npm run release:dry-run
```

Runs the exact same pipeline as `npm run release`, except every object that would
be uploaded is written into `extra-work/fake-s3/` (that directory stands in for
the bucket root, so an object lands at its verbatim S3 key,
e.g. `extra-work/fake-s3/www/download/win/info.json`) and the CloudFront
invalidation is skipped.

The upload is faked and git is left alone: a dry run does not check that the
work tree is clean, asks nothing and does not reset to the `release-<version>`
tag, so it packs whatever is checked out. The dependency install (skipped with
`RELEASE_SKIP_INSTALL=true`) and the full platform pack run exactly as they
would in a real release — it is not a sandbox for that half. `extra-work/.env`
is not needed: a missing or incomplete one is only a warning, because a dry run
never reaches AWS.

`extra-work/fake-s3/` is git-ignored and is never wiped, so it behaves like the
real bucket: the cumulative `extraBin` map in each platform's `info.json` is read
back from it and merged, exactly as a real release does. Delete the directory by
hand when you want a clean slate.
