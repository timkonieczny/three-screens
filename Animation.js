import * as THREE from "three"

class Animation {
    constructor(loop = false) {
        this.time = {
            total: 1000,
            elapsed: 0,
            transferFunction: (interpolator) => {
                return Math.min(1, interpolator)
            }
        }
        // TODO: add FOV
        this.from = {
            position: new THREE.Vector3(),
            scale: new THREE.Vector3(),
            quaternion: new THREE.Vector3()
        }
        this.to = {
            position: new THREE.Vector3(),
            scale: new THREE.Vector3(),
            quaternion: new THREE.Vector3()
        }
        this.last = {
            position: new THREE.Vector3(),
            scale: new THREE.Vector3()
        }
        this.current = {
            position: new THREE.Vector3(),
            scale: new THREE.Vector3()
        }
        this.delta = {
            position: new THREE.Vector3(),
            scale: new THREE.Vector3()
        }
        this.listeners = {
            complete: []
        }
        this.loop = loop

        this.update = this.callback.bind(this)
    }

    init(mesh) {
        this.time.elapsed = 0
        this.last.position.copy(this.from.position)
        this.last.scale.copy(this.from.scale)
        if (!this.from.position.equals(this.to.position))
            mesh.position.copy(this.from.position)
        if (!this.from.scale.equals(this.to.scale))
            mesh.scale.copy(this.from.scale)
    }

    reset() {
        if (this.loop)
            this.time.elapsed %= this.time.total
        else
            this.time.elapsed = 0
    }

    callback(tslf, mesh) {
        this.time.elapsed += tslf
        const interpolator = this.time.transferFunction(Math.min(1, this.time.elapsed / this.time.total))

        if (!this.from.position.equals(this.to.position)) {
            this.current.position.lerpVectors(this.from.position, this.to.position, interpolator)
            this.delta.position.subVectors(this.current.position, this.last.position)
            mesh.position.add(this.delta.position)
            this.last.position.copy(this.current.position)
        }
        if (!this.from.scale.equals(this.to.scale)) {
            this.current.scale.lerpVectors(this.from.scale, this.to.scale, interpolator)
            this.delta.scale.subVectors(this.current.scale, this.last.scale)
            mesh.scale.add(this.delta.scale)
            this.last.scale.copy(this.current.scale)
        }
        if (!this.from.quaternion.equals(this.to.quaternion)) {
            THREE.Quaternion.slerp(this.from.quaternion, this.to.quaternion, mesh.quaternion, interpolator)
        }

        if (this.time.elapsed > this.time.total) {
            this.reset()
            this.listeners.complete.forEach(listener => { listener(this, mesh) })
        }
    }

    addEventListener(type, listener) {
        if (!this.hasEventListener(type, listener)) {
            this.listeners[type].push(listener)
        }
    }

    removeEventListener(type, listener) {
        if (this.hasEventListener(type, listener)) {
            const index = this.listeners[type].indexOf(listener)
            this.listeners[type].splice(index, 1)
        }
    }

    hasEventListener(type, listener) {
        const index = this.listeners[type].indexOf(listener)
        return index !== -1
    }
}

export default Animation