"use strict"

let seed = 1
function random() {
	// http://indiegamr.com/generate-repeatable-random-numbers-in-js/
	return (seed = (seed * 9301 + 49297) % 233280) / 233280
}
