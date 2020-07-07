import * as THREE from "three"

class CursorEventHelper {

    constructor(target) {

        this.target = target

        this.raycaster = new THREE.Raycaster()

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

        this.downPosition = {
            x: null,
            y: null,
            set: (x, y) => {
                this.downPosition.x = x,
                    this.downPosition.y = y
            }
        }

        this.onTouchEnd = this.onTouchEnd.bind(this)
        this.onClick = this.onClick.bind(this)
        this.onTouchDrag = this.onTouchDrag.bind(this)

        const convertToGLCoordinates = coordinates => {
            return {
                x: coordinates.x / this.target.clientWidth * 2 - 1,
                y: coordinates.y / this.target.clientHeight * -2 + 1
            }
        }

        this.data = {
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
            initialEvent: null,
            set: (x, y, event = null) => {
                this.data.initialEvent = event
                this.data.last.x = this.data.x
                this.data.last.y = this.data.y
                this.data.x = x
                this.data.y = y
                if (this.data.last.x && this.data.last.y) {
                    this.data.delta.x = this.data.x - this.data.last.x
                    this.data.delta.y = this.data.y - this.data.last.y
                }

                const converted = convertToGLCoordinates(this.data)
                this.data.gl.last.x = this.data.gl.x
                this.data.gl.last.y = this.data.gl.y
                this.data.gl.x = converted.x
                this.data.gl.y = converted.y
                if (this.data.gl.last.x && this.data.gl.last.y) {
                    this.data.gl.delta.x = this.data.gl.x - this.data.gl.last.x
                    this.data.gl.delta.y = this.data.gl.y - this.data.gl.last.y
                }
            },
        }

        let hasTouchStart = false

        const onMouseDrag = _ => {
            this.listeners.mouseDrag.forEach(listener => { listener(this.data) })
            this.listeners.drag.forEach(listener => { listener(this.data) })
        }

        this.target.addEventListener("mousemove", event => {
            if (!hasTouchStart) {
                this.data.set(event.clientX, event.clientY, event)
                this.listeners.mouseMove.forEach(listener => { listener(this.data) })
            }
        })


        this.target.addEventListener("mousedown", event => {
            if (!hasTouchStart) {
                this.data.set(event.clientX, event.clientY, event)
                this.downPosition.set(event.clientX, event.clientY)
                this.listeners.mouseDown.forEach(listener => { listener(this.data) })
                this.listeners.down.forEach(listener => { listener(this.data) })
                this.target.addEventListener("mousemove", onMouseDrag)
            }
        })

        this.target.addEventListener("mouseup", event => {
            if (hasTouchStart)
                hasTouchStart = false
            else {
                if (this.data.x === this.downPosition.x && this.data.y === this.downPosition.y)
                    this.target.addEventListener("click", this.onClick)
                this.listeners.mouseUp.forEach(listener => { listener(this.data) })
                this.listeners.up.forEach(listener => { listener(this.data) })
                this.target.removeEventListener("mousemove", onMouseDrag)
            }
        })

        this.target.addEventListener("touchstart", event => {
            console.log("touchstart")
            hasTouchStart = true
            this.data.set(event.touches[0].clientX, event.touches[0].clientY, event)
            this.downPosition.set(event.touches[0].clientX, event.touches[0].clientY)
            this.listeners.touchStart.forEach(listener => { listener(this.data) })
            this.listeners.down.forEach(listener => { listener(this.data) })
            this.target.addEventListener("touchmove", this.onTouchDrag)
        })

        this.target.addEventListener("touchend", this.onTouchEnd)
    }

    onTouchEnd(event) {
        console.log("touchend")
        if (this.data.x === this.downPosition.x && this.data.y === this.downPosition.y)
            this.target.addEventListener("click", this.onClick)
        this.listeners.touchEnd.forEach(listener => { listener(this.data) })
        this.listeners.up.forEach(listener => { listener(this.data) })
        this.target.removeEventListener("touchmove", this.onTouchDrag)
    }

    onClick(event) {
        this.target.removeEventListener("click", this.onClick)
        this.listeners.click.forEach(listener => { listener(this.data) })
    }

    onTouchDrag(event) {
        this.data.set(event.touches[0].clientX, event.touches[0].clientY, event)
        this.listeners.touchDrag.forEach(listener => { listener(this.data) })
        this.listeners.drag.forEach(listener => { listener(this.data) })
    }

    addEventListener(type, listener) {
        if (!this.hasEventListener(type, listener)) {
            this.listeners[type].push(listener)
            return true
        } else
            return false
    }

    removeEventListener(type, listener) {
        if (this.hasEventListener(type, listener)) {
            const index = this.listeners[type].indexOf(listener)
            this.listeners[type].splice(index, 1)
            return true
        } else
            return false
    }

    hasEventListener(type, listener) {
        const index = this.listeners[type].indexOf(listener)
        return index !== -1
    }

    // TODO: Merge detection classes. Rename fireObjectListeners
    detectClickOnObject(coords, screen) {
        this.raycaster.setFromCamera(coords, screen.camera)

        const objects = [...screen.objects.values()].filter(object => object.topLevelParent.listeners.click.length > 0)

        const intersections = this.raycaster.intersectObjects(objects, true)

        if (intersections.length > 0)
            intersections[0].object.topLevelParent.listeners.click.forEach(listener => { listener() })
    }

    detectDownOnObject(event, screen) {
        this.raycaster.setFromCamera(event.gl, screen.camera)

        const objects = [...screen.objects.values()].filter(object => object.topLevelParent.listeners.down.length > 0)

        const intersections = this.raycaster.intersectObjects(objects, true)

        if (intersections.length > 0) {
            const object = intersections[0].object.topLevelParent
            object.listeners.down.forEach(listener => { listener(event, object) })
        }
    }
}

export default CursorEventHelper