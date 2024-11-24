"use strict"

function Game(renderer) {
	const hasTouch = 'ontouchstart' in document,
		pointersX = [], pointersY = [], keysDown = [],
		mapCols = 16, mapRows = 128, map = [], nodes = [],
		mapCenterX = mapCols >> 1, mapCenterY = mapRows >> 1,
		entities = [], particles = [], clock = [],
		blockables = [], dust = [], pain = [],
		threatLevel = 4,
		message = document.getElementById('M'),
		shakePattern = [.1, -.4, .7, -.3, .5, .2],
		shakeLength = shakePattern.length,
		shakeDuration = 300,
		dustLife = 150

	let pointers = 0,
		stickX, stickY, stickDelta, sayId = 0,
		viewXMin, viewXMax, viewYMin, viewYMax,
		lookX = mapCols >> 1, lookY = mapRows - 4,
		start = Date.now(), cursed = 0, cease = 0,
		shakeUntil = 0, fadeIn = start, fadeOut = 0,
		now, warp, last = start, finish = 0

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

	function say(what, after) {
		const text = what.shift()
		message.innerHTML = text
		message.style.display = "block"
		clearTimeout(sayId)
		sayId = setTimeout(() => {
			if (what.length < 1) {
				message.style.display = "none"
				after && after()
			} else {
				say(what, after)
			}
		}, 1000 + 200 * text.split(' ').length)
	}
	say([
		"In search of the lost city of S,",
		"S for superstition,",
		"where exactly that was invented,",
		"as legend has it. And to this day,",
		"a mishap happens here every 13 seconds.",
		"Head north and be careful!",
	])

	function spawn(what, a, en, x, y) {
		if (now - en.lastSpawn < 50) {
			return
		}
		en.lastSpawn = now
		for (let i = a.length; i--; ) {
			const e = a[i]
			if (e.alive < now) {
				e.sprite = what
				e.alive = now + dustLife
				e.x = x + (Math.random() - .5) / 2
				e.y = y + (Math.random() - .5) / 2
				break
			}
		}
	}

	function offset(x, y) {
		return Math.round(y) * mapCols + Math.round(x)
	}

	function canMoveTo(e, x, y) {
		x = Math.round(x)
		y = Math.round(y)
		const cell = nodes[offset(e.x, e.y)]
		if (cell.x == x && cell.y == y) {
			return 1
		}
		const neighbors = cell.neighbors
		for (let i = neighbors.length; i--; ) {
			const n = neighbors[i]
			if (n.x == x && n.y == y) {
				return 1
			}
		}
		return 0
	}

	function blocks(x, y) {
		return map[offset(x, y)] & 128
	}

	function clamp(value, min, max) {
		return Math.min(Math.max(value, min), max)
	}

	function isWater(x, y) {
		const tile = map[offset(x, y)]
		return tile >= 22 && tile < 26
	}

	function moveTo(e, tx, ty, speed) {
		if (e.stunned > now) {
			return
		}
		let dx = tx - e.x, dy = ty - e.y
		if (!(e.moving = Math.abs(dx) + Math.abs(dy) > 0)) {
			return
		}
		const f = Math.min(1, speed * warp / Math.sqrt(dx*dx + dy*dy))
		let x = clamp(e.x + dx * f, 0, mapCols - 1),
			y = clamp(e.y + dy * f, 0, mapRows - 1)
		if (e === player) {
			cease = 0
			if ((blocks(x, y) || !canMoveTo(e, x, y))) {
				if (!blocks(x, e.y) && canMoveTo(e, x, e.y)) {
					y = e.y
				} else if (!blocks(e.x, y) && canMoveTo(e, e.x, y)) {
					x = e.x
				} else {
					return 1
				}
			}
		}
		e.x = x
		e.y = y
		e.dx = dx < 0 ? -1 : 1
		e.sink = isWater(x, y)
		spawn(2, dust, e, x, y)
		return f == 1
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
		if (player.life <= 0) {
			return
		}
		const max = player.speed
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
		if (hasTouch && pointers) {
			const dx = stickX - pointersX[0],
				dy = stickY - pointersY[0]
			stickDelta = dx*dx + dy*dy
			x = -Math.max(-max, Math.min(dx * warp, max))
			y = Math.max(-max, Math.min(dy * warp, max))
		}
		if (cursed && (x || y)) {
			const mm = max * 4, hm = mm / 2
			x += Math.random() * mm - hm
			y += Math.random() * mm - hm
			if (message.style.display == "none") {
				const messages = ["Oopsie!", "Whoops!", "Yikes!"]
				say([messages[Math.floor(Math.random() * messages.length)]])
			}
		}
		moveTo(player, player.x + x, player.y + y, max)
	}

	// Initialize map.
	const map3 = Math.floor(mapRows / 3),
			waterRow = map3,
			sandRow = map3 * 2,
			areas = [
		{sprite: 22, y: waterRow}, // water
		{sprite: 21, y: waterRow + 1}, // water to sand
		{sprite: 20, y: sandRow}, // sand
		{sprite: 19, y: sandRow + 1}, // sand to soil
		{sprite: 12, y: mapRows}, // soil
	]

	// Lay out area sprites.
	for (let y = 0, i = 0, area = 0, a = areas[area]; y < mapRows; ++y) {
		for (let x = 0; x < mapCols; ++x, ++i) {
			if (y > a.y) {
				a = areas[++area]
			}
			map[i] = a.sprite
			nodes[i] = {
				x: x,
				y: y
			}
		}
	}

	// Initialize nodes for path finding.
	for (let i = 0, y = 0; y < mapRows; ++y) {
		for (let x = 0; x < mapCols; ++x, ++i) {
			const neighbors = []
			if (x > 0) {
				neighbors.push(nodes[offset(x - 1, y)])
			}
			if (x < mapCols - 1) {
				neighbors.push(nodes[offset(x + 1, y)])
			}
			if (y > 0) {
				neighbors.push(nodes[offset(x, y - 1)])
			}
			if (y < mapRows - 1) {
				neighbors.push(nodes[offset(x, y + 1)])
			}
			nodes[i].neighbors = neighbors
		}
	}

	// Create player.
	const player = {
		x: lookX,
		y: lookY,
		dx: 1,
		speed: .05,
		lastSpawn: 0,
		moving: 0,
		life: 100,
		stunned: 0,
		resurrect: function() {
			setTimeout(() => {
				fadeIn = now
				cease = now + 5000
				this.life = 100
			}, 2000)
		},
		update: function() {
			if (this.life <= 0) {
				seeStars(this)
				return 4
			}
			if (this.moving) {
				let frame = Math.round((now % 600) / 150) % 4
				if (frame > 1) {
					frame -= 2
					this.dx = -this.dx
				}
				return 5 + frame
			}
			this.dx = Math.round((now % 2000) / 1000) % 2 ? -1 : 1
			return 3
		}
	}
	entities.push(player)

	// Create idol.
	const idol = {
		x: mapCenterX,
		y: 4.5,
		update: () => 25
	}
	map[offset(mapCenterX, 4)] |= 128
	entities.push(idol)

	function nearPlayer(x, y) {
		const dx = x - player.x,
			dy = y - player.y
		return dx*dx + dy*dy < 3
	}

	// Put blocking tiles on the map. Leave maze area untouched.
	const mazeTop = waterRow + 6,
		mazeBottom = Math.min(mazeTop + mapCols, sandRow - 4)
	for (let y = 0; y < mapRows; ++y) {
		for (let x = 0; x < mapCols; ++x) {
			if (random() < .2 && !nearPlayer(x, y) &&
					(y < mazeTop || y > mazeBottom)) {
				map[offset(x, y)] |= 128
			}
		}
	}

	// Remove diagonal corners because they are visually irritating.
	for (let y = 1; y < mapRows - 1; ++y) {
		for (let x = 1; x < mapCols - 1; ++x) {
			const o = offset(x, y - 1)
			if (map[o] & 128 && (
					map[offset(x - 1, y)] & 128 ||
					map[offset(x + 1, y)] & 128)) {
				map[o] &= 127
			}
		}
	}

	// Clear area of desert maze, then create the maze.
	maze(mapCols, mazeTop, mazeBottom, (o) => map[o] |= 128);

	// Set entities over blocking tiles.
	for (let y = 0; y < mapRows; ++y) {
		for (let x = 0; x < mapCols; ++x) {
			if (x == Math.floor(idol.x) &&
					y == Math.floor(idol.y)) {
				continue
			}
			const o = offset(x, y)
			if (map[o] & 128) {
				let sprite
				if (y <= waterRow) {
					sprite = random() < .2 ? 23 : 24
					map[o] = sprite | 128
					continue
				} else if (y < sandRow) {
					sprite = 17
				} else {
					sprite = random() < .2 ? 18 : 17
				}
				entities.push({
					x: x,
					y: y + .5,
					update: () => sprite
				})
			}
		}
	}

	function freeSpot(l, t, w, h) {
		let x, y
		do {
			x = l + random() * w - .5
			y = t + random() * h - .5
		} while (nearPlayer(x, y) || blocks(x, y))
		return {
			x: x,
			y: y
		}
	}

	// Create fauna.
	const jungleRows = Math.round((mapRows - sandRow) * .8)
	for (let i = 0; i < 1000; ++i) {
		const p = freeSpot(0, mapRows - jungleRows, mapCols, jungleRows)
		entities.push({
			x: p.x,
			y: p.y,
			dx: random() > .5 ? 1 : -1,
			update: () => 11
		})
	}
	const desertStart = waterRow + 2
	for (let i = 0; i < 200; ++i) {
		const sprite = 13 + (i % 3),
			p = freeSpot(0, desertStart, mapCols, mapRows - desertStart)
		entities.push({
			x: p.x,
			y: p.y,
			dx: random() > .5 ? 1 : -1,
			update: () => sprite
		})
	}

	function dist(a, b) {
		return Math.abs(Math.round(a.x - b.x)) + Math.abs(Math.round(a.y - b.y))
	}

	function findPath(e, target) {
		for (let i = mapCols * mapRows; i-- > 0; ) {
			const n = nodes[i]
			n.p = null
			n.g = n.f = n.h = 0
		}
		const start = nodes[offset(e.x, e.y)],
			goal = nodes[offset(target.x, target.y)],
			openSet = [start],
			closedSet = []
		start.h = dist(e, target)
		while (openSet.length > 0) {
			let low = 0
			for (let i = 0, l = openSet.length; i < l; ++i) {
				if (openSet[i].f < openSet[low].f) {
					low = i
				}
			}

			const current = openSet[low]
			if (current === goal) {
				const path = []
				let n = current
				path.push(n)
				for (; n.p; n = n.p) {
					path.push(n.p)
				}
				let i = path.length - 2, tx, ty
				if (i > -1) {
					// Move to next tile on the way.
					tx = path[i].x
					ty = path[i].y
				} else {
					// Move within the same tile.
					tx = target.x
					ty = target.y
				}
				moveTo(e, tx, ty, e.speed)
				return 1
			}

			openSet.splice(low, 1)
			closedSet.push(current)

			const neighbors = current.neighbors
			for (let i = 0, l = neighbors.length; i < l; ++i) {
				const neighbor = neighbors[i]
				if (!closedSet.includes(neighbor) &&
						!blocks(neighbor.x, neighbor.y)) {
					const tg = current.g + 1
					let newPath = false
					if (openSet.includes(neighbor)) {
						if (tg < neighbor.g) {
							neighbor.g = tg
							newPath = true
						}
					} else {
						neighbor.g = tg
						newPath = true
						openSet.push(neighbor)
					}
					if (newPath) {
						neighbor.h = dist(neighbor, goal)
						neighbor.f = neighbor.g + neighbor.h
						neighbor.p = current
					}
				}
			}
		}
		return 0
	}

	function seeStars(e) {
		spawn(16, pain, e, e.x, e.y - 1)
	}

	function attack(e, prey) {
		e.attacking = 1
		if (prey.life > 0) {
			prey.life -= warp
			prey.stunned = now + e.stun
			if (prey.life <= 0) {
				const messages = [
					"Phew, that was surprisingly painful!",
					"No need to get excited big guy!",
					"I'm taking a break.",
					"How very unkind.",
					"I'm just going to lie down here. And cry a little.",
					"Wait until I'm that strong too!",
					"That was a set of whistles!",
					"That did the trick!",
					"Over and out.",
					"That stings!",
					"Boys don't cry.",
					"I think I take a little nap.",
					"Let's not do this again.",
				]
				say([messages[Math.floor(Math.random() * messages.length)]])
				fadeOut = now
				prey.resurrect()
			}
		}
		shakeUntil = now + shakeDuration
		seeStars(prey)
	}

	function hunt(e, prey, top, bottom) {
		e.attacking = 0
		if (!finish && cease < now &&
				prey.life > 0 && prey.y > top && prey.y < bottom) {
			const dx = prey.x - e.x,
				dy = prey.y - e.y,
				d = dx*dx + dy*dy
			if (d < .3) {
				attack(e, prey)
				return
			}
			if (d < e.sight && findPath(e, prey)) {
				return
			}
		}
		if (!findPath(e, e.waypoint) ||
				(Math.round(e.x) == Math.round(e.waypoint.x) &&
				Math.round(e.y) == Math.round(e.waypoint.y))) {
			e.nextWaypoint()
		}
	}

	// Create gorillas.
	const gorillas = Math.round((mapRows - sandRow) / threatLevel)
	for (let i = 0, y = mapRows - 11; i < gorillas; ++i, y -= 2) {
		const p = freeSpot(0, y, mapCols, 1),
				e = {
			x: p.x,
			y: p.y,
			sight: 10,
			attacking: 0,
			stun: 9,
			speed: .02 + random() * .01,
			lastSpawn: 0,
			update: function() {
				hunt(this, player, sandRow, mapRows)
				if (this.attacking) {
					return Math.round((now % 200) / 100) % 2 ? 7 : 10
				}
				let frame = Math.round((now % 500) / 100) % 5
				if (frame > 2) {
					frame -= 2
					this.dx = -this.dx
				}
				return 7 + frame
			},
			nextWaypoint: function() {
				this.waypoint = freeSpot(0, y, mapCols, 1)
			}
		}
		e.nextWaypoint()
		entities.push(e)
	}

	// Create scorpions.
	const scorpions = Math.round((sandRow - waterRow) / threatLevel)
	for (let i = 0, y = sandRow; i < scorpions; ++i, y -= 2) {
		const p = freeSpot(0, y, mapCols, 1),
				e = {
			x: p.x,
			y: p.y,
			sight: 3,
			attacking: 0,
			stun: 5,
			speed: .01 + random() * .005,
			lastSpawn: 0,
			update: function() {
				hunt(this, player, waterRow, sandRow)
				return 26 + Math.round((now % 200) / 100) % 2
			},
			nextWaypoint: function() {
				this.waypoint = freeSpot(0, y, mapCols, 1)
			}
		}
		e.nextWaypoint()
		entities.push(e)
	}

	// Create piranhas.
	const piranhas = Math.round(waterRow / threatLevel)
	for (let i = 0, y = waterRow; i < piranhas; ++i, y -= 2) {
		const p = freeSpot(0, y, mapCols, 1),
				e = {
			x: p.x,
			y: p.y,
			sight: 80,
			attacking: 0,
			stun: 5,
			speed: .03 + random() * .02,
			lastSpawn: 0,
			update: function() {
				hunt(this, player, 6, waterRow)
				return 28 + Math.round((now % 200) / 100) % 2
			},
			nextWaypoint: function() {
				this.waypoint = freeSpot(0, y, mapCols, 1)
			}
		}
		e.nextWaypoint()
		entities.push(e)
	}

	// Create dust and pain particles.
	for (let i = 0; i < 32; ++i) {
		dust.push({alive: 0})
	}
	for (let i = 0; i < 16; ++i) {
		pain.push({alive: 0})
	}

	// Create particles.
	for (let i = 0; i < 16; ++i) {
		particles.push({
			vx: .002 + Math.random() * .002,
			vy: .002 + Math.random() * .002,
			life: 1000 + Math.round(Math.random() * 2000),
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
			cx = -1 + xr + xr / 2, cy = 1 - yr - yr / 2
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

	function compareY(a, b) {
		return b.y - a.y
	}

	function fade() {
		if (fadeOut > fadeIn) {
			const fo = now - fadeOut
			return 1 - Math.min(1, fo / 1000)
		}
		return Math.min(1, (now - fadeIn) / 1000)
	}

	function run() {
		requestAnimationFrame(run)

		now = Date.now()
		warp = Math.min(2, (now - last) / 16)
		last = now

		const elapsed = (now - start) / 1000,
				elapsedMod13 = elapsed % 13
		if (!finish) {
			cursed = elapsed < 3 ? 0 : 1 - Math.min(elapsedMod13, 1) / 1

			if (Math.abs(lookY - idol.y) < 2) {
				finish = 1
				say([
					"I found it!",
					"The lost idol of superstition!",
					"With the power to end all superstition.",
					"Or so they say.",
				], function() {
					fadeOut = now
					setTimeout(function() {
						document.getElementById("E").style.display = "block"
					}, 2000)
				})
			}
		}

		input()

		// Animate view to player position.
		const px = player.x, py = player.y,
			dx = lookX - px, dy = lookY - py
		if (dx*dx + dy*dy > .0001) {
			lookX = lookX * .9 + px * .1
			lookY = lookY * .9 + py * .1
		}

		// Fade in/out.
		const f = fade()
		let r = f, g = f, b = f

		// Shake view.
		const xscale = renderer.xscale,
			yscale = renderer.yscale
		let vx = clamp(-lookX * xscale, viewXMax, viewXMin),
			vy = clamp(lookY * yscale, viewYMin, viewYMax)
		if (shakeUntil > now) {
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
					renderer.push(map[i] & 127, x * xscale, -y * yscale)
				}
			}
		}

		// Push dust.
		for (let i = dust.length; i--; ) {
			const e = dust[i]
			if (e.alive > now) {
				const s = (e.alive - now) / dustLife
				renderer.push(e.sprite, e.x * xscale, -e.y * yscale, s, s)
			}
		}

		// Push entities.
		entities.sort(compareY)
		for (let i = entities.length; i--; ) {
			const e = entities[i]
			renderer.push(e.update(),
					e.x * xscale,
					-e.y * yscale,
					e.dx, e.dy,
					1, e.sink)
		}

		// Push pain.
		for (let i = pain.length; i--; ) {
			const e = pain[i]
			if (e.alive > now) {
				renderer.push(e.sprite, e.x * xscale, -e.y * yscale)
			}
		}

		// Push particles.
		for (let i = particles.length; i--; ) {
			const e = particles[i], life = e.life,
				s = .2 + Math.abs(((now % life) / life) - .5)
			renderer.push(e.update(), e.x, -e.y, s, s)
		}

		if (!finish) {
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
		}

		// Virtual touch stick.
		if (hasTouch && pointers) {
			const scale = .5 / Math.max(renderer.xscale, renderer.yscale),
				size = clamp(1 - stickDelta / .05, .1, 1) * scale * 1.5
			renderer.push(0, -vx + stickX, -vy + stickY, size, size)
			renderer.push(0, -vx + pointersX[0], -vy + pointersY[0],
				scale, scale)
		}

		renderer.render(r, g, b)
	}
	run()
}
