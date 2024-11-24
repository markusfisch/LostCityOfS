"use strict"

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

	function setQuad(
		idx,
		sprite,
		x1, y1,
		x2, y2,
		x3, y3,
		x4, y4,
		sy, sv
	) {
		const offset = sprite << 3,
			l = atlas.coords[offset] + nudge,
			t = atlas.coords[offset + 1] + nudge,
			r = atlas.coords[offset + 6] - nudge

		// Sink.
		let b = atlas.coords[offset + 7]
		b -= (b - t) * sv
		b -= nudge
		y1 -= sy
		y2 -= sy

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
		push: function(sprite, x, y, h, v, ground, sink) {
			const fx = x + this.viewX, fy = y + this.viewY
			if (fx < -2 || fy > 2 || fx > 2 || fy < -2) {
				// Skip out of view sprites.
				return
			}
			const size = atlas.sizes[sprite], sy = size[1]
			h = (h || 1) * size[0]
			v = (v || 1) * sy
			sink = sink ? .2 : 0
			if (ground) {
				y += sy * y2
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
				x + x2 * h, y - y2 * v,
				sink * this.yscale, sink
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
