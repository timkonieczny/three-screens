import * as THREE from "three"
import { initializeCamera } from "./Helpers"

class CanvasBase {
    constructor(canvas, camera, renderer, meshHolder, activeScreen) {
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

        this.isTransitionOutInProgress = false
        this.isTransitionInInProgress = false
        this.nextScreen = null
        if (activeScreen) this.transitionTo(activeScreen)
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

        this.uploadObjects(Object.values(this.screens), this.renderer, this.camera)

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
        this.activeScreen.update(tslf)

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

    uploadObjects(screens, renderer, camera) {
        screens.forEach(screen => {
            screen.objects.forEach(object => {
                object.wasVisible = object.visible
                object.visible = true
                screens[0].scene.add(object)
            })

        })
        renderer.render(screens[0].scene, camera)
        renderer.clear()
        screens.forEach(screen => {
            screen.objects.forEach(object => {
                screens[0].scene.remove(object)
                object.visible = object.wasVisible
                object.wasVisible = undefined
            })
        })
    }

    transitionTo(screen, activeCharacter = null) {
        this.nextScreen = screen
        if (this.isTransitionInInProgress)
            this.activeScreen.nonSharedObjects.forEach(object => {
                object.listeners.transitionInFinished.forEach(listener => {
                    listener(object)
                })
            })
        if (!this.isTransitionOutInProgress) {
            this.isTransitionOutInProgress = true
            const onTransitionOutFinished = _ => {
                const previousScreen = this.activeScreen
                this.activeScreen = this.nextScreen
                this.activeScreen.addEventListener("transitionInFinished", onTransitionInFinished)
                this.isTransitionInInProgress = true
                this.activeScreen.transitionIn(previousScreen, activeCharacter)
                if (previousScreen)
                    previousScreen.removeEventListener(
                        "transitionOutFinished",
                        onTransitionOutFinished
                    )
                this.isTransitionOutInProgress = false
            }
            const onTransitionInFinished = _ => {
                // This just needs to be called, so that shared objects
                // that weren't shared with the previous screen, but with
                // screens before that, are set visible again. They were
                // set invisible after they were transitioned out.

                this.activeScreen.removeEventListener(
                    "transitionInFinished",
                    onTransitionInFinished
                )
                this.isTransitionInInProgress = false
            }

            if (this.activeScreen) {
                this.activeScreen.addEventListener("transitionOutFinished", onTransitionOutFinished)
                this.activeScreen.transitionOut(this.nextScreen, activeCharacter)
            } else {
                onTransitionOutFinished()
            }
        }
    }
}

export default CanvasBase
