import * as React from "react"
import intl from "react-intl-universal"
import { Icon } from "@fluentui/react"
import {
    exitSettings,
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
    const visible = Object.values(sources).filter(
        source => !source.hidden && (!app.privacyMode || !source.private)
    )
    const unread = visible.reduce((sum, source) => sum + source.unreadCount, 0)

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
