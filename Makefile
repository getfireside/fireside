.ONESHELL:
all:
	cd client/
	npm install -C .
	node_modules/.bin/webpack
	cd ..
test:
	cd client/
	npm test
