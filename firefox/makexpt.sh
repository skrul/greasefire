#!/bin/bash
SDK="/Users/skrul/dev/xulrunner-sdk"

$SDK/bin/xpidl \
  -m typelib \
  -w -v \
  -I $SDK/idl \
  -e components/gfIGreasefireService.xpt \
  idl/gfIGreasefireService.idl

$SDK/bin/xpidl \
  -m typelib \
  -w -v \
  -I $SDK/idl \
  -e components/gfIUpdaterService.xpt \
  idl/gfIUpdaterService.idl

$SDK/bin/xpt_link \
  components/greasefire.xpt \
  components/gfIGreasefireService.xpt \
  components/gfIUpdaterService.xpt

rm components/gfIGreasefireService.xpt components/gfIUpdaterService.xpt
