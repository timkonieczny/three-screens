import * as THREE from "three"
import { easeOutExpo } from 'js-easing-functions'
import Animation from "./Animation"
import Easing from 'easing-functions'

const initializeObject = (object, name, listenersOnly = false) => {

    // TODO: add these properties to the THREE.Object3D prototype in Canvas.js. Get rid of all initializeObject calls

    if (!object.listeners) {  // prevent objects from being initialized twice

        object.listeners = {
            transitionInFinished: [],
            transitionOutFinished: [],
            sharedScreenTransitionFinished: [],
            click: [],
            down: [],
            drag: [],
            up: [],
            hover: [],
            update: [],
            // TODO: add afterRender and sync functions to camera, screens and canvases as well
            afterRender: []
        }

        object.addEventListener = (type, listener) => {
            if (!object.hasEventListener(type, listener)) {
                object.listeners[type].push(listener)
            }
        }

        object.removeEventListener = (type, listener) => {
            if (object.hasEventListener(type, listener)) {
                const index = object.listeners[type].indexOf(listener)
                object.listeners[type].splice(index, 1)
            }
        }

        object.hasEventListener = (type, listener) => {
            const index = object.listeners[type].indexOf(listener)
            return index !== -1
        }

        object.removeAllEventListenersOfType = type => {
            object.listeners[type] = []
        }

        object.name = name

        if (!listenersOnly) {

            object.defaultPosition = new THREE.Vector3()
            object.defaultRotation = new THREE.Euler()

            object.gravitySpeed = new THREE.Vector3()

            object.snapStartPosition = new THREE.Vector3()
            object.dragStartPosition = new THREE.Vector3()

            object.isSnappingToOriginalPosition = false
            object.isSnappingToCursor = false

            const setTopLevelParent = (object, topLevelObject) => {
                object.topLevelParent = topLevelObject
                object.children.forEach(child => {
                    setTopLevelParent(child, topLevelObject)
                })
            }
            setTopLevelParent(object, object)

            object.hasChildWithListener = {
                click: false,
                hover: false
            }

            if (object instanceof THREE.Light)
                object.originalIntensity = object.intensity

            object.inertia = {
                speed: new THREE.Vector3(),
                speedFactor: 1,
                hasInertia: false,
                lastPosition: new THREE.Vector3(),
                initialize: tslf => {
                    object.inertia.speed.subVectors(object.position, object.inertia.lastPosition)
                    object.inertia.speed.divideScalar(tslf)
                    object.inertia.hasInertia = true
                    object.inertia.speedFactor = 1
                },
                update: tslf => {
                    object.inertia.speedFactor = Math.max(object.inertia.speedFactor - tslf * 0.001, 0)
                    if (object.inertia.speedFactor === 0)
                        object.inertia.hasInertia = false
                },
                reset: _ => {
                    object.inertia.speed.set(0, 0, 0),
                        object.inertia.speedFactor = 1,
                        object.inertia.hasInertia = false
                }
            }

            object.animation = {
                transitionIn: new Animation(),
                transitionOut: new Animation(),
                transitionShared: {     // TODO: Use new Animation() for shared transitions
                    time: {
                        total: 600,
                        elapsed: 0,
                        transferFunction: Easing.Cubic.InOut
                    },
                    screen: {
                        from: null,
                        to: null
                    },
                    character: null,
                    callback: (tslf, mesh) => {
                        mesh.animation.transitionShared.time.elapsed += tslf

                        if (mesh.animation.transitionShared.time.elapsed >= mesh.animation.transitionShared.time.total)
                            mesh.listeners.sharedScreenTransitionFinished.forEach(listener => { listener() })

                        const interpolator = Math.min(mesh.animation.transitionShared.time.elapsed / mesh.animation.transitionShared.time.total, 1)
                        const transformedInterpolator = mesh.animation.transitionShared.time.transferFunction(interpolator)
                        if (mesh.animation.transitionShared.screen.from.sharedObjectConfigs[mesh.name]) {
                            let fromConfig, toConfig
                            if (mesh.animation.transitionShared.from.sharedObjectConfigs[mesh.name][mesh.transition.character]) {
                                fromConfig = mesh.animation.transitionShared.from.sharedObjectConfigs[mesh.name][mesh.transition.character]
                            } else {
                                fromConfig = mesh.animation.transitionShared.from.sharedObjectConfigs[mesh.name]
                            }
                            if (mesh.animation.transitionShared.to.sharedObjectConfigs[mesh.name][mesh.transition.character]) {
                                toConfig = mesh.animation.transitionShared.to.sharedObjectConfigs[mesh.name][mesh.transition.character]
                            } else {
                                toConfig = mesh.animation.transitionShared.to.sharedObjectConfigs[mesh.name]
                            }
                            if (fromConfig.position && toConfig.position)
                                mesh.position.lerpVectors(fromConfig.position, toConfig.position, transformedInterpolator)
                            if (fromConfig.scale && toConfig.scale)
                                mesh.scale.lerpVectors(fromConfig.scale, toConfig.scale, transformedInterpolator)
                            if (fromConfig.rotation && toConfig.rotation)
                                THREE.Quaternion.slerp(fromConfig.rotation, toConfig.rotation, mesh.quaternion, transformedInterpolator)
                            if (fromConfig.intensity && toConfig.intensity) {
                                const intensityDelta = toConfig.intensity - fromConfig.intensity
                                mesh.intensity = fromConfig.intensity + intensityDelta * transformedInterpolator
                            }
                        }
                        if (interpolator === 1) {
                            // TODO: via listener
                            mesh.listeners.sharedScreenTransitionFinished.forEach(listener => { listener(mesh) })
                        }
                    }
                }
            }

            object.animation.transitionIn.time.total = 1000
            object.animation.transitionOut.time.total = 1000

            object.isBeingDragged = false
            object.sharedBetween = new Map()
            object.entryPointScreens = []
            object.scaleFactor = 0
            object.isShared = false

            object.addScreensToShareBetween = (firstScreen, secondScreen) => {
                object.isShared = true
                if (object.sharedBetween.has(firstScreen)) {
                    if (object.sharedBetween.get(firstScreen).indexOf(secondScreen) === -1) {
                        object.sharedBetween.get(firstScreen).push(secondScreen)
                    }
                } else {
                    firstScreen.addSharedObject(object, firstScreen, [secondScreen])
                }

                if (object.sharedBetween.has(secondScreen)) {
                    if (!object.sharedBetween.get(secondScreen).indexOf(firstScreen) === -1) {
                        object.sharedBetween.get(secondScreen).push(firstScreen)
                    }
                } else {
                    secondScreen.addSharedObject(object, secondScreen, [firstScreen])
                }
            }

            object.removeScreensToShareBetween = (firstScreen, secondScreen) => {
                if (object.sharedBetween.has(firstScreen) && object.sharedBetween.get(firstScreen).indexOf(secondScreen) !== -1)
                    firstScreen.removeSharedObject(object, secondScreen)

                if (object.sharedBetween.has(secondScreen) && !object.sharedBetween.get(secondScreen).indexOf(firstScreen) === -1)
                    secondScreen.remove(object)
                object.isShared = object.sharedBetween.size !== 0
            }

            // Defines screens in which shared objects should be re-added again, after they were removed
            object.addEntryPointScreen = screen => {
                object.entryPointScreens.push(screen)
            }

            object.attachBoundingBox = _ => {
                const boundingBoxGeometry = new THREE.Box3().setFromObject(object)

                const boundingBoxMesh = new THREE.Mesh(
                    new THREE.BoxGeometry(
                        boundingBoxGeometry.max.x - boundingBoxGeometry.min.x,
                        boundingBoxGeometry.max.y - boundingBoxGeometry.min.y,
                        boundingBoxGeometry.max.z - boundingBoxGeometry.min.z),
                    new THREE.MeshBasicMaterial({ color: "#ffff00" })
                )
                boundingBoxMesh.position.copy(object.position)
                boundingBoxMesh.material.visible = false
                object.attach(boundingBoxMesh)
                boundingBoxMesh.topLevelParent = object
            }

            object.addEventListenerToChildren = (type, eventListener, addToHighestParent = false) => {
                addEventListenerToLowestChildren(type, object, eventListener)
                if (addToHighestParent)
                    object.addEventListener(type, eventListener)
                object.hasChildWithListener[type] = true
            }

            const addEventListenerToLowestChildren = (type, object, eventListener) => {
                if (object.children.length === 0) {
                    initializeObject(object, object.name, true)
                    object.addEventListener(type, eventListener)
                } else
                    object.children.forEach(child => {
                        addEventListenerToLowestChildren(type, child, eventListener)
                    })
            }

            object.removeEventListenerFromChildren = (type, eventListener) => {
                removeEventListenerFromLowestChildren(type, object, eventListener)
                object.hasChildWithListener[type] = false
            }

            const removeEventListenerFromLowestChildren = (type, object, eventListener) => {
                if (object.children.length === 0)
                    object.removeEventListener(type, eventListener)
                else
                    object.children.forEach(child => {
                        removeEventListenerFromLowestChildren(type, child, eventListener)
                    })
            }
        }
    }
}

