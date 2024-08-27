"use strict"

function loadAtlas(onload) {
	function svgToImg(svg, sw, sh, dw, dh) {
		const img = new Image()
		img.src = `data:image/svg+xml;base64,${btoa(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${
			sw} ${sh}" width="${dw}" height="${dh}">${svg}</svg>`)}`
		return img
	}

	// Packing algorithm from:
	// http://www.blackpawn.com/texts/lightmaps/default.html
	function atlasInsert(node, w, h) {
		if (node.l) {
			// Try to insert image into left and then into right node.
			return atlasInsert(node.l, w, h) || atlasInsert(node.r, w, h)
		}
		if (node.img) {
			// Node already has an image.
			return
		}
		const rc = node.rc,
			rw = rc.r - rc.l,
			rh = rc.b - rc.t
		if (rw < w || rh < h) {
			// Node is too small.
			return
		}
		if (rw == w && rh == h) {
			// Node fits exactly.
			return node
		}
		// Put image into node and split the remaining space into two
		// new nodes.
		node.l = {}
		node.r = {}
		if (rw - w > rh - h) {
			// +-------+---+
			// | image |   |
			// +-------+   |
			// |       | l |
			// |   r   |   |
			// |       |   |
			// +-------+---+
			node.l.rc = {
				l: rc.l + w,
				t: rc.t,
				r: rc.r,
				b: rc.b
			}
			node.r.rc = {
				l: rc.l,
				t: rc.t + h,
				r: rc.l + w,
				b: rc.b,
			}
		} else {
			// +-------+---+
			// | image | l |
			// +-------+---+
			// |           |
			// |     r     |
			// |           |
			// +-----------+
			node.l.rc = {
				l: rc.l + w,
				t: rc.t,
				r: rc.r,
				b: rc.t + h,
			}
			node.r.rc = {
				l: rc.l,
				t: rc.t + h,
				r: rc.r,
				b: rc.b,
			}
		}
		// Fit rectangle to image.
		node.rc.r = rc.l + w - 1
		node.rc.b = rc.t + h - 1
		return node
	}

	function createAtlas(sources) {
		const atlasSize = 1024,
			svgSize = 100,
			tileSize = 128,
			scale = tileSize / svgSize,
			border = 1,
			uvPixel = 1 / atlasSize,
			pad = (border + 2) * uvPixel,
			nodes = {rc: {l: 0, t: 0, r: atlasSize, b: atlasSize}},
			coords = [],
			canvas = document.createElement('canvas'),
			ctx = canvas.getContext('2d'),
			len = sources.length
		canvas.width = canvas.height = atlasSize
		canvas.pending = len
		for (let i = 0; i < len; ++i) {
			const src = sources[i],
				fm = (src.split('<')[0].trim() + ';').split(';'),
				size = fm[0].split('x'),
				sw = size[0] || svgSize,
				sh = size[1] || svgSize,
				dw = sw * scale | 0,
				dh = sh * scale | 0,
				node = atlasInsert(nodes, dw + border * 2, dh + border * 2)
			if (!node) {
				return
			}
			const rc = node.rc,
				l = rc.l * uvPixel,
				t = rc.t * uvPixel,
				r = l + dw * uvPixel,
				b = t + dh * uvPixel
			// A--C
			// | /|
			// |/ |
			// B--D
			coords.push(
				l + pad, t + pad,
				l + pad, b - pad,
				r - pad, t + pad,
				r - pad, b - pad,
			)
			node.img = svgToImg(src, sw, sh, dw, dh).onload = function() {
				const angle = fm[1] * Math.PI / 180,
					x = node.rc.l + border,
					y = node.rc.t + border,
					w2 = dw >> 1,
					h2 = dh >> 1
				if (angle > 0) {
					ctx.save()
					ctx.translate(x + w2, y + h2)
					ctx.rotate(angle)
					ctx.drawImage(this, -w2, -h2)
					ctx.restore()
				} else {
					ctx.drawImage(this, x, y)
				}
				--canvas.pending
			}
		}
		return {
			canvas: canvas,
			coords: coords
		}
	}

	function waitForAtlas(atlas) {
		if (atlas.canvas.pending > 0) {
			setTimeout(function() {
				waitForAtlas(atlas)
			}, 100)
		} else {
			onload(atlas)
		}
	}

	const sources = [],
		gs = document.getElementsByTagName('g')
	for (let i = 0, l = gs.length; i < l; ++i) {
		sources.push(gs[i].innerHTML)
	}
	waitForAtlas(createAtlas(sources))
}

function Renderer(atlas) {
	let camLoc, verts, xscale, yscale, xrad, yrad

	const elementsPerVertex = 4,
		nudge = .5 / atlas.canvas.width,
		bufferData = new Float32Array(1024 * 64 * elementsPerVertex),
		gl = document.getElementById('C').getContext('webgl')

	;(function() {
		gl.enable(gl.BLEND)
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
		gl.clearColor(0.15, 0.62, 0.54, 1)

		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())

		const tx = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, tx)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
			atlas.canvas)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
		gl.generateMipmap(gl.TEXTURE_2D)
		gl.activeTexture(gl.TEXTURE0)
		gl.bindTexture(gl.TEXTURE_2D, tx)

		const program = gl.createProgram()
		function compileShader(type, src) {
			const shader = gl.createShader(type)
			gl.shaderSource(shader, src)
			gl.compileShader(shader)
			return shader
		}
		gl.attachShader(program, compileShader(gl.VERTEX_SHADER,
			document.getElementById('VertexShader').textContent))
		gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER,
			document.getElementById('FragmentShader').textContent))
		gl.linkProgram(program)
		gl.useProgram(program)

		camLoc = gl.getUniformLocation(program, 'c')

		function enableVertexAttrib(name, count, size, offset) {
			const loc = gl.getAttribLocation(program, name)
			gl.enableVertexAttribArray(loc)
			gl.vertexAttribPointer(loc, count, gl.FLOAT, false,
				size * 4, offset * 4)
		}
		enableVertexAttrib('v', 2, elementsPerVertex, 0)
		enableVertexAttrib('t', 2, elementsPerVertex, 2)
	})()

	function setQuad(
		idx,
		sprite,
		x1, y1,
		x2, y2,
		x3, y3,
		x4, y4
	) {
		const offset = sprite << 3,
			l = atlas.coords[offset] + nudge,
			t = atlas.coords[offset + 1] + nudge,
			r = atlas.coords[offset + 6] - nudge,
			b = atlas.coords[offset + 7] - nudge
		bufferData.set([
			x1, y1, l, t,
			x2, y2, r, t,
			x3, y3, l, b,
			x2, y2, r, t,
			x3, y3, l, b,
			x4, y4, r, b,
		], idx * elementsPerVertex)
	}

	return {
		width: 0,
		height: 0,
		resize: function() {
			this.width = gl.canvas.clientWidth
			this.height = gl.canvas.clientHeight

			gl.canvas.width = this.width
			gl.canvas.height = this.height
			gl.viewport(0, 0, this.width, this.height)

			xscale = .2
			yscale = xscale * (this.width / this.height)

			xrad = xscale * .5
			yrad = yscale * .5
		},
		beginFrame: function() {
			verts = 0
		},
		pushSprite: function(sprite, x, y) {
			x *= xscale
			y *= yscale
			setQuad(
				verts,
				sprite,
				// 0---1
				// |  /|
				// | o |
				// |/  |
				// 2---3
				x - xrad, y + yrad,
				x + xrad, y + yrad,
				x - xrad, y - yrad,
				x + xrad, y - yrad
			)
			verts += 6
		},
		render: function(x, y) {
			gl.uniform2f(camLoc, x, y)
			gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.DYNAMIC_DRAW)
			gl.clear(gl.COLOR_BUFFER_BIT)
			gl.drawArrays(gl.TRIANGLES, 0, verts)
		}
	}
}

function Game(atlas) {
	const hasTouch = 'ontouchstart' in document,
		renderer = Renderer(atlas)

	// Prevent pinch/zoom on iOS 11.
	if (hasTouch) {
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

	window.onresize = renderer.resize
	renderer.resize()

	const entities = []
	for (let i = 0; i < 1000; ++i) {
		const sprite = i % 2
		entities.push({
			sprite: sprite,
			x: Math.random() * 10 - 5,
			y: Math.random() * 10 - 5,
			vx: sprite ? .01 : 0,
			vy: sprite ? 0 : .01,
		})
	}

	function compareY(a, b) {
		if (a.y > b.y) {
			return -1
		} else if (a.y < b.y) {
			return 1
		}
		return 0
	}

	let last = 0, warp
	function pushEntities() {
		const now = Date.now()
		warp = (now - last) / 16
		last = now
		entities.sort(compareY)
		for (let i = entities.length; i-- > 0;) {
			const e = entities[i]
			e.x = (((e.x + e.vx * warp) + 5) % 10) - 5
			e.y = (((e.y + e.vy * warp) + 5) % 10) - 5
			renderer.pushSprite(e.sprite, e.x, -e.y)
		}
	}

	function run() {
		requestAnimationFrame(run)
		renderer.beginFrame()
		pushEntities()
		renderer.render(0, 0)
	}
	run()
}

window.onload = function() {
	loadAtlas(Game)
}
