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
    const display = useAppSelector(s => s.app.settings.display)
    const selectedSids = useAppSelector(s => s.app.settings.sids)
    const blocked = useAppSelector(
        s =>
            !s.app.sourceInit ||
            s.app.syncing ||
            s.app.fetchingItems ||
            s.app.settings.saving
    )
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
                className="settings modern-settings-panel"
                role="dialog"
                aria-modal
                aria-label={intl.get("settings.name")}>
                <aside className="modern-settings-sidebar">
                    <div className="modern-settings-brand">
                        <img src="icons/logo.svg" alt="" />
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
                    className="modern-settings-main"
                    role="tabpanel"
                    aria-labelledby={`modern-settings-tab-${active}`}>
                    <header className="modern-settings-header">
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
                    <div className="modern-settings-scroll" key={active}>
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
