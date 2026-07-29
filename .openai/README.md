# Sites packaging

FieldCore's TanStack/Nitro build writes browser assets to `.output/public`.
When packaging for Sites, copy the contents of that directory to the deployment
root so URLs such as `/assets/styles.css` resolve correctly.
