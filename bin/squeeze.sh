#!/usr/bin/env bash
while read -r
do
	# Collect referenced scripts.
	[[ $REPLY == *\<script\ src=* ]] && {
		SRC=${REPLY#*src=\"}
		SRC=${SRC%%\"*}
		[ -r "$SRC" ] && {
			SCRIPTS=$SCRIPTS${SCRIPTS:+ }$SRC
			continue
		}
	}
	# Embed scripts.
	[ "$SCRIPTS" ] && {
		echo -n '<script>'
		cat <<EOF | esbuild --minify
"use strict"
$(cat $SCRIPTS | sed "s/['\"]use strict['\"]//")
EOF
		echo -n '</script>'
		SCRIPTS=
	}
	# Remove indent.
	REPLY=${REPLY##*$'\t'}
	# Remove empty lines.
	[ "$REPLY" ] || continue
	# Keep preprocessor statements on a line.
	[[ $REPLY == \#* ]] && {
		echo "$REPLY"
		continue
	}
	echo -n "$REPLY" |
		# Remove blanks.
		sed '
s/\([CLM]\) /\1/g;
s/ {/{/g;
s/, /,/g;
s/: /:/g;
s/; /;/g;
s/;"/"/g;
s/<!--.*-->//g;
s/><\/circle>/\/>/g;
s/><\/ellipse>/\/>/g;
s/><\/line>/\/>/g;
s/><\/path>/\/>/g;
s/><\/polygon>/\/>/g;
s/><\/polyline>/\/>/g;
s/><\/rect>/\/>/g' |
		# Replace `rgb()` with hex annotation.
		awk '{
	s = $0
	for (;;) {
		p = match(s, /rgb[()0-9, ]+/)
		if (p == 0) {
			print s
			break
		}
		printf substr(s, 0, p - 1)
		colors = substr(s, p, RLENGTH)
		s = substr(s, p + RLENGTH)
		if (split(colors, a, ",") == 3) {
			split(a[1], b, "(")
			split(a[3], c, ")")
			red = b[2]
			green = a[2]
			blue = c[1]
			printf "#%02x%02x%02x", red, green, blue
		}
	}
}'
done
