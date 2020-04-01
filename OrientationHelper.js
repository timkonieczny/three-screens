import * as THREE from "three"
import { DeviceOrientationControls } from "three/examples/jsm/controls/DeviceOrientationControls"

class OrientationHelper {
    constructor() {
        this.delta = new THREE.Euler()
        this.last = new THREE.Euler()
        this.isInitialized = false
        this.isEnabled = false
        this.object = new THREE.Object3D()
        this.controls = null
        this.controls = new DeviceOrientationControls(this.object)

        const lastAlpha = null
        const lastBeta = null
        const lastGamma = null

        const enable = event => {
            if (
                event.alpha !== lastAlpha &&
                event.beta !== lastBeta &&
                event.gamma !== lastGamma
            )
                this.isEnabled =
                    event.alpha !== lastAlpha ||
                    event.beta !== lastBeta ||
                    event.gamma !== lastGamma
        }
        window.addEventListener("deviceorientation", enable)
    }

    update() {
        this.controls.update()
        if (!this.isInitialized) {
            this.last.copy(this.object.rotation)
            this.isInitialized = true
        }
        this.delta.set(
            this.object.rotation.x - this.last.x,
            this.object.rotation.y - this.last.y,
            this.object.rotation.z - this.last.z
        )
        this.last.copy(this.object.rotation)
    }
}

export default OrientationHelper
