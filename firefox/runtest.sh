# Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
# Licensed under GPLv2 or later, see file LICENSE in the xpi for details.

#export NSPR_LOG_MODULES=nsSocketTransport:5
#export NSPR_LOG_MODULES=nsXULTemplateBuilder:5

../../../firefox-debug/dist/bin/run-mozilla.sh ../../../firefox-debug/dist/bin/firefox --no-remote -P greasefire -test $@

#export XPCOM_DEBUG_BREAK=trap
#../../../firefox-debug/dist/bin/run-mozilla.sh ../../../firefox-debug/dist/bin/firefox -g -d gdb --no-remote -P greasefire -test $@
