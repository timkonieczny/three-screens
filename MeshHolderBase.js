import * as THREE from "three"
import { SkeletonUtils } from "three/examples/jsm/utils/SkeletonUtils"
import { initializeObject } from "./Helpers.js"

class MeshHolderBase {
    constructor() {
        this.listeners = {
            meshesLoaded: [],
            progress: []
        }

        this.meshes = new Map()

        this.loadingManager = new THREE.LoadingManager()

        this.loadingManager.onProgress = (_, itemsLoaded, itemsTotal) => {
            this.listeners.progress.forEach(listener => {
                listener(itemsLoaded / itemsTotal)
            })
        }

        this.loadingManager.onLoad = () => {
            this.listeners.meshesLoaded.forEach(listener => {
                listener()
            })
        }
    }

    addObject(imported, name) {
        const object = imported.scene
        object.name = name
        if (imported.animations.length > 0)
            object.animationClips = imported.animations
        this.meshes.set(object.name, object)
    }

    addEventListener(type, listener) {
        this.listeners[type].push(listener)
    }

    removeEventListener(type, listener) {
        const index = this.listeners[type].indexOf(listener)
        this.listeners[type].splice(index, 1)
    }

    getMeshInstance(key) {

        const originalMesh = this.meshes.get(key)
        let mesh
        if (originalMesh.animationClips) {
            mesh = SkeletonUtils.clone(originalMesh)
            mesh.screenConfig = originalMesh.screenConfig
        } else {
            mesh = originalMesh.clone()
            mesh.screenConfig = originalMesh.screenConfig
            mesh.score = originalMesh.score
        }

        initializeObject(mesh, key)

        if (originalMesh.animationClips) {

            mesh.animation = {
                mixer: new THREE.AnimationMixer(mesh),
                actions: new Map(),
                update: (tslf, mesh) => {
                    mesh.animation.mixer.update(tslf * 0.001)
                }
            }

            originalMesh.animationClips.forEach(clip => {
                mesh.animation.actions.set(clip.name, mesh.animation.mixer.clipAction(clip))
            })
        }

        return mesh
    }
}

export default MeshHolderBase