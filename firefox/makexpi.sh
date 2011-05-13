#!/bin/bash

zip \
  greasefire.xpi \
  install.rdf \
  chrome.manifest \
  components/* \
  defaults/preferences/* \
  chrome/content/* \
  chrome/content/test/* \
  indexes/*d

if [[ "test" != "$1" ]]; then
  zip -d greasefire.xpi chrome/content/test/ chrome/content/test/*
fi
