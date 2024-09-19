# Lambda layer for common functions

## Summary

This is Lambda layer is intended to share common airtables.

## Build

Navigate to the base directory and install require node modules.
`npm install --omit=dev`  
`npm install esbuild --location=global` (one-off)  
`$ sam build`

## Deployment

`$ sam deploy --stack-name <stack-name> --profile <profile-name> --region <region> --parameter-overrides Env=<String that gets added to the layer name> --resolve-s3`

