"use strict"

let ctx, hasTouch, objects

function render() {
	requestAnimationFrame(render)
	const now = Date.now()
	ctx.fillStyle = "rgb(40, 160, 140)"
	ctx.fillRect(0, 0, ctx.width, ctx.height)
	for (let i = 0; i < 1000; ++i) {
		const o = objects[i]
		ctx.save()
		ctx.translate(o.x, o.y)
		ctx.rotate(Math.sin(now * .001))
		ctx.fillStyle = "#fff"
		ctx.beginPath()
		ctx.moveTo(0, -40)
		ctx.lineTo(-10, 0)
		ctx.lineTo(10, 0)
		ctx.fill()
		ctx.restore()
	}
}

function resize() {
	const windowWidth = window.innerWidth,
		windowHeight = window.innerHeight,
		canvas = document.getElementById("C")

	if (!ctx) {
		ctx = canvas.getContext("2d")
		ctx.ratio = (window.devicePixelRatio || 1) /
			(ctx.webkitBackingStorePixelRatio ||
				ctx.mozBackingStorePixelRatio ||
				ctx.msBackingStorePixelRatio ||
				ctx.oBackingStorePixelRatio ||
				ctx.backingStorePixelRatio ||
				1)
	}
	ctx.width = Math.round(windowWidth * ctx.ratio)
	ctx.height = Math.round(windowHeight * ctx.ratio)

	canvas.width = ctx.width
	canvas.height = ctx.height
	canvas.style.width = windowWidth + "px"
	canvas.style.height = windowHeight + "px"

	objects = []
	for (let i = 0; i < 1000; ++i) {
		objects.push({
			x: Math.round(Math.random() * canvas.width),
			y: Math.round(Math.random() * canvas.height),
		})
	}
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
	render()
}
