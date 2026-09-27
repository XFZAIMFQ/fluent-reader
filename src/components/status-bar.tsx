import * as React from "react"
import intl from "react-intl-universal"
import { Icon } from "@fluentui/react"
import { fetchItems } from "../scripts/models/item"
import {
    exitSettings,
    openMarkAllMenu,
    toggleLogMenu,
    toggleSettings,
} from "../scripts/models/app"
import { useAppDispatch, useAppSelector } from "../scripts/reducer"
import { FlatButton } from "./utils/FlatButton"
import { FlatButtonGroup } from "./utils/FlatButtonGroup"

const StatusBar: React.FC = () => {
    const dispatch = useAppDispatch()
    const app = useAppSelector(s => s.app)
    const sources = useAppSelector(s => s.sources)
    const settingsOn = app.settings.display
    const visible = Object.values(sources).filter(source => !source.hidden)
    const unread = visible.reduce((sum, source) => sum + source.unreadCount, 0)
    const fetching =
        !app.sourceInit || !app.feedInit || app.syncing || app.fetchingItems

    return (
        <footer className="modern-statusbar">
            <span className="modern-statusbar-count">
                {visible.length} {intl.get("menu.subscriptions")} · {unread}{" "}
                {intl.get("status.unread") || "unread"}
            </span>
            <FlatButtonGroup styleClass="modern-statusbar-actions">
                {!settingsOn && (
                    <>
                        <FlatButton
                            fetching={fetching}
                            disabled={fetching}
                            ariaLabel={intl.get("nav.refresh")}
                            title={intl.get("nav.refresh")}
                            onClick={() => dispatch(fetchItems())}>
                            <Icon iconName="Refresh" />
                        </FlatButton>
                        <FlatButton
                            id="mark-all-toggle"
                            ariaLabel={intl.get("nav.markAllRead")}
                            title={intl.get("nav.markAllRead")}
                            onClick={() => dispatch(openMarkAllMenu())}>
                            <Icon iconName="InboxCheck" />
                        </FlatButton>
                        <FlatButton
                            id="log-toggle"
                            ariaLabel={intl.get("nav.notifications")}
                            title={intl.get("nav.notifications")}
                            onClick={() => dispatch(toggleLogMenu())}>
                            <Icon
                                iconName={
                                    app.logMenu.notify
                                        ? "RingerSolid"
                                        : "Ringer"
                                }
                            />
                        </FlatButton>
                    </>
                )}
                <FlatButton
                    ariaLabel={intl.get("nav.settings")}
                    title={intl.get("nav.settings")}
                    onClick={() =>
                        dispatch(settingsOn ? exitSettings() : toggleSettings())
                    }>
                    <Icon iconName="Settings" />
                </FlatButton>
            </FlatButtonGroup>
        </footer>
    )
}

export default StatusBar
