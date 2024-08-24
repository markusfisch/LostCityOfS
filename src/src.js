"use strict"

let centerX, centerY, hasTouch

function transform(x, y, size, deg) {
	return `translate(${
		centerX - 50 + (x || 0)}px, ${
		centerY - 50 + (y || 0)}px) rotateZ(${
		deg || 0}deg) scale(${size || 1})`
}

function set(e, x, y, size, deg) {
	size = size || 1
	// Transform origin at runtime to keep sprite coordinates in the
	// 0-99 range. If the source is centered at 0/0, there are minus
	// signs that make the values a tiny bit worse to compress.
	e.style.transformOrigin = "50px 50px"
	e.style.transform = `translate(${
		centerX - 50 + (x || 0)}px, ${
		centerY - 50 + (y || 0)}px) rotateZ(${
		deg || 0}deg) scale(${size})`
}

function clone(e, x, y, size, deg) {
	const c = e.cloneNode(true)
	c.id = null
	set(c, x, y, size, deg)
	return c
}

function show() {
	S.innerHTML = ""
	S.appendChild(clone(Plane))
	for (let i = 1000; i-- > 0;) {
		const size = .5,
			x = Math.round(Math.random() * 100) - centerX,
			y = Math.round(Math.random() * 100) - centerY,
			e = clone(Grass, x, y, size, -22),
			origin = e.style.transform
		e.animate(
			[
				{transform: origin},
				{transform: transform(x, y, size, 22)},
				{transform: origin},
			], {
				duration: 5000,
				fill: "forwards",
				iterations: Infinity,
			}
		).play()
		S.appendChild(e)
	}
}

function resize() {
	const windowWidth = window.innerWidth,
		windowHeight = window.innerHeight,
		min = Math.min(windowWidth, windowHeight),
		ratio = min / 100,
		stageWidth = windowWidth / ratio,
		stageHeight = windowHeight / ratio

	centerX = stageWidth >> 1
	centerY = stageHeight >> 1

	const style = S.style
	style.width = stageWidth + "px"
	style.height = stageHeight + "px"
	style.transformOrigin = "top left"
	style.transform = `scale(${ratio})`
	style.display = "block"

	show()
}

window.onload = function() {
	// Prevent pinch/zoom on iOS 11.
	if ((hasTouch = 'ontouchstart' in document)) {
		document.addEventListener('gesturestart', function(event) {
			event.preventDefault()
		}, false)
		document.addEventListener('gesturechange', function(event) {
			event.preventDefault()
		}, false)
		document.addEventListener('gestureend', function(event) {
			event.preventDefault()
		}, false)
	}
	window.onresize = resize
	resize()
}
