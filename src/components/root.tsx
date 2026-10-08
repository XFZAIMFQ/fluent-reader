import * as React from "react"
import { closeContextMenu } from "../scripts/models/app"
import Page from "./page"
import { Menu } from "./menu"
import Nav from "./nav"
import StatusBar from "./status-bar"
import Settings from "./settings"
import { SourceEditor } from "./source-editor"
import { useAppDispatch, useAppSelector } from "../scripts/reducer"
import { ContextMenu } from "./context-menu"
import LogMenu from "./log-menu"
import RefreshNotice from "./refresh-notice"
import { FluentProvider, makeStyles } from "@fluentui/react-components"
import { useEffect, useMemo, useState } from "react"
import { ThemeProvider } from "@fluentui/react"
import { CUSTOM_STYLE_HOOKS, createAppTheme } from "./utils/theme"
import { CustomStyleHooksProvider_unstable as CustomStyleHooksProvider } from "@fluentui/react-shared-contexts"
import { getFontFamilyForLocale } from "../scripts/settings"
import { initFeeds } from "../scripts/models/feed"
import { updateUnreadCounts } from "../scripts/models/source"
import { websiteDomain } from "../scripts/source-metadata"

const useClasses = makeStyles({
    root: {
        background: "none",
    },
})

const Root: React.FC = () => {
    const dispatch = useAppDispatch()
    const locale = useAppSelector(s => s.app.locale)
    const sourceInit = useAppSelector(s => s.app.sourceInit)
    const filterSettings = useAppSelector(s =>
        JSON.stringify({
            sources: Object.values(s.sources).map(source => [
                source.sid,
                websiteDomain(source.siteUrl),
                source.autoGroup,
                source.policy?.contentFilter,
            ]),
            groups: s.groups.map(group => [
                group.isMultiple,
                group.name,
                group.sids,
                group.policy?.contentFilter,
            ]),
            domains: Object.entries(
                s.page.readerPreferences.domainPolicies
            ).map(([domain, policy]) => [domain, policy.contentFilter]),
        })
    )
    useEffect(() => {
        if (!sourceInit) return
        const timer = setTimeout(() => void dispatch(initFeeds(true)), 50)
        return () => clearTimeout(timer)
    }, [sourceInit, filterSettings])
    useEffect(() => {
        if (!sourceInit) return
        const timer = setTimeout(() => void dispatch(updateUnreadCounts()), 100)
        return () => clearTimeout(timer)
    }, [sourceInit, filterSettings])

    const classes = useClasses()
    const [isDarkMode, setIsDarkMode] = useState(() =>
        globalThis.settings.shouldUseDarkColors()
    )
    useEffect(() => {
        globalThis.settings.addThemeUpdateListener(shouldDark => {
            setIsDarkMode(shouldDark)
        })
    }, [])
    const themeBundle = useMemo(
        () => createAppTheme(isDarkMode, getFontFamilyForLocale(locale)),
        [isDarkMode, locale]
    )
    return (
        locale && (
            <ThemeProvider
                theme={themeBundle.v8Theme}
                applyTo="none"
                style={{ height: "100%" }}>
                <FluentProvider
                    theme={themeBundle.v9Theme}
                    style={{ height: "100%" }}
                    className={classes.root}>
                    <CustomStyleHooksProvider value={CUSTOM_STYLE_HOOKS}>
                        <div
                            id="root"
                            key={locale}
                            onMouseDown={() => dispatch(closeContextMenu())}>
                            <Nav />
                            <div className="modern-workspace">
                                <Menu />
                                <Page />
                            </div>
                            <StatusBar />
                            <LogMenu />
                            <Settings />
                            <SourceEditor />
                            <ContextMenu />
                            <RefreshNotice />
                        </div>
                    </CustomStyleHooksProvider>
                </FluentProvider>
            </ThemeProvider>
        )
    )
}

export default Root
