# -*- mode: Makefile -*-
#

REQUIREMENTS := code/requirements.txt

source_files := $(wildcard code/*.py $(REQUIREMENTS))

.PHONY: \
	build \
  clean \
	lint \
  utest \
	itest \

build:

lambda: $(source_files)
	@rm -rf lambda/*
	@mkdir -p lambda/app
	@[ -f $(REQUIREMENTS) ] && pip install --target lambda -r $(REQUIREMENTS) || true
	@cp -r ./code/*.py lambda/app



clean:
	rm -rf lambda

utest:

itest:
	pytest -s

lint:
	echo $(source_files)




