import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import intl from "react-intl-universal"
import { Icon, FocusTrapZone } from "@fluentui/react"
import { Spinner } from "@fluentui/react-components"
import AboutTab from "./settings/about"
import SourcesTabContainer from "../containers/settings/sources-container"
import GroupsTabContainer from "../containers/settings/groups-container"
import AppTabContainer from "../containers/settings/app-container"
import RulesTabContainer from "../containers/settings/rules-container"
import ServiceTabContainer from "../containers/settings/service-container"
import { initTouchBarWithTexts } from "../scripts/utils"
import { useAppSelector, useAppDispatch } from "../scripts/reducer"
import { exitSettings } from "../scripts/models/app"
import { makeStyles, mergeClasses } from "@griffel/react"
import { usePanelDrag } from "./utils/use-panel-drag"

const useStyles = makeStyles({
    panel: { WebkitAppRegion: "no-drag" },
    main: {
        "&[role='tabpanel']": {
            height: "auto",
            padding: 0,
            overflow: "hidden",
        },
        "& .modern-setting-row": {
            "@media (max-width: 760px)": {
                gridTemplateColumns: "minmax(0, 1fr)",
                gap: "8px",
            },
        },
        "& .modern-setting-row > .ms-Stack .ms-StackItem": { marginBottom: 0 },
    },
    scroll: { scrollbarGutter: "stable" },
    handle: { cursor: "grab", touchAction: "none", userSelect: "none" },
    dragging: { cursor: "grabbing" },
    updateStatus: {
        margin: "0 30px 8px",
        padding: "10px 12px",
        backgroundColor: "var(--neutralLighterAlt)",
        color: "var(--neutralSecondary)",
        borderRadius: "8px",
        fontSize: "12px",
        flexShrink: 0,
    },
})

type SettingsTab =
    | "app"
    | "sources"
    | "grouping"
    | "rules"
    | "service"
    | "about"

const tabs: { key: SettingsTab; icon: string }[] = [
    { key: "app", icon: "Settings" },
    { key: "sources", icon: "Source" },
    { key: "grouping", icon: "GroupList" },
    { key: "rules", icon: "FilterSettings" },
    { key: "service", icon: "CloudImportExport" },
    { key: "about", icon: "Info" },
]

const Settings: React.FC = () => {
    const dispatch = useAppDispatch()
    const classes = useStyles()
    const display = useAppSelector(s => s.app.settings.display)
    const drag = usePanelDrag(display)
    const selectedSids = useAppSelector(s => s.app.settings.sids)
    const blocked = useAppSelector(
        s => !s.app.sourceInit || s.app.syncing || s.app.settings.saving
    )
    const fetching = useAppSelector(s => s.app.fetchingItems)
    const background = useAppSelector(s => s.app.backgroundFetching)
    const progress = useAppSelector(s => s.app.fetchingProgress)
    const total = useAppSelector(s => s.app.fetchingTotal)
    const exiting = useAppSelector(s => s.app.settings.saving)
    const [active, setActive] = useState<SettingsTab>("app")
    const exitingRef = useRef(exiting)
    exitingRef.current = exiting

    const close = useCallback(() => dispatch(exitSettings()), [dispatch])

    useEffect(() => {
        if (display) setActive(selectedSids.length ? "sources" : "app")
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.key === "Escape" &&
                !event.defaultPrevented &&
                !document.querySelector('[role="listbox"]') &&
                !exitingRef.current
            )
                close()
        }
        if (display) {
            if (globalThis.utils.platform === "darwin")
                globalThis.utils.destroyTouchBar()
            document.body.addEventListener("keydown", onKeyDown)
        } else if (globalThis.utils.platform === "darwin") {
            initTouchBarWithTexts()
        }
        return () => document.body.removeEventListener("keydown", onKeyDown)
    }, [display, close])

    if (!display) return null

    const content = {
        app: <AppTabContainer />,
        sources: <SourcesTabContainer />,
        grouping: <GroupsTabContainer />,
        rules: <RulesTabContainer />,
        service: <ServiceTabContainer />,
        about: <AboutTab />,
    }

    return (
        <div className="settings-container modern-settings-backdrop">
            <div
                ref={drag.panelRef}
                className={mergeClasses(
                    "settings modern-settings-panel",
                    classes.panel
                )}
                style={{
                    transform: `translate(${drag.offset.x}px, ${drag.offset.y}px)`,
                }}
                role="dialog"
                aria-modal
                aria-label={intl.get("settings.name")}>
                <aside className="modern-settings-sidebar">
                    <div
                        className={mergeClasses(
                            "modern-settings-brand",
                            classes.handle,
                            drag.dragging && classes.dragging
                        )}
                        {...drag.handlers}>
                        <img src="icons/logo.svg" alt="" draggable={false} />
                        <strong>Fluent Reader</strong>
                    </div>
                    <nav
                        className="modern-settings-tabs"
                        role="tablist"
                        aria-orientation="vertical">
                        {tabs.map((tab, index) => (
                            <button
                                key={tab.key}
                                id={`modern-settings-tab-${tab.key}`}
                                type="button"
                                role="tab"
                                aria-selected={active === tab.key}
                                aria-controls="modern-settings-content"
                                className={active === tab.key ? "active" : ""}
                                onClick={() => setActive(tab.key)}
                                onKeyDown={event => {
                                    if (
                                        event.key !== "ArrowUp" &&
                                        event.key !== "ArrowDown"
                                    )
                                        return
                                    event.preventDefault()
                                    const next =
                                        (index +
                                            (event.key === "ArrowDown"
                                                ? 1
                                                : -1) +
                                            tabs.length) %
                                        tabs.length
                                    setActive(tabs[next].key)
                                    event.currentTarget.parentElement
                                        .querySelectorAll<HTMLButtonElement>(
                                            "button"
                                        )
                                        [next].focus()
                                }}>
                                <Icon iconName={tab.icon} />
                                <span>{intl.get(`settings.${tab.key}`)}</span>
                            </button>
                        ))}
                    </nav>
                </aside>
                <main
                    id="modern-settings-content"
                    className={mergeClasses(
                        "modern-settings-main",
                        classes.main
                    )}
                    role="tabpanel"
                    aria-labelledby={`modern-settings-tab-${active}`}>
                    <header
                        className={mergeClasses(
                            "modern-settings-header",
                            classes.handle,
                            drag.dragging && classes.dragging
                        )}
                        {...drag.handlers}>
                        <h1>
                            <Icon
                                iconName={tabs.find(t => t.key === active).icon}
                            />
                            {intl.get(`settings.${active}`)}
                        </h1>
                        <button
                            type="button"
                            disabled={exiting}
                            aria-label={intl.get("settings.exit")}
                            title={intl.get("settings.exit")}
                            onClick={close}>
                            <Icon iconName="Cancel" />
                        </button>
                    </header>
                    {fetching && (
                        <p className={classes.updateStatus} role="status">
                            {intl.get(
                                background
                                    ? "policy.backgroundWorking"
                                    : "policy.manualWorking",
                                { done: progress, total }
                            )}
                        </p>
                    )}
                    <div
                        className={mergeClasses(
                            "modern-settings-scroll",
                            classes.scroll
                        )}
                        key={active}>
                        {content[active]}
                    </div>
                </main>
                {blocked && (
                    <FocusTrapZone
                        isClickableOutsideFocusTrap={true}
                        className="loading">
                        <Spinner
                            label={intl.get("settings.fetching")}
                            labelPosition="below"
                            size="tiny"
                            tabIndex={0}
                        />
                    </FocusTrapZone>
                )}
            </div>
        </div>
    )
}

export default Settings
