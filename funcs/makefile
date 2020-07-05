# -*- mode: Makefile -*-
#

SELF_DIR := $(dir $(lastword $(MAKEFILE_LIST)))

.PHONY: \
	lambda \
	clean \
	test \
	lint

FUNCS_DIR ?= ./

SHELL=/usr/bin/env bash -o pipefail

# Locate makefiles under $FUNCS_DIR
makefiles = $(shell export GLOBIGNORE=".$(FUNCS_DIR)/ignore/.*" ; echo $(FUNCS_DIR)/*/makefile)
subdirs := $(foreach proj,$(makefiles),$(dir $(proj)))

list:
	@echo -------Funcs-----------
	@for dir in $(subdirs); do echo $$dir ; done
	@echo -------Targets-----------
	@(make -qp || true) | grep -v '^list$$' | awk -F':' '/^[a-zA-Z0-9][^$$#\/\t=]*:([^=]|$$)/ {split($$1,A,/ /);for(i in A)print A[i]}' | sort


lambda:
	@for dir in $(subdirs); do \
		echo Building lambda: [$$(basename $$dir)]; \
		$(MAKE) -C $$dir lambda; \
	 done

clean:
	@for dir in $(subdirs); do \
		$(MAKE) -C $$dir clean; \
	 done

test:
	@set -e; for dir in $(subdirs); do \
		npm run utest; \
	 done

lint:
	@set -e; for dir in $(subdirs); do \
		cd $$dir; \
		npm run lint; \
	 done


