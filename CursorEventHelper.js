class CursorEventHelper {

    constructor(target) {

        this.target = target

        this.listeners = {

            click: [],

            down: [],
            mouseDown: [],
            touchStart: [],

            up: [],
            mouseUp: [],
            touchEnd: [],

            drag: [],
            mouseDrag: [],
            touchDrag: [],
            mouseMove: []
        }

        const downPosition = {
            x: null,
            y: null,
            set: (x, y) => {
                downPosition.x = x,
                    downPosition.y = y
            }
        }

        const convertToGLCoordinates = coordinates => {
            return {
                x: coordinates.x / this.target.clientWidth * 2 - 1,
                y: coordinates.y / this.target.clientHeight * -2 + 1
            }
        }

        const data = {
            x: null,
            y: null,
            last: {
                x: null,
                y: null
            },
            delta: {
                x: null,
                y: null
            },
            gl: {
                x: null,
                y: null,
                last: {
                    x: null,
                    y: null
                },
                delta: {
                    x: null,
                    y: null
                }
            },
            set: (x, y) => {
                data.last.x = data.x
                data.last.y = data.y
                data.x = x
                data.y = y
                if (data.last.x && data.last.y) {
                    data.delta.x = data.x - data.last.x
                    data.delta.y = data.y - data.last.y
                }

                const converted = convertToGLCoordinates(data)
                data.gl.last.x = data.gl.x
                data.gl.last.y = data.gl.y
                data.gl.x = converted.x
                data.gl.y = converted.y
                if (data.gl.last.x && data.gl.last.y) {
                    data.gl.delta.x = data.gl.x - data.gl.last.x
                    data.gl.delta.y = data.gl.y - data.gl.last.y
                }
            },
        }

        let hasTouchStart = false

        const onMouseDrag = event => {
            data.set(event.clientX, event.clientY)
            this.listeners.mouseDrag.forEach(listener => { listener(data) })
            this.listeners.drag.forEach(listener => { listener(data) })
        }

        this.target.addEventListener("mousemove", event => {
            if (!hasTouchStart) {
                data.set(event.clientX, event.clientY)
                this.listeners.mouseMove.forEach(listener => { listener(data) })
            }
        })

        const onTouchDrag = event => {
            data.set(event.touches[0].clientX, event.touches[0].clientY)
            this.listeners.touchDrag.forEach(listener => { listener(data) })
            this.listeners.drag.forEach(listener => { listener(data) })
        }

        this.target.addEventListener("mousedown", event => {
            if (!hasTouchStart) {
                data.set(event.clientX, event.clientY)
                downPosition.set(event.clientX, event.clientY)
                this.listeners.mouseDown.forEach(listener => { listener(data) })
                this.listeners.down.forEach(listener => { listener(data) })
                this.target.addEventListener("mousemove", onMouseDrag)
            }
        })

        this.target.addEventListener("mouseup", event => {
            if (hasTouchStart)
                hasTouchStart = false
            else {
                if (data.x === downPosition.x && data.y === downPosition.y)
                    this.listeners.click.forEach(listener => { listener(data) })
                this.listeners.mouseUp.forEach(listener => { listener(data) })
                this.listeners.up.forEach(listener => { listener(data) })
                this.target.removeEventListener("mousemove", onMouseDrag)
            }
        })

        this.target.addEventListener("touchstart", event => {
            hasTouchStart = true
            data.set(event.touches[0].clientX, event.touches[0].clientY)
            this.listeners.touchStart.forEach(listener => { listener(data) })
            this.listeners.down.forEach(listener => { listener(data) })
            this.target.addEventListener("touchmove", onTouchDrag)
        })

        this.target.addEventListener("touchend", event => {
            this.listeners.touchEnd.forEach(listener => { listener(data) })
            this.listeners.up.forEach(listener => { listener(data) })
            this.target.removeEventListener("touchmove", onTouchDrag)
        })
    }

    addEventListener(type, listener) {
        this.listeners[type].push(listener)
    }

    removeEventListener(type, listener) {
        const index = this.listeners[type].indexOf(listener)
        this.listeners[type].splice(index, 1)
    }

    hasEventListener(type, listener) {
        const index = this.listeners[type].indexOf(listener)
        return index !== -1
    }
}

export default CursorEventHelper