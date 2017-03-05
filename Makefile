.ONESHELL:
all:
	cd client/
	yarn
	node_modules/.bin/webpack
	cd ..
test:
	cd client/
	npm test
