"use strict"

function Game(renderer) {
	const hasTouch = 'ontouchstart' in document

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

	const pointersX = [0], pointersY = [0]
	let pointers = 0
	function setPointer(event, down) {
		const touches = event.touches
		if (touches) {
			pointers = touches.length
			for (let i = pointers; i--;) {
				const t = touches[i]
				pointersX[i] = t.pageX
				pointersY[i] = t.pageY
			}
		} else if (!down) {
			pointers = 0
		} else {
			pointers = 1
			pointersX[0] = event.pageX
			pointersY[0] = event.pageY
		}

		// Map to WebGL coordinates.
		for (let i = pointers; i--;) {
			pointersX[i] = (2 * pointersX[i]) / renderer.w - 1
			pointersY[i] = 1 - (2 * pointersY[i]) / renderer.h
		}

		event.stopPropagation()
	}

	function pointerCancel(event) {
		pointers = 0
	}

	function pointerUp(event) {
		setPointer(event, 0)
	}

	function pointerMove(event) {
		setPointer(event, pointers)
	}

	function pointerDown(event) {
		setPointer(event, 1)
	}

	const keysDown = []
	document.onkeyup = function(event) {
		keysDown[event.keyCode] = false
	}
	document.onkeydown = function(event) {
		keysDown[event.keyCode] = true
	}

	document.onmousedown = pointerDown
	document.onmousemove = pointerMove
	document.onmouseup = pointerUp
	document.onmouseout = pointerCancel

	document.ontouchstart = pointerDown
	document.ontouchmove = pointerMove
	document.ontouchend = pointerUp
	document.ontouchleave = pointerCancel
	document.ontouchcancel = pointerCancel

	function input() {
		const step = .05 * warp
		let x = 0, y = 0
		if (keysDown[37] || keysDown[72]) {
			x = -step
		}
		if (keysDown[39] || keysDown[76]) {
			x = step
		}
		if (keysDown[38] || keysDown[75]) {
			y = -step
		}
		if (keysDown[40] || keysDown[74]) {
			y = step
		}
		if (keysDown[32]) {
			shake()
		}
		player.x += x
		player.y += y
		player.x = Math.min(mapCols - 1, Math.max(player.x, 0))
		player.y = Math.min(mapRows - 1, Math.max(player.y, 0))
	}

	const mapCols = 32, mapRows = 32, map = []
	function pushMap() {
		map.length = 0
		for (let y = 0, i = 0; y < mapRows; ++y) {
			for (let x = 0; x < mapCols; ++x, ++i) {
				map[i] = (x + y) % 2
				renderer.p(map[i], x, -y)
			}
		}
		renderer.m()
	}

	const entities = [], centerX = mapCols >> 1, centerY = mapRows >> 1
	for (let i = 0; i < 10; ++i) {
		const sprite = i % 2
		entities.push({
			sprite: 2 + sprite,
			x: centerX + Math.random() * mapCols - centerX,
			y: centerY + Math.random() * mapRows - centerY,
			vx: sprite ? .01 : 0,
			vy: sprite ? 0 : .01,
			dx: Math.random() > .5 ? 1 : -1,
			dy: 1,
			update: function() {
				this.x += this.vx * warp
				this.y += this.vy * warp
				this.x %= mapCols
				this.y %= mapRows
			}
		})
	}
	const player = {
		sprite: 4,
		x: centerX,
		y: centerY,
		vx: 0,
		vy: 0,
		dx: 1,
		dy: 1,
		update: function() {}
	}
	entities.push(player)

	let viewXMin, viewXMax, viewYMin, viewYMax
	window.onresize = function() {
		renderer.s()

		viewXMin = -1 + renderer.u
		viewXMax = -mapCols * renderer.x + 1 + renderer.u
		viewYMin = 1 - renderer.v
		viewYMax = mapRows * renderer.y - 1 - renderer.v

		pushMap()
	}
	window.onresize()

	function compareY(a, b) {
		return b.y - a.y
	}

	let last = 0, warp, lookX = player.y, lookY = player.x
	function run() {
		requestAnimationFrame(run)

		const now = Date.now()
		warp = (now - last) / 16
		last = now

		input()

		entities.sort(compareY)
		for (let i = entities.length; i-- > 0;) {
			const e = entities[i]
			e.update()
			renderer.p(e.sprite, e.x, -e.y, e.dx, e.dy)
		}

		const dx = lookX - player.x,
			dz = lookY - player.y,
			d = dx*dx + dz*dz
		if (d > .01) {
			lookX = lookX * .9 + player.x * .1
			lookY = lookY * .9 + player.y * .1
		}
		let vx = -lookX * renderer.x,
			vy = lookY * renderer.y
		vx = Math.min(Math.max(vx, viewXMax), viewXMin),
		vy = Math.min(Math.max(vy, viewYMin), viewYMax)
		renderer.r(vx, vy)
	}
	run()
}

