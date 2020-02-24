class ScreenManager {
    constructor(activeScreen) {
        this.isTransitionInProgress = false
        if (activeScreen) this.transitionTo(activeScreen)
    }

    uploadObjects(screens, renderer, camera) {
        screens.forEach(screen => {
            screen.objects.forEach(object => {
                object.wasVisible = object.visible
                object.visible = true
            })
        })
        renderer.render(screens[0].scene, camera)
        renderer.clear()
        screens.forEach(screen => {
            screen.objects.forEach(object => {
                object.visible = object.wasVisible
                object.wasVisible = undefined
            })
        })
    }

    transitionTo(screen, activeCharacter = null) {
        if (!this.isTransitionInProgress && screen !== this.activeScreen) {
            this.isTransitionInProgress = true
            const onTransitionOutFinished = _ => {
                const previousScreen = this.activeScreen
                this.activeScreen = screen
                this.activeScreen.addEventListener("transitionInFinished", onTransitionInFinished)
                this.activeScreen.transitionIn(previousScreen, activeCharacter)
                if (previousScreen)
                    previousScreen.removeEventListener(
                        "transitionOutFinished",
                        onTransitionOutFinished
                    )
                this.isTransitionInProgress = false
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
            }

            if (this.activeScreen) {
                this.activeScreen.addEventListener("transitionOutFinished", onTransitionOutFinished)
                this.activeScreen.transitionOut(screen, activeCharacter)
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