const initializeCamera = camera => {

    camera.transition = {
        time: {
            total: 1200,
            elapsed: 0
        },
        screen: {
            from: null,
            to: null
        }
    }

    camera.updateSharedScreenTransition = (tslf, camera) => {
        camera.transition.time.elapsed += tslf
        const interpolator = Math.min(camera.transition.time.elapsed / camera.transition.time.total, 1)
        const fromConfig = camera.transition.screen.from.sharedObjectConfigs["camera"]
        const toConfig = camera.transition.screen.to.sharedObjectConfigs["camera"]
        if (fromConfig && toConfig) {
            if (fromConfig.position && toConfig.position)
                camera.position.lerpVectors(fromConfig.position, toConfig.position, easeOutExpo(interpolator, 0, 1, 1))
            if (fromConfig.rotation && toConfig.rotation)
                THREE.Quaternion.slerp(fromConfig.rotation, toConfig.rotation, camera.quaternion, easeOutExpo(interpolator, 0, 1, 1))
            if (fromConfig.fov && toConfig.fov) {
                const fovDelta = toConfig.fov - fromConfig.fov
                camera.fov = fromConfig.fov + fovDelta * easeOutExpo(interpolator, 0, 1, 1)
                camera.updateProjectionMatrix()
            }
        }
        if (interpolator === 1) {
            camera.removeEventListener("update", camera.updateSharedScreenTransition)
        }
    }

    camera.updateFunctions = []

    camera.addUpdateFunction = updateFunction => {
        camera.updateFunctions.push(updateFunction)
    }

    camera.removeUpdateFunction = updateFunction => {
        const index = camera.updateFunctions.indexOf(updateFunction)
        camera.updateFunctions.splice(index, 1)
    }

    camera.listeners = {
        sharedScreenTransitionFinished: [],
        update: []
    }

    camera.addEventListener = (type, listener) => {
        camera.listeners[type].push(listener)
    }

    camera.removeEventListener = (type, listener) => {
        const index = camera.listeners[type].indexOf(listener)
        camera.listeners[type].splice(index, 1)
    }

    camera.hasEventListener = (type, listener) => {
        const index = camera.listeners[type].indexOf(listener)
        return index !== -1
    }
}

