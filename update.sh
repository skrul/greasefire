#!/bin/sh

cleanup () {
  [ -n "$TMPDIR" ] && [ -e "$TMPDIR" ] && rm -rf "$TMPDIR"
}

die () {
  [ -n "$1" ] && echo $1 >&2
  cleanup
  exit 1
}

WORKDIR='/Users/steve/greasefire'
TMPDIR="$WORKDIR/tmp"
SCRAPERDIR="$WORKDIR/greasefire/java/greasefire-scraper"
INDEXES='skrul.com/projects/greasefire/indexes'

DATE=`date -u +"%Y-%m-%dT%H:%M:%SZ"`
DEST="index_$DATE.jar"

# Download scripts
cd "$WORKDIR" || die
java -jar "$SCRAPERDIR/downloadscripts.jar" scripts "$1" || die

# Generate indexes into TMPDIR
mkdir "$TMPDIR" || die
java -Xmx512m -jar "$SCRAPERDIR/generateindex.jar" scripts "$TMPDIR" || die

# Jar up indexes
cd "$TMPDIR" || die
echo "[indexes]" > info.ini
echo "date=$DATE" >> info.ini
jar cvfM "$DEST" include.dat exclude.dat scripts.db info.ini || die

mkdir "$DATE" || die
cp include.png exclude.png "$DATE" || die

[ -n "$DEST" -a -f "./$DEST" ] || die "no $DEST file"
[ -n "$DATE" -a -d "./$DATE" ] || die "no $DATE directory"

# Copy indexes to skrul.com
scp -r ./"$DEST" ./"$DATE" \
   skrul@skrul.com:skrul.com/projects/greasefire/indexes || die

# Update latest file on skrul.com
ssh skrul@skrul.com "echo $DATE > "'"'"$INDEXES"'"'"/latest"

# Delete indexes older than a week
ssh skrul@skrul.com "find "'"'"$INDEXES"'"'"/index_* -type f -mtime 7 -exec rm {} \;"

# # Clean up TMPDIR
cleanup
