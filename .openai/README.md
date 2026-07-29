# Sites packaging

FieldCore's TanStack/Nitro build writes browser assets to `.output/public`.
When packaging for Sites, preserve that directory for Nitro and mirror its
contents into `dist/client`, the static asset root used by Sites.
