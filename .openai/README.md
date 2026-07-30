# Sites packaging

FieldCore's TanStack/Nitro build writes browser assets to `.output/public`.
When packaging for Sites, preserve the server output and mirror the public
assets into `dist/client`, the static asset root used by Sites.
