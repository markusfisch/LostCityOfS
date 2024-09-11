"use strict"

function Game(renderer) {
	const pointersX = [], pointersY = [], keysDown = [],
		mapCols = 16, mapRows = 128, map = [],
		mapCenterX = mapCols >> 1, mapCenterY = mapRows >> 1,
		entities = [], particles = [], clock = [],
		blockables = [], dust = [],
		shakePattern = [.1, -.4, .7, -.3, .5, .2],
		shakeLength = shakePattern.length,
		shakeDuration = 300,
		dustLife = 150

	let seed = 1, pointers = 0,
		stickX, stickY, stickDelta,
		viewXMin, viewXMax, viewYMin, viewYMax,
		lookX = mapCols >> 1, lookY = mapRows - 4,
		shakeUntil = 0,
		start = Date.now(), cursed = 0,
		now, warp, last = start

	// Prevent pinch/zoom on iOS 11.
	if ('ontouchstart' in document) {
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

	function spawnDust(x, y) {
		for (let i = dust.length; i--; ) {
			const d = dust[i]
			if (d.alive < now) {
				d.alive = now + dustLife
				d.x = x + (Math.random() - .5) / 2
				d.y = y + Math.random() / 2
				break
			}
		}
	}

	function moveBy(e, x, y) {
		if (!(e.moving = Math.abs(x) + Math.abs(y) > 0)) {
			return
		}
		const nx = Math.min(mapCols - 1, Math.max(e.x + x, 0)),
			ny = Math.min(mapRows - 1, Math.max(e.y + y, 0)),
			mx = Math.round(nx),
			my = Math.ceil(ny)
		/*for (let i = blockables.length; i--; ) {
			const b = blockables[i]
			if (Math.abs(b.x - nx) < .1 &&
					Math.abs(b.y - ny) < .1) {
				return
			}
		}*/
		if (map[my * mapCols + mx] == 13) {
			return
		}
		e.x = nx
		e.y = ny
		e.dx = x < 0 ? -1 : 1
		spawnDust(nx, ny)
	}

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
			pointersX[i] = (2 * pointersX[i]) / renderer.width - 1
			pointersY[i] = 1 - (2 * pointersY[i]) / renderer.height
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
		stickX = pointersX[0]
		stickY = pointersY[0]
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

	document.onkeyup = function(event) {
		keysDown[event.keyCode] = false
	}
	document.onkeydown = function(event) {
		keysDown[event.keyCode] = true
	}

	function input() {
		const max = .05 * warp
		let x = 0, y = 0
		if (keysDown[37] || keysDown[72]) {
			x -= max
		}
		if (keysDown[39] || keysDown[76]) {
			x += max
		}
		if (keysDown[38] || keysDown[75]) {
			y -= max
		}
		if (keysDown[40] || keysDown[74]) {
			y += max
		}
		if (cursed && (x || y) && Math.random() < .5) {
			x += (Math.random() - .5) * .5
			y += (Math.random() - .5) * .5
		}
		if (pointers) {
			const dx = stickX - pointersX[0],
				dy = stickY - pointersY[0]
			stickDelta = dx*dx + dy*dy
			x = -Math.max(-max, Math.min(dx * warp, max))
			y = Math.max(-max, Math.min(dy * warp, max))
		}
		moveBy(player, x, y)
	}

	function random() {
		// http://indiegamr.com/generate-repeatable-random-numbers-in-js/
		return (seed = (seed * 9301 + 49297) % 233280) / 233280
	}

	function cr() {
		return random() - .5
	}

	// Create map.
	for (let y = 0, i = 0; y < mapRows; ++y) {
		for (let x = 0; x < mapCols; ++x, ++i) {
			//const sprite = random() < .2 ? 13 : 12
			map[i] = 12 //sprite
		}
	}

	// Create map.
	for (let i = 0; i < 1000; ++i) {
		entities.push({
			x: mapCenterX + cr() * mapCols,
			y: (mapRows - 32) + random() * 32,
			dx: random() > .5 ? 1 : -1,
			update: () => 11
		})
	}
	for (let i = 0; i < 100; ++i) {
		entities.push({
			x: mapCenterX + cr() * mapCols,
			y: mapCenterY + cr() * mapRows,
			dx: random() > .5 ? 1 : -1,
			update: () => 14
		})
	}
	for (let i = 0; i < 100; ++i) {
		entities.push({
			x: mapCenterX + cr() * mapCols,
			y: mapCenterY + cr() * mapRows,
			dx: random() > .5 ? 1 : -1,
			update: () => 15
		})
	}

	// Create enemies.
	for (let i = 0, y = -6; i < 10; ++i, y -= 2) {
		const vx = i % 2 ? .01 : -.01
		entities.push({
			x: mapCenterX + cr() * 3,
			y: mapRows + y,
			vx: vx,
			vy: 0,
			update: function() {
				const dx = player.x - this.x,
					dy = player.y - this.y
				if (dx*dx + dy*dy < .5) {
					shakeUntil = now + shakeDuration
				}
				this.x += this.vx * warp
				if (Math.abs(this.x - mapCenterX) > 4) {
					this.x = mapCenterX + (this.x > mapCenterX ? 4 : -4)
					this.vx = -this.vx
				}
				this.dx = vx > 0 ? 1 : -1
				let frame = 8 + Math.round((now % 5000) / 100) % 5
				if (frame >= 11) {
					frame -= 2
					this.dx = -this.dx
				}
				return frame
			}
		})
	}

	// Create player.
	const player = {
		x: lookX,
		y: lookY,
		moving: false,
		update: function() {
			/*return 3 + (this.moving
					? 1 + Math.round((now % 300) / 100) % 3
					: Math.round((now % 1000) / 500) % 2)*/
			return 3
		}
	}
	entities.push(player)

	// Create dust.
	for (let i = 0; i < 16; ++i) {
		dust.push({alive: 0})
	}

	// Create particles.
	for (let i = 0; i < 16; ++i) {
		particles.push({
			vx: .002 + Math.random() * .002,
			vy: .002 + Math.random() * .002,
			update: function() {
				if (this.x === undefined) {
					this.x = -renderer.viewX + (Math.random() - .5) * 2
					this.y = renderer.viewY + (Math.random() - .5) * 2
				}
				this.x += this.vx * warp
				this.y += this.vy * warp
				const rx = this.x + renderer.viewX,
					ry = this.y - renderer.viewY
				if (Math.abs(rx) > 1.1) {
					this.x = -renderer.viewX - 1.1
				}
				if (Math.abs(ry) > 1.1) {
					this.y = renderer.viewY - 1.1
				}
				return 2
			}
		})
	}

	window.onresize = function() {
		renderer.resize()

		const x2 = renderer.xscale / 2, y2 = renderer.yscale / 2
		viewXMin = -1 + x2
		viewXMax = -mapCols * renderer.xscale + 1 + x2
		viewYMin = 1 - y2
		viewYMax = mapRows * renderer.yscale - 1 - y2

		// Update clock geometry.
		clock.length = 0
		const aspect = renderer.width / renderer.height,
			xr = .1, yr = xr * aspect,
			cx = 1 - xr - xr / 2, cy = 1 - yr - yr / 2
		for (let i = 13, a = Math.PI / 2, step = Math.PI * 2 / 13;
				i--; a -= step) {
			const x = cx + Math.cos(a) * xr,
				y = cy + Math.sin(a) * yr
			clock.push({
				x: x,
				y: y
			})
		}
	}
	window.onresize()

	function clamp(value, min, max) {
		return Math.min(Math.max(value, min), max)
	}

	function compareY(a, b) {
		return b.y - a.y
	}

	function run() {
		requestAnimationFrame(run)

		now = Date.now()
		warp = Math.min(2, (now - last) / 16)
		last = now

		const elapsed = (now - start) / 1000,
				elapsedMod13 = elapsed % 13
		cursed = elapsed < 3 ? 0 : 1 - Math.min(elapsedMod13, 1) / 1

		const shaking = shakeUntil > now
		if (!shaking) {
			input()
		}

		// Animate view to player position.
		const px = player.x, py = player.y,
			dx = lookX - px, dy = lookY - py
		if (dx*dx + dy*dy > .0001) {
			lookX = lookX * .9 + px * .1
			lookY = lookY * .9 + py * .1
		}

		// Shake view.
		const xscale = renderer.xscale,
			yscale = renderer.yscale
		let vx = clamp(-lookX * xscale, viewXMax, viewXMin),
			vy = clamp(lookY * yscale, viewYMin, viewYMax),
			r = 1, g = 1, b = 1
		if (shaking) {
			const power = (shakeUntil - now) / shakeDuration,
				shakePower = power * .05
			vx += shakePattern[(now + 1) % shakeLength] * shakePower
			vy += shakePattern[now % shakeLength] * shakePower
			g = b = 1 - power
		}
		renderer.viewX = vx
		renderer.viewY = vy

		// Push Map.
		{
			const l = Math.max(0, Math.floor((viewXMin - vx) / xscale)),
				r = Math.min(mapCols, l + Math.ceil(2 / xscale) + 1),
				t = Math.max(0, Math.floor((vy - viewYMin) / yscale)),
				b = Math.min(mapRows, t + Math.ceil(2 / yscale) + 1),
				skip = mapCols - (r - l)
			for (let i = t * mapCols + l, y = t; y < b; ++y, i += skip) {
				for (let x = l; x < r; ++x, ++i) {
					renderer.push(map[i], x * xscale, -y * yscale)
				}
			}
		}

		// Push dust.
		for (let i = dust.length; i--; ) {
			const e = dust[i]
			if (e.alive > now) {
				const s = (e.alive - now) / dustLife
				renderer.push(2,
					e.x * xscale,
					-e.y * yscale,
					s, s)
			}
		}

		// Push entities.
		entities.sort(compareY)
		for (let i = entities.length; i--; ) {
			const e = entities[i]
			renderer.push(e.update(),
					e.x * xscale,
					-e.y * yscale,
					e.dx, e.dy)
		}

		// Push particles.
		for (let i = particles.length; i--; ) {
			const e = particles[i]
			renderer.push(e.update(), e.x, -e.y)
		}

		if (cursed) {
			const power = 1 + cursed * .5
			r *= power
			g *= power
			b *= power
		}

		// Push time.
		for (let i = 0; i < elapsedMod13; ++i) {
			const e = clock[i]
			renderer.push(1, e.x - vx, e.y - vy)
		}

		// Virtual touch stick.
		if (pointers) {
			let size = clamp(1 - stickDelta / .05, .1, 1)
			renderer.push(0, -vx + stickX, -vy + stickY, size, size)
			renderer.push(0, -vx + pointersX[0], -vy + pointersY[0])
		}

		renderer.render(r, g, b)
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

	//gl.clearColor(.38, .952, .56, 1) // DEBUG
	gl.clearColor(0, 0, 0, 1)

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

		// Unwrapped for speed.
		let i = idx * elementsPerVertex

		bufferData[i++] = x1
		bufferData[i++] = y1
		bufferData[i++] = l
		bufferData[i++] = t

		bufferData[i++] = x2
		bufferData[i++] = y2
		bufferData[i++] = r
		bufferData[i++] = t

		bufferData[i++] = x3
		bufferData[i++] = y3
		bufferData[i++] = l
		bufferData[i++] = b

		bufferData[i++] = x2
		bufferData[i++] = y2
		bufferData[i++] = r
		bufferData[i++] = t

		bufferData[i++] = x3
		bufferData[i++] = y3
		bufferData[i++] = l
		bufferData[i++] = b

		bufferData[i++] = x4
		bufferData[i++] = y4
		bufferData[i++] = r
		bufferData[i++] = b
	}

	let verts = 0, x2, y2
	return {
		xscale: 0,
		yscale: 0,
		resize: function() {
			this.width = gl.canvas.clientWidth
			this.height = gl.canvas.clientHeight

			gl.canvas.width = this.width
			gl.canvas.height = this.height
			gl.viewport(0, 0, this.width, this.height)

			this.xscale = .2
			this.yscale = this.xscale * (this.width / this.height)

			x2 = this.xscale / 2
			y2 = this.yscale / 2

			verts = 0
		},
		push: function(sprite, x, y, h, v) {
			const fx = x + this.viewX, fy = y + this.viewY
			if (fx < -1.5 || fy > 1.5 || fx > 1.5 || fy < -1.5) {
				// Skip out of view sprites.
				return
			}
			const size = atlas.sizes[sprite], sy = size[1]
			h = (h || 1) * size[0]
			v = (v || 1) * sy
			if (sy > 1) {
				// Align taller sprites to the default base line
				// so depth comparison works.
				y += (sy - 1) * y2
			}
			setQuad(
				verts,
				sprite,
				// 0---1
				// |  /|
				// | o |
				// |/  |
				// 2---3
				x - x2 * h, y + y2 * v,
				x + x2 * h, y + y2 * v,
				x - x2 * h, y - y2 * v,
				x + x2 * h, y - y2 * v
			)
			verts += 6
		},
		render: function(r, g, b) {
			gl.uniform2f(camLoc, this.viewX, this.viewY)
			gl.uniform4f(moodLoc, r, g, b, 1)
			gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.DYNAMIC_DRAW)
			gl.clear(gl.COLOR_BUFFER_BIT)
			gl.drawArrays(gl.TRIANGLES, 0, verts)
			verts = 0
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
