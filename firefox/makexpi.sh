#!/bin/bash
zip \
  greasefire.xpi \
  install.rdf \
  chrome.manifest \
  components/* \
  defaults/preferences/* \
  chrome/content/* \
  indexes/*
