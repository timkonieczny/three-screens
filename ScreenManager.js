class ScreenManager {
    constructor(activeScreen) {
        this.isTransitionOutInProgress = false
        this.isTransitionInInProgress = false
        this.nextScreen = null
        if (activeScreen) this.transitionTo(activeScreen)
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

                this.activeScreen.objects.forEach(object => {
                    if (object.visibleOverride === null) object.visible = true
                    else object.visible = object.visibleOverride
                })
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

    update(tslf) {
        this.activeScreen.update(tslf)
    }
}

export default ScreenManager
