"use strict"

function maze(width, top, bottom, block) {
	const height = bottom - top,
		cells = new Array(width * height).fill(false),
		active = [],
		idx = (x, y) => y * width + x,
		startX = Math.floor(width / 2),
		startY = height,
		dirs = [[0,-1], [1,0], [-1,0], [0,1]]
	cells[idx(startX, startY)] = true
	active.push([startX, startY])

	let northmostX = startX,
		northmostY = startY

	while (active.length > 0) {
		const index = active.length - 1,
			[x, y] = active[index]

		if (y < northmostY) {
			northmostX = x
			northmostY = y
		}

		const shuffledDirs = [...dirs]
			// 30% chance to prioritize current direction
			.sort(() => random() < .3 ? -1 : 1)

		let found = false
		for (const [dx, dy] of shuffledDirs) {
			const nx = x + dx * 2,
				ny = y + dy * 2

			if (nx < 0 || nx >= width ||
					ny < 0 || ny >= height) {
				continue
			}

			if (!cells[idx(nx, ny)]) {
				cells[idx(nx, ny)] = true
				cells[idx(x + dx, y + dy)] = true
				active.push([nx, ny])
				found = true
				break
			}
		}

		if (!found) {
			active.splice(index, 1)
		}
	}

	// Ensure path reaches the top by carving upward from northmost
	// point if needed.
	if (northmostY > 0) {
		for (let y = northmostY; y > 0; --y) {
			cells[idx(northmostX, y)] = true
		}
	}

	// Add some random cycles for alternate paths.
	const cycleCount = Math.floor(width * height * .1)
	for (let i = 0; i < cycleCount; ++i) {
		const x = Math.floor(random() * (width - 2)) + 1,
			y = Math.floor(random() * (height - 2)) + 1
		cells[idx(x, y)] = true
	}

	// Set blocks.
	for (let y = 0; y < height; ++y) {
		for (let x = 0; x < width; ++x) {
			if (!cells[idx(x, y)]) {
				block((y + top) * width + x)
			}
		}
	}
}
