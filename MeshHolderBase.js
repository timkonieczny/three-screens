import * as THREE from "three"
import { SkeletonUtils } from "three/examples/jsm/utils/SkeletonUtils"
import { initializeObject } from "./Helpers.js"

class MeshHolderBase {
    constructor() {
        this.listeners = {  // FIXME: ready event not firing when MeshHolder is used without loading meshes
            ready: [],
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
            this.listeners.ready.forEach(listener => {
                listener()
            })
        }
    }

    addObject(imported, name) {
        const object = imported.scene
        const group = new THREE.Group()

        group.name = name
        group.add(object)
        if (imported.animations.length > 0)
            group.animationClips = imported.animations
        this.meshes.set(group.name, group)
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



            mesh.animation.model = {
                mixer: new THREE.AnimationMixer(mesh),
                actions: new Map(),
                callback: (tslf, mesh) => {
                    mesh.animation.model.mixer.update(tslf * 0.001)
                }
            }

            originalMesh.animationClips.forEach(clip => {
                mesh.animation.model.actions.set(clip.name, mesh.animation.model.mixer.clipAction(clip))
            })
        }

        return mesh
    }
}

export default MeshHolderBase