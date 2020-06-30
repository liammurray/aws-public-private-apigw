# -*- mode: Makefile -*-
#
# Include file used to build projects with package.json
#
# Runs "npm run build" if any source file is out of date.
#


source_files := $(wildcard code/*.py)

.PHONY: \
	build \
  clean \
	lint \
  utest \
  develop \

build:

clean:
	rm -rf lambda

utest:

itest:

lint:

# For lambda functions
lambda: code
	rm -rf ./lambda
	@mkdir -p "$(dir $@)"
	pip install --target ./lambda -r ./code/requirements.txt
	cp -r ./code/*.py ./lambda


