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

Only the upload is faked. Everything before it is the real thing: the dry run
goes through `extra-work/release.sh` unmodified, so the git steps (including the
`release-<version>` tag check, which still aborts the run when the tag is
missing), the dependency install and the full platform pack all happen exactly as
they would in a real release — it is not a sandbox for that half. `extra-work/.env`
must still exist too, though in a dry run its values only show up in log text.

`extra-work/fake-s3/` is git-ignored and is never wiped, so it behaves like the
real bucket: the cumulative `extraBin` map in each platform's `info.json` is read
back from it and merged, exactly as a real release does. Delete the directory by
hand when you want a clean slate.
