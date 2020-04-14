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

    transitionIn(previousScreen, activeCharacter) {
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
            const onTransitionInFinished = _ => {
                object.removeEventListenerSync("update", object.animation.transitionIn.callback)
                object.removeEventListenerSync("transitionInFinished", onTransitionInFinished)
                this.numberOfReadyNonSharedObjects++
                checkObjectsAndFinishTransitionIn()
            }
            object.addEventListener("transitionInFinished", onTransitionInFinished)
            object.animation.transitionIn.time.elapsed = 0
            if (this.sharedObjectConfigs[object.name]) {
                if (
                    activeCharacter &&
                    this.sharedObjectConfigs[object.name][activeCharacter.name]
                ) {
                    if (
                        this.sharedObjectConfigs[object.name][
                            activeCharacter.name
                        ].position
                    )
                        object.position.copy(
                            this.sharedObjectConfigs[object.name][
                                activeCharacter.name
                            ].position
                        )
                    if (
                        this.sharedObjectConfigs[object.name][
                            activeCharacter.name
                        ].scale
                    )
                        object.scale.copy(
                            this.sharedObjectConfigs[object.name][
                                activeCharacter.name
                            ].scale
                        )
                }
                if (this.sharedObjectConfigs[object.name].position)
                    object.position.copy(
                        this.sharedObjectConfigs[object.name].position
                    )
                if (this.sharedObjectConfigs[object.name].scale)
                    object.scale.copy(
                        this.sharedObjectConfigs[object.name].scale
                    )
            }
            object.originalScale = object.scale.clone()
            object.addEventListener("update", object.animation.transitionIn.callback)
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
            object.addEventListener("update", object.animation.transitionOut.callback)

            const onTransitionOutFinished = _ => {
                object.removeEventListenerSync("transitionOutFinished", onTransitionOutFinished)
                object.visible = false
                object.scale.copy(object.originalScale)
                object.removeEventListenerSync("update", object.animation.transitionOut.callback)
                this.scene.remove(object)
                this.numberOfReadyNonSharedObjects++
                checkObjectsAndFinishTransitionOut()
            }
            object.addEventListener("transitionOutFinished", onTransitionOutFinished)
        })

        this.sharedObjects.forEach(object => {
            object.animation.transitionShared.time.elapsed = 0
            object.animation.transitionShared.screen.from = this
            object.animation.transitionShared.screen.to = nextScreen
            object.animation.transitionShared.character = activeCharacter
                ? activeCharacter.name
                : activeCharacter
            const onTransitionFinished = _ => {
                object.removeEventListenerSync("update", object.animation.transitionShared.callback)
                object.removeEventListenerSync("transitionInFinished", onTransitionFinished)
            }
            object.addEventListener("transitionInFinished", onTransitionFinished)
            object.addEventListener("update", object.animation.transitionShared.callback)
        })
        this.camera.transition.time.elapsed = 0
        this.camera.transition.screen.from = this
        this.camera.transition.screen.to = nextScreen
        this.camera.addEventListener(
            "update",
            this.camera.updateSharedScreenTransition
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
            object.listeners.update.forEach(listener => {
                listener(tslf, object)
            })
            object.listeners.afterUpdate.forEach(listener => {
                listener(object)
            })
            object.listeners.afterUpdate = []

        })
        this.camera.listeners.update.forEach(listener => {
            listener(tslf, this.camera)
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
