#!/bin/bash

zip \
  greasefire.xpi \
  install.rdf \
  icon.png \
  chrome.manifest \
  components/* \
  defaults/preferences/* \
  chrome/content/* \
  chrome/content/test/* \
  indexes/*

if [[ "test" != "$1" ]]; then
  zip -d greasefire.xpi chrome/content/test/ chrome/content/test/*
fi
