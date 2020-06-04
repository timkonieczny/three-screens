import * as THREE from "three"

class ScreenBase {
    constructor(scene, camera) {
        this.objects = new Map()
        this.scene = scene
        this.camera = camera
        this.isInitializationFinished = false

        this.listeners = {
            transitionInFinished: [],
            transitionOutFinished: [],
            transitionInStarted: [],
            transitionOutStarted: [],
            ready: [],
            update: []
        }

        this.sharedObjectConfigs = {}
    }

    transitionIn(previousScreen) {
        const checkObjectsAndFinishTransitionIn = _ => {
            if (
                this.numberOfReadyNonSharedObjects ==
                this.nonSharedObjects.length
            ) {
                this.numberOfReadyNonSharedObjects = 0
                this.listeners.transitionInFinished.forEach(listener => {
                    listener(this)
                })
            }
        }

        this.nonSharedObjects = Array.from(this.objects.values()).filter(
            object =>
                // objects that aren't shared
                !object.isShared ||
                // objects that are shared but this is their first screen (entry point)
                (object.isShared &&
                    !object.sharedBetween.get(previousScreen)) ||
                // objects that are shared, for this case: [screen before previous screen] shared with [previous screen] not shared with [this] shared with [next screen]
                (object.isShared &&
                    !object.sharedBetween.get(previousScreen).includes(this) &&
                    object.entryPointScreens.indexOf(this) !== -1) ||
                // objects that are shared, but were disabled and are now reappearing at their entry point
                (object.isShared &&
                    object.sharedBetween.get(previousScreen).includes(this) &&
                    object.entryPointScreens.indexOf(this) !== -1 &&
                    this.scene.children.indexOf(object) === -1)
        )

        this.numberOfReadyNonSharedObjects = 0
        checkObjectsAndFinishTransitionIn()

        this.nonSharedObjects.forEach(object => {

            this.scene.add(object)
            const onTransitionInFinished = (animation, mesh) => {
                mesh.removeEventListener("update", animation.update)
                animation.removeEventListener("complete", onTransitionInFinished)
                this.numberOfReadyNonSharedObjects++
                checkObjectsAndFinishTransitionIn()
            }
            object.animation.transitionIn.addEventListener("complete", onTransitionInFinished)
            object.animation.transitionIn.time.elapsed = 0
            object.animation.transitionIn.to.scale.copy(object.scale)
            if (this.sharedObjectConfigs[object.name]) {
                if (this.sharedObjectConfigs[object.name].position)
                    object.animation.transitionIn.to.position.copy(
                        this.sharedObjectConfigs[object.name].position)
                if (this.sharedObjectConfigs[object.name].scale)
                    object.animation.transitionIn.to.scale.copy(
                        this.sharedObjectConfigs[object.name].scale)
            }

            object.animation.transitionIn.init(object)
            object.addEventListener("update", object.animation.transitionIn.update)
        })
        this.listeners.transitionInStarted.forEach(listener => {
            listener(this)
        })
    }

    transitionOut(nextScreen, activeCharacter) {
        const checkObjectsAndFinishTransitionOut = _ => {
            if (this.numberOfReadyNonSharedObjects === this.nonSharedObjects.length) {
                this.numberOfReadyNonSharedObjects = 0
                this.listeners.transitionOutFinished.forEach(listener => {
                    listener(this)
                })
            }
        }

        this.listeners.transitionOutStarted.forEach(listener => {
            listener(this)
        })

        this.nonSharedObjects = Array.from(this.objects.values()).filter(
            object => !object.sharedBetween.get(this).includes(nextScreen)
        )
        this.sharedObjects = Array.from(this.objects.values()).filter(
            object =>
                object.sharedBetween.get(this).includes(nextScreen) &&
                this.scene.children.indexOf(object) >= 0
        )

        this.numberOfReadyNonSharedObjects = 0
        checkObjectsAndFinishTransitionOut()

        this.nonSharedObjects.forEach(object => {
            object.animation.transitionOut.time.elapsed = 0
            object.originalScale = object.scale.clone()
            object.animation.transitionOut.from.scale.copy(object.scale)
            object.animation.transitionOut.init(object)

            object.addEventListener("update", object.animation.transitionOut.update)

            const onTransitionOutFinished = (animation, mesh) => {
                animation.removeEventListener("complete", onTransitionOutFinished)
                object.scale.copy(object.animation.transitionOut.from.scale)
                object.removeEventListener("update", animation.update)
                this.scene.remove(object)
                this.numberOfReadyNonSharedObjects++
                checkObjectsAndFinishTransitionOut()
            }
            object.animation.transitionOut.addEventListener("complete", onTransitionOutFinished)
        })

        this.sharedObjects.forEach(object => {
            object.animation.transitionShared.time.elapsed = 0
            object.animation.transitionShared.screen.from = this
            object.animation.transitionShared.screen.to = nextScreen
            object.animation.transitionShared.character = activeCharacter
                ? activeCharacter.name
                : activeCharacter
            const onTransitionFinished = _ => {
                object.removeEventListener("update", object.animation.transitionShared.callback)
                object.removeEventListener("transitionInFinished", onTransitionFinished)
            }
            object.addEventListener("transitionInFinished", onTransitionFinished)
            object.addEventListener("update", object.animation.transitionShared.callback)
        })
        this.camera.animation.transitionShared.time.elapsed = 0
        this.camera.animation.transitionShared.screen.from = this
        this.camera.animation.transitionShared.screen.to = nextScreen
        this.camera.addEventListener(
            "update",
            this.camera.animation.transitionShared.callback
        )
    }

    addSharedObject(sharedObject, screen, sharedWithScreens) {
        // TODO: split this up into two external calls for clarity
        this.add(sharedObject, screen)
        this.objects
            .get(sharedObject.name)
            .sharedBetween.set(screen, sharedWithScreens)
    }

    removeSharedObject(sharedObject, sharedWithScreen) {
        // TODO: after splitting addSharedObject up, rename to removeObjectScreenSharingConnection
        const sharedWithScreens = this.objects
            .get(sharedObject.name)
            .sharedBetween.get(this)
        sharedWithScreens.splice(sharedWithScreens.indexOf(sharedWithScreen), 1)
    }

    update(tslf) {
        this.listeners.update.forEach(listener => {
            listener(this, tslf)
        })
        this.objects.forEach(object => {
            if (object.listeners.update.length > 0) {
                object.listeners.update.slice().forEach(listener => {
                    listener(tslf, object)
                })
            }
        })
        this.camera.listeners.update.forEach(listener => {
            listener(tslf, this.camera)
        })
    }

    afterRender() {
        this.objects.forEach(object => {
            object.listeners.afterRender.forEach(listener => listener(object))
            object.listeners.afterRender = []
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

    add(object, screen) {
        object.sharedBetween.set(screen ? screen : this, [])
        this.objects.set(object.name, object)
    }

    remove(object) {
        object.sharedBetween.delete(this)
        this.objects.delete(object.name)
    }

    moveObjectTransformationOriginToCenter(geometry) {
        const temp = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({ color: "#ffffff" })
        )
        const boundingBox = new THREE.Box3().setFromObject(temp)
        const centerMatrix = new THREE.Matrix4().makeTranslation(
            -boundingBox.max.x / 2,
            -boundingBox.max.y / 2,
            0
        )
        geometry.applyMatrix(centerMatrix)
        return geometry
    }
}

export default ScreenBase