function Renderer(atlas) {
	const elementsPerVertex = 4,
		bufferData = new Float32Array(1024 * 64 * elementsPerVertex),
		gl = document.getElementById('C').getContext('webgl'),
		tx = gl.createTexture(),
		program = gl.createProgram()

	gl.enable(gl.BLEND)
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1)

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())

	gl.bindTexture(gl.TEXTURE_2D, tx)
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
		atlas.canvas)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
	gl.generateMipmap(gl.TEXTURE_2D)
	gl.activeTexture(gl.TEXTURE0)
	gl.bindTexture(gl.TEXTURE_2D, tx)

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

	function enableVertexAttrib(name, count, size, offset) {
		const loc = gl.getAttribLocation(program, name)
		gl.enableVertexAttribArray(loc)
		gl.vertexAttribPointer(loc, count, gl.FLOAT, false,
			size * 4, offset * 4)
	}
	enableVertexAttrib('v', 2, elementsPerVertex, 0)
	enableVertexAttrib('t', 2, elementsPerVertex, 2)

	const camLoc = gl.getUniformLocation(program, 'c'),
		moodLoc = gl.getUniformLocation(program, 'm'),
		nudge = .5 / atlas.canvas.width

	gl.clearColor(0, 0, 0, 1)
	gl.uniform4f(moodLoc, 1, 1, 1, 1)

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

	let verts = 0
	return {
		// One letter keys because esbuild won't compress these.
		w: 0,
		h: 0,
		x: 0,
		y: 0,
		u: 0,
		v: 0,
		s: function() {
			this.w = gl.canvas.clientWidth
			this.h = gl.canvas.clientHeight

			gl.canvas.width = this.w
			gl.canvas.height = this.h
			gl.viewport(0, 0, this.w, this.h)

			this.x = .2
			this.y = this.x * (this.w / this.h)

			this.u = this.x * .5
			this.v = this.y * .5

			verts = 0
		},
		m: function() {
			this.base = verts
		},
		p: function(sprite, x, y, h, v) {
			h = h || 1
			v = v || 1
			const size = atlas.sizes[sprite]
			h *= size[0]
			v *= size[1]
			x *= this.x
			y *= this.y
			const xr = this.u, yr = this.v
			setQuad(
				verts,
				sprite,
				// 0---1
				// |  /|
				// | o |
				// |/  |
				// 2---3
				x - xr * h, y + yr * v,
				x + xr * h, y + yr * v,
				x - xr * h, y - yr * v,
				x + xr * h, y - yr * v
			)
			verts += 6
		},
		r: function(x, y) {
			gl.uniform2f(camLoc, x, y)
			gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.DYNAMIC_DRAW)
			gl.clear(gl.COLOR_BUFFER_BIT)
			gl.drawArrays(gl.TRIANGLES, 0, verts)
			verts = this.base
		}
	}
}

window.onload = function() {
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
			sizes = [],
			canvas = document.createElement('canvas'),
			ctx = canvas.getContext('2d'),
			len = sources.length
		canvas.width = canvas.height = atlasSize
		canvas.pending = len
		for (let i = 0; i < len; ++i) {
			const src = sources[i],
				size = src.split('<')[0].trim().split('x'),
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
			sizes.push([dw / tileSize, dh / tileSize])
			node.img = svgToImg(src, sw, sh, dw, dh).onload = function() {
				ctx.drawImage(this,
					node.rc.l + border,
					node.rc.t + border)
				--canvas.pending
			}
		}
		return {
			canvas: canvas,
			coords: coords,
			sizes: sizes
		}
	}

	function waitForAtlas(atlas) {
		if (atlas.canvas.pending > 0) {
			setTimeout(function() {
				waitForAtlas(atlas)
			}, 100)
		} else {
			Game(Renderer(atlas))
		}
	}

	const sources = [],
		gs = document.getElementsByTagName('g')
	for (let i = 0, l = gs.length; i < l; ++i) {
		sources.push(gs[i].innerHTML)
	}
	waitForAtlas(createAtlas(sources))
}