const coords3D = new THREE.Vector2()

const normalizeScreenCoords = (coords, canvas) => {
    coords3D.set(
        coords.x / canvas.width * 2 - 1,
        coords.y / canvas.height * -2 + 1
    )
    return coords3D
}

const vec = new THREE.Vector3()
const pos = new THREE.Vector3()
const getScreenSpacePositionAtZ0 = (normalizedScreenCoords2D, camera) => {
    vec.set(
        normalizedScreenCoords2D.x,
        normalizedScreenCoords2D.y,
        0.5)
    vec.unproject(camera)
    vec.sub(camera.position).normalize()
    var distance = - camera.position.z / vec.z
    pos.copy(camera.position).add(vec.multiplyScalar(distance))
    return pos
}

const moveObjectTransformationOriginToCenter = geometry => {
    const temp = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    const boundingBox = new THREE.Box3().setFromObject(temp)
    const centerMatrix = new THREE.Matrix4().makeTranslation(-boundingBox.max.x / 2, -boundingBox.max.y / 2, 0)
    geometry.applyMatrix4(centerMatrix)
    return geometry
}

const getTextMesh = (text, name, fontConfiguration, textTransform, attachBoundingBox = false) => {
    const geometry = new THREE.TextGeometry(text, fontConfiguration)
    const geometryCentered = moveObjectTransformationOriginToCenter(geometry)
    const mesh = new THREE.Mesh(
        geometryCentered,
        new THREE.MeshStandardMaterial({
            color: '#ffffff',
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: .1
        }))
    mesh.scale.copy(textTransform.scale)
    if (textTransform.position)
        mesh.position.copy(textTransform.position)
    initializeObject(mesh, name)
    if (attachBoundingBox)
        mesh.attachBoundingBox()
    return mesh
}

const getMultiLineTextMesh = (lines, name, fontConfiguration, textTransform) => {
    const multiLineMesh = new THREE.Group()
    let fontConfigurations = []
    let textTransforms = []
    if (!Array.isArray(fontConfiguration))
        lines.forEach(_ => {
            fontConfigurations.push(fontConfiguration)
        })
    else
        fontConfigurations = fontConfiguration

    if (!Array.isArray(textTransform))
        lines.forEach(_ => {
            textTransforms.push(textTransform)
        })
    else
        textTransforms = textTransform

    lines.forEach((line, index) => {
        const lineMesh = getTextMesh(line, `line${index}`, fontConfigurations[index], textTransforms[index])
        lineMesh.visible = true
        lineMesh.position.y = (lines.length / 2 - index * 2) * textTransforms[index].lineHeight
        multiLineMesh.add(lineMesh)
    })

    initializeObject(multiLineMesh, name)

    return multiLineMesh
}

const setRoughness = (object, roughness) => {
    if (object.material && object.material.roughness)
        object.material.roughness = roughness

    object.children.forEach(child => { setRoughness(child, roughness) })
}

const outVector = new THREE.Vector3()
const getPointBetweenObjectAndCamera = (farVector, camera, distanceFromFarVector) => {
    outVector.subVectors(camera.position, farVector)
    outVector.setLength(distanceFromFarVector)
    outVector.add(farVector)
    return outVector
}

const setMeshPropertyRecursively = (object, propertyName, value) => {
    if (object.isMesh)
        object[propertyName] = value
    object.children.forEach(child => { setMeshPropertyRecursively(child, propertyName, value) })
}
const setMaterialPropertyRecursively = (object, propertyName, value) => {
    if (object.isMesh)
        object.material[propertyName] = value
    object.children.forEach(child => { setMaterialPropertyRecursively(child, propertyName, value) })
}

export { initializeObject, initializeCamera, normalizeScreenCoords, getTextMesh, getMultiLineTextMesh, setRoughness, getPointBetweenObjectAndCamera, getScreenSpacePositionAtZ0, setMeshPropertyRecursively, setMaterialPropertyRecursively }