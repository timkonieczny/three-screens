import * as THREE from "three"
import { initializeCamera } from "./Helpers"
import ScreenManager from "./ScreenManager"

class CanvasBase {
    constructor(canvas, camera, renderer, meshHolder) {
        this.listeners = {
            ready: []
        }

        this.canvas = canvas
        this.scene = new THREE.Scene()
        this.camera = camera
        initializeCamera(this.camera)
        this.renderer = renderer
        this.meshesLoaded = false

        this.meshHolder = meshHolder
    }

    initialize() {
        Object.entries(this.screens).forEach(([_, screen]) => {
            screen.addEventListener(
                "ready",
                this.onScreenInitializationFinished.bind(this)
            )
        })

        window.addEventListener("resize", this.onResize.bind(this))
        this.onResize()
        this.loadResources()
    }

    loadResources() {
        if (this.meshHolder.meshes.size === 0) {
            this.meshHolder.addEventListener("ready", _ => {
                this.meshesLoaded = true
                this.initializeScreens()
            })
            this.meshHolder.loadModels()
        } else {
            this.meshesLoaded = true
            this.initializeScreens()
        }
    }

    initializeScreens() {
        Object.entries(this.screens).forEach(([_, screen]) => {
            screen.initialize(this.meshHolder)
        })
    }

    onScreenInitializationFinished() {
        if (!this.meshesLoaded) return

        let areAllScreensInitialized = true
        Object.entries(this.screens).forEach(([_, screen]) => {
            if (!screen.isInitializationFinished) {
                areAllScreensInitialized = false
                return
            }
        })
        if (!areAllScreensInitialized) return

        this.screenManager = new ScreenManager()

        this.screenManager.uploadObjects(Object.values(this.screens), this.renderer, this.camera)

        this.listeners.ready.forEach(listener => {
            listener(this)
        })
    }

    onResize() {
        // FIXME: viewport size should be inferred from canvas
        this.renderer.setSize(window.innerWidth, window.innerHeight, false)
        if (this.composer)
            this.composer.setSize(window.innerWidth, window.innerHeight, false)

        this.camera.aspect = this.canvas.width / this.canvas.height
        this.camera.updateProjectionMatrix()
    }

    update(tslf) {
        this.screenManager.update(tslf)
        if (this.composer)
            this.composer.render(tslf)
        else
            this.renderer.render(this.scene, this.camera)
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

export default CanvasBase
