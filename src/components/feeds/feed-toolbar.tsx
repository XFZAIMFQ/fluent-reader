import * as React from "react"
import intl from "react-intl-universal"
import { Icon } from "@fluentui/react"
import { makeStyles, mergeClasses } from "@fluentui/react-components"
import { fetchItems } from "../../scripts/models/item"
import { FilterType } from "../../scripts/models/feed"
import { switchFilter } from "../../scripts/models/page"
import { openMarkAllMenu } from "../../scripts/models/app"
import { useAppDispatch, useAppSelector } from "../../scripts/reducer"
import { FlatButton } from "../utils/FlatButton"
import { FlatButtonGroup } from "../utils/FlatButtonGroup"

const useStyles = makeStyles({
    actions: {
        display: "flex",
        flexShrink: 0,
        marginLeft: "auto",
        WebkitAppRegion: "no-drag",
    },
    button: {
        width: "34px",
        height: "34px",
        lineHeight: "34px",
        borderRadius: "7px",
        color: "var(--neutralSecondary)",
        cursor: "pointer",
    },
    active: {
        color: "var(--primary)",
    },
})

const FeedToolbar: React.FC = () => {
    const dispatch = useAppDispatch()
    const classes = useStyles()
    const fetching = useAppSelector(
        s =>
            !s.app.sourceInit ||
            !s.app.feedInit ||
            s.app.syncing ||
            s.app.fetchingItems
    )
    const filter = useAppSelector(s => s.page.filter.type)
    const unreadOnly = (filter & ~FilterType.Toggles) === FilterType.UnreadOnly

    return (
        <FlatButtonGroup styleClass={classes.actions}>
            <FlatButton
                styleClass={classes.button}
                fetching={fetching}
                disabled={fetching}
                ariaLabel={intl.get("nav.refresh")}
                title={intl.get("nav.refresh")}
                onClick={() => dispatch(fetchItems())}>
                <Icon iconName="Refresh" />
            </FlatButton>
            <FlatButton
                styleClass={mergeClasses(
                    classes.button,
                    unreadOnly && classes.active
                )}
                ariaLabel={
                    intl.get("context.unreadOnly") || intl.get("context.filter")
                }
                title={
                    intl.get("context.unreadOnly") || intl.get("context.filter")
                }
                onClick={() =>
                    dispatch(
                        switchFilter(
                            unreadOnly
                                ? FilterType.Default
                                : FilterType.UnreadOnly
                        )
                    )
                }>
                <Icon
                    iconName={unreadOnly ? "RadioBtnOn" : "StatusCircleRing"}
                />
            </FlatButton>
            <FlatButton
                id="mark-all-toggle"
                styleClass={classes.button}
                ariaLabel={intl.get("nav.markAllRead")}
                title={intl.get("nav.markAllRead")}
                onClick={() => dispatch(openMarkAllMenu())}>
                <Icon iconName="InboxCheck" />
            </FlatButton>
        </FlatButtonGroup>
    )
}

export default FeedToolbar
