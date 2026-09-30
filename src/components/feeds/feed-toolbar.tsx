import * as React from "react"
import intl from "react-intl-universal"
import { Icon, ContextualMenu } from "@fluentui/react"
import { useState } from "react"
import { SourceCategory } from "../../schema-types"
import { makeStyles, mergeClasses } from "@fluentui/react-components"
import { fetchItems } from "../../scripts/models/item"
import { FilterType } from "../../scripts/models/feed"
import { switchFilter, setMediaLayout } from "../../scripts/models/page"
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
    const view = useAppSelector(s => s.page.contentView)
    const collection = useAppSelector(s => s.page.collection)
    const layout = useAppSelector(s => s.page.mediaLayouts[view])
    const [layoutTarget, setLayoutTarget] = useState<HTMLElement>(null)
    const unreadOnly = !(filter & FilterType.ShowRead)

    return (
        <FlatButtonGroup styleClass={classes.actions}>
            {(view === SourceCategory.Pictures ||
                view === SourceCategory.Videos) && (
                <>
                    <FlatButton
                        styleClass={classes.button}
                        ariaLabel={intl.get("subscriptions.layout")}
                        onClick={event => setLayoutTarget(event.currentTarget)}>
                        <Icon iconName="GridViewMedium" />
                    </FlatButton>
                    {layoutTarget && (
                        <ContextualMenu
                            target={layoutTarget}
                            onDismiss={() => setLayoutTarget(null)}
                            items={[
                                ...[0, 2, 3, 4, 5, 6].map(columns => ({
                                    key: String(columns),
                                    text: columns
                                        ? intl.get("subscriptions.columns", {
                                              count: columns,
                                          })
                                        : intl.get("subscriptions.autoColumns"),
                                    canCheck: true,
                                    checked: layout.columns === columns,
                                    onClick: () => {
                                        void dispatch(
                                            setMediaLayout(view, {
                                                ...layout,
                                                columns,
                                            })
                                        )
                                    },
                                })),
                                ...(view === SourceCategory.Pictures
                                    ? [
                                          {
                                              key: "imageOnly",
                                              text: intl.get(
                                                  "subscriptions.imageOnly"
                                              ),
                                              canCheck: true,
                                              checked: layout.imageOnly,
                                              onClick: () => {
                                                  void dispatch(
                                                      setMediaLayout(view, {
                                                          ...layout,
                                                          imageOnly:
                                                              !layout.imageOnly,
                                                      })
                                                  )
                                              },
                                          },
                                      ]
                                    : []),
                            ]}
                        />
                    )}
                </>
            )}
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
                                ? collection
                                    ? FilterType.StarredOnly
                                    : FilterType.Default
                                : collection
                                ? FilterType.None
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
