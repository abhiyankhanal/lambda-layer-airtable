build-CommonFunctionsLayer:
		npx esbuild airtable-layer/airtable-client.ts --bundle --platform=node --format=cjs --minify --sourcemap --target=es2020 --outdir=${PWD}/.aws-sam/build/CommonFunctionsLayer/nodejs/airtable-layer
