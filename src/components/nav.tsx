import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import intl from "react-intl-universal"
import { useSelector, useDispatch } from "react-redux"
import { Icon } from "@fluentui/react/lib/Icon"
import { IObjectWithKey } from "@fluentui/react"
import { RootState } from "../scripts/reducer"
import { fetchItems, markAllRead } from "../scripts/models/item"
import { makeStyles, mergeClasses } from "@fluentui/react-components"
import { toggleLogMenu, toggleSettings } from "../scripts/models/app"
import { toggleSearch } from "../scripts/models/page"
import { SourceCategory, WindowStateListenerType } from "../schema-types"
import { FlatButton } from "./utils/FlatButton"
import { FlatButtonGroup } from "./utils/FlatButtonGroup"
import {
    AppWindowFocusChangeEvent,
    useIsBlurred,
} from "./utils/hooks/useIsBlurred"

const useClasses = makeStyles({
    navBlurred: {
        "--black": "var(--neutralSecondaryAlt)",
    },
    navBtn: {
        height: "var(--navHeight)",
        lineHeight: "var(--navHeight)",
        zIndex: 1,
        position: "relative",
    },
    navBtnSystem: {
        position: "relative",
        zIndex: 10,
    },
    navBtnSystemItemOn: {
        color: "var(--whiteConstant)",
    },
    navBtnMinimize: {
        fontSize: "12px",
    },
    navGroupRight: {
        float: "right",
    },
})

const Nav: React.FC = () => {
    const classes = useClasses()
    const dispatch = useDispatch()
    const state = useSelector((state: RootState) => state.app)
    const itemShown = useSelector(
        (state: RootState) =>
            state.page.itemId &&
            state.page.contentView !== "all" &&
            state.page.contentView !== SourceCategory.Articles
    )
    const [maximized, setMaximized] = useState(globalThis.utils.isMaximized())
    const isBlurred = useIsBlurred()
    const isDarwin = globalThis.utils.platform === "darwin"

    const setBodyFullscreenState = useCallback((fullscreen: boolean) => {
        if (fullscreen) document.body.classList.remove("not-fullscreen")
        else document.body.classList.add("not-fullscreen")
    }, [])

    const windowStateListener = useCallback(
        (type: WindowStateListenerType, windowState: boolean) => {
            switch (type) {
                case WindowStateListenerType.Maximized:
                    setMaximized(windowState)
                    break
                case WindowStateListenerType.Fullscreen:
                    setBodyFullscreenState(windowState)
                    break
                case WindowStateListenerType.Focused:
                    globalThis.dispatchEvent(
                        new CustomEvent<AppWindowFocusChangeEvent["detail"]>(
                            "app-window-focus-change",
                            { detail: { focused: windowState } }
                        )
                    )
                    break
            }
        },
        [setBodyFullscreenState]
    )

    const canFetch = useCallback(
        () =>
            state.sourceInit &&
            state.feedInit &&
            !state.syncing &&
            !state.fetchingItems,
        [state.sourceInit, state.feedInit, state.syncing, state.fetchingItems]
    )

    const fetch = useCallback(() => {
        if (canFetch()) dispatch(fetchItems())
    }, [canFetch, dispatch])

    const menu = useCallback(
        () =>
            document.querySelector<HTMLElement>(".modern-source-row")?.focus(),
        []
    )
    const logs = useCallback(() => dispatch(toggleLogMenu()), [dispatch])
    const search = useCallback(() => dispatch(toggleSearch()), [dispatch])
    const settings = useCallback(() => dispatch(toggleSettings()), [dispatch])
    const markAllDirect = useCallback(() => dispatch(markAllRead()), [dispatch])
    const views = useCallback(
        () =>
            document
                .querySelector<HTMLElement>(
                    '.modern-tabs button[aria-selected="true"]'
                )
                ?.focus(),
        []
    )

    const navShortcutsHandler = useCallback(
        (e: KeyboardEvent | IObjectWithKey) => {
            if (!state.settings.display) {
                switch (e.key) {
                    case "F1":
                        menu()
                        break
                    case "F2":
                        search()
                        break
                    case "F5":
                        fetch()
                        break
                    case "F6":
                        markAllDirect()
                        break
                    case "F7":
                        if (!itemShown) logs()
                        break
                    case "F8":
                        if (!itemShown) views()
                        break
                    case "F9":
                        if (!itemShown) settings()
                        break
                }
            }
        },
        [
            state.settings.display,
            itemShown,
            menu,
            search,
            fetch,
            markAllDirect,
            logs,
            views,
            settings,
        ]
    )

    useEffect(() => {
        setBodyFullscreenState(globalThis.utils.isFullscreen())
        globalThis.utils.addWindowStateListener(windowStateListener)

        return () => {
            // Cleanup will be handled by the event listener removal effect
        }
    }, [setBodyFullscreenState, windowStateListener])

    useEffect(() => {
        document.addEventListener("keydown", navShortcutsHandler)
        if (globalThis.utils.platform === "darwin")
            globalThis.utils.addTouchBarEventsListener(navShortcutsHandler)

        return () => {
            document.removeEventListener("keydown", navShortcutsHandler)
        }
    }, [navShortcutsHandler])

    const minimize = () => {
        globalThis.utils.minimizeWindow()
    }

    const maximize = () => {
        globalThis.utils.maximizeWindow()
        setMaximized(!maximized)
    }

    const close = () => {
        globalThis.utils.closeWindow()
    }

    const getClassNames = () => {
        const classNames = new Array<string>()
        if (state.settings.display) classNames.push("hide-btns")
        if (state.menu) classNames.push("menu-on")
        if (itemShown) classNames.push("item-on")
        if (isBlurred) classNames.push(classes.navBlurred)
        return classNames.join(" ")
    }

    const systemItemOnClass = itemShown ? classes.navBtnSystemItemOn : undefined

    return (
        <nav className={getClassNames()}>
            <span className="title">{state.title}</span>
            <FlatButtonGroup styleClass={classes.navGroupRight}>
                {!isDarwin && (
                    <>
                        <FlatButton
                            variant="system"
                            styleClass={mergeClasses(
                                classes.navBtn,
                                classes.navBtnSystem,
                                classes.navBtnMinimize,
                                systemItemOnClass
                            )}
                            title={intl.get("nav.minimize")}
                            onClick={minimize}>
                            <Icon iconName="Remove" />
                        </FlatButton>
                        <FlatButton
                            variant="system"
                            styleClass={mergeClasses(
                                classes.navBtn,
                                classes.navBtnSystem,
                                systemItemOnClass
                            )}
                            title={intl.get("nav.maximize")}
                            onClick={maximize}>
                            {maximized ? (
                                <Icon
                                    iconName="ChromeRestore"
                                    style={{ fontSize: 11 }}
                                />
                            ) : (
                                <Icon
                                    iconName="Checkbox"
                                    style={{ fontSize: 10 }}
                                />
                            )}
                        </FlatButton>
                        <FlatButton
                            variant="close"
                            styleClass={mergeClasses(
                                classes.navBtn,
                                classes.navBtnSystem,
                                systemItemOnClass
                            )}
                            title={intl.get("close")}
                            onClick={close}>
                            <Icon iconName="Cancel" />
                        </FlatButton>
                    </>
                )}
            </FlatButtonGroup>
        </nav>
    )
}

export default Nav
