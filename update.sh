#!/bin/sh

DATE=`date -u +"%Y-%m-%dT%H:%M:%SZ"`
DEST="index_$DATE.jar"

# Download scripts
cd /Users/steve/greasefire
java -jar greasefire/java/greasefire-scraper/downloadscripts.jar scripts $1

# Generate indexes into tmp
mkdir tmp
java -Xmx512m -jar greasefire/java/greasefire-scraper/generateindex.jar scripts tmp

# Jar up indexes
cd tmp
echo "[indexes]" > info.ini
echo "date=$DATE" >> info.ini
jar cvfM $DEST include.dat exclude.dat scripts.db info.ini

# Copy indexes to skrul.com
scp ./$DEST skrul@skrul.com:skrul.com/projects/greasefire/indexes

# Clean up tmp
cd ..
rm -r tmp

# Update latest file on skrul.com
ssh skrul@skrul.com "echo $DATE > skrul.com/projects/greasefire/indexes/latest"

# Delete indexes older than a week
ssh skrul@skrul.com "find skrul.com/projects/greasefire/indexes/index_* -type f -mtime 7 -exec rm {} \;"

