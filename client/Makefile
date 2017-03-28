all:
	yarn
	node_modules/.bin/webpack
.PHONY: test
test:
	npm test

watch-test:
	NODE_ENV=test node_modules/.bin/karma start
