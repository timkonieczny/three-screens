import * as THREE from "three"
import { initializeCamera } from "./Helpers"
import ScreenManager from "./ScreenManager"

class Canvas {
    constructor(canvas, camera, renderer) {
        this.listeners = {
            readyToRender: []
        }

        this.canvas = canvas
        this.scene = new THREE.Scene()
        this.camera = camera
        initializeCamera(this.camera)
        this.renderer = renderer
        this.allMeshesReady = false

        this.meshHolder = null
    }

    initialize(firstScreen) {
        this.firstScreen = firstScreen
        Object.entries(this.screen).forEach(([_, screen]) => {
            screen.addEventListener(
                "initializationFinished",
                this.onScreenInitializationFinished.bind(this)
            )
        })

        window.addEventListener("resize", this.onResize.bind(this))
        this.onResize()
        this.loadResources()
    }

    loadResources() {
        this.meshHolder.addEventListener("allMeshesReady", _ => {
            this.allMeshesReady = true
            if (this.allMeshesReady) this.initializeScreens()
        })
        this.meshHolder.loadModels()
    }

    initializeScreens() {
        Object.entries(this.screen).forEach(([_, screen]) => {
            screen.initialize(this.meshHolder)
        })
    }

    onScreenInitializationFinished() {
        if (!this.allMeshesReady) return
        Object.entries(this.screen).forEach(([_, screen]) => {
            if (!screen.isInitializationFinished) return
        })
        this.screenManager = new ScreenManager(this.firstScreen)

        // FIXME: this is called 3 times
        this.screenManager.uploadObjects(Object.values(this.screen), this.renderer, this.camera)
        this.listeners.readyToRender.forEach(listener => {
            listener(this)
        })
    }

    onResize() {
        // FIXME: viewport size should be inferred from canvas
        this.renderer.setSize(window.innerWidth, window.innerHeight, false)
        this.camera.aspect = this.canvas.width / this.canvas.height
        this.camera.updateProjectionMatrix()
    }

    update(tslf) {
        this.screenManager.update(tslf)
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

export default Canvas
