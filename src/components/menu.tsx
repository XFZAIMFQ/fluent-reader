import * as React from "react"
import { useEffect, useState } from "react"
import intl from "react-intl-universal"
import { Icon } from "@fluentui/react"
import { makeStyles, mergeClasses } from "@griffel/react"
import {
    Apps24Regular,
    Chat24Regular,
    DocumentText24Regular,
    Image24Regular,
    Video24Regular,
    ChevronDown16Regular,
    ChevronRight16Regular,
    ArrowExit20Regular,
} from "@fluentui/react-icons"
import { ContentView, SourceCategory } from "../schema-types"
import { addSource, RSSSource, updateSource } from "../scripts/models/source"
import { initFeeds } from "../scripts/models/feed"
import { useAppDispatch, useAppSelector } from "../scripts/reducer"
import {
    openGroupMenu,
    openSourceMenu,
    toggleSettings,
} from "../scripts/models/app"
import {
    toggleGroupExpansion,
    moveToNamedGroup,
    reorderSourceGroups,
    setSourceGrouping,
} from "../scripts/models/group"
import { sidebarGroups } from "../scripts/sidebar-groups"
import {
    selectAllArticles,
    selectCollection,
    refreshSourceSelection,
    selectSources,
    switchContentView,
} from "../scripts/models/page"

const views: ContentView[] = [
    "all",
    SourceCategory.Articles,
    SourceCategory.Social,
    SourceCategory.Pictures,
    SourceCategory.Videos,
]

const viewIcons = {
    all: Apps24Regular,
    articles: DocumentText24Regular,
    social: Chat24Regular,
    pictures: Image24Regular,
    videos: Video24Regular,
}

const fallbackLabels: Record<ContentView, string> = {
    all: "All articles",
    articles: "Articles",
    social: "Social",
    pictures: "Pictures",
    videos: "Videos",
}

const label = (view: ContentView) =>
    view === "all"
        ? intl.get("allArticles") || fallbackLabels.all
        : intl.get(`contentView.${view}`) || fallbackLabels[view]

const useStyles = makeStyles({
    drop: {
        outline: "2px solid var(--primary)",
        backgroundColor: "var(--neutralLight)",
    },
    toast: {
        padding: "10px",
        fontSize: "12px",
        backgroundColor: "var(--neutralLighterAlt)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    star: { color: "#d99500" },
    row: { "cursor": "grab", ":active": { cursor: "grabbing" } },
    groupToggle: {
        "width": "32px",
        "height": "32px",
        "flexShrink": 0,
        "display": "grid",
        "placeItems": "center",
        "borderRadius": "6px",
        "& svg": { width: "18px", height: "18px" },
        ":hover": { backgroundColor: "var(--neutralLight)" },
        ":focus-visible": { outline: "2px solid var(--primary)" },
    },
    exitDrop: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        minHeight: "40px",
        padding: "4px 12px",
        margin: "6px 0",
        border: "1px dashed var(--neutralTertiary)",
        borderRadius: "8px",
        color: "var(--neutralPrimary)",
        fontSize: "13px",
    },
})

export const Menu: React.FC = () => {
    const dispatch = useAppDispatch()
    const classes = useStyles()
    const [dragSid, setDragSid] = useState<number>(null)
    const [dropKey, setDropKey] = useState("")
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    const [notice, setNotice] =
        useState<{ text: string; undo: () => void }>(null)
    const [moving, setMoving] = useState(false)
    useEffect(() => {
        if (!notice) return
        const timer = setTimeout(() => setNotice(null), 8000)
        return () => clearTimeout(timer)
    }, [notice])
    const ready = useAppSelector(s => s.app.sourceInit)
    const sources = useAppSelector(s => s.sources)
    const groups = useAppSelector(s => s.groups)
    const selected = useAppSelector(s => s.app.menuKey)
    const view = useAppSelector(s => s.page.contentView)
    const privacyMode = useAppSelector(s => s.app.privacyMode)
    const [adding, setAdding] = useState(false)
    const [url, setUrl] = useState("")
    const [category, setCategory] = useState(SourceCategory.Articles)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        const takeLink = async () => {
            const request = await globalThis.utils.takeSubscribeLink()
            if (!request) return
            setUrl(request.url)
            setCategory(request.view)
            setAdding(true)
        }
        const removeListener =
            globalThis.utils.onSubscribeLinkAvailable(takeLink)
        void takeLink()
        return removeListener
    }, [])

    const visible = Object.values(sources).filter(
        source =>
            !source.hidden &&
            (!privacyMode || !source.private) &&
            (view === "all" ||
                (source.category || SourceCategory.Articles) === view)
    )
    const { folders, singles } = sidebarGroups(groups, visible)
    const unread = visible.reduce(
        (total, source) => total + source.unreadCount,
        0
    )
    const unreadByView = (tab: ContentView) =>
        Object.values(sources)
            .filter(
                source =>
                    !source.hidden &&
                    (!privacyMode || !source.private) &&
                    (tab === "all" ||
                        (source.category || SourceCategory.Articles) === tab)
            )
            .reduce((total, source) => total + source.unreadCount, 0)

    const selectView = (next: ContentView) => {
        dispatch(switchContentView(next))
        if (next === "all") {
            dispatch(selectAllArticles())
        } else {
            const sids = Object.values(sources)
                .filter(
                    source =>
                        !source.hidden &&
                        (!privacyMode || !source.private) &&
                        (source.category || SourceCategory.Articles) === next
                )
                .map(source => source.sid)
            dispatch(selectSources(sids, `category-${next}`, label(next)))
        }
        dispatch(initFeeds())
    }

    const selectSource = (source: RSSSource) => {
        dispatch(selectSources([source.sid], `s-${source.sid}`, source.name))
        dispatch(initFeeds())
    }

    const dropHandlers = (
        key: string,
        target: {
            view?: SourceCategory
            name?: string
            sids?: number[]
            exit?: boolean
        }
    ) => ({
        onDragOver: (event: React.DragEvent) => {
            if (dragSid === null || moving) return
            event.preventDefault()
            event.dataTransfer.dropEffect = "move"
            setDropKey(key)
        },
        onDragLeave: (event: React.DragEvent) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
                setDropKey("")
        },
        onDrop: async (event: React.DragEvent) => {
            event.preventDefault()
            setDropKey("")
            if (dragSid === null || moving) return
            const original = sources[dragSid]
            if (!original || (target.view && original.category === target.view))
                return
            setMoving(true)
            const oldGroups = groups
            try {
                if (target.view)
                    await dispatch(
                        updateSource({ ...original, category: target.view })
                    )
                else if (target.exit)
                    await dispatch(
                        setSourceGrouping([original.sid], { mode: "none" })
                    )
                else
                    dispatch(
                        moveToNamedGroup(target.name, [
                            ...(target.sids || []),
                            original.sid,
                        ])
                    )
                const expectedGroups = dispatch(
                    (_, getState) => getState().groups
                )
                dispatch(refreshSourceSelection())
                await dispatch(initFeeds(true))
                setNotice({
                    text: target.exit
                        ? intl.get("subscriptions.removedFromGroup")
                        : intl.get("subscriptions.moved", {
                              name: target.name || label(target.view),
                          }),
                    undo: () => {
                        setNotice(null)
                        void dispatch(async (dispatch, getState) => {
                            const latest = getState().sources[original.sid]
                            if (!latest) return
                            if (target.view && latest.category === target.view)
                                await dispatch(
                                    updateSource({
                                        ...latest,
                                        category: original.category,
                                    })
                                )
                            if (
                                !target.view &&
                                getState().groups === expectedGroups
                            ) {
                                if (target.exit && latest.autoGroup === false)
                                    await dispatch(
                                        updateSource({
                                            ...latest,
                                            autoGroup:
                                                original.autoGroup !== false,
                                        })
                                    )
                                dispatch(reorderSourceGroups(oldGroups))
                            }
                            dispatch(refreshSourceSelection())
                            await dispatch(initFeeds(true))
                        })
                    },
                })
            } catch (error) {
                globalThis.utils.showErrorBox(
                    intl.get("sources.edit"),
                    String(error)
                )
            } finally {
                setMoving(false)
                setDragSid(null)
            }
        },
    })
    const renderSource = (sid: number, nested = false) => (
        <SourceRow
            key={sid}
            source={sources[sid]}
            active={selected === `s-${sid}`}
            nested={nested}
            styleClass={classes.row}
            onDragStart={event => {
                event.dataTransfer.effectAllowed = "move"
                event.dataTransfer.setData("text/plain", String(sid))
                setDragSid(sid)
                setNotice(null)
            }}
            onDragEnd={() => {
                setDragSid(null)
                setDropKey("")
            }}
            onClick={() => selectSource(sources[sid])}
            onContextMenu={event => dispatch(openSourceMenu(sid, event))}
        />
    )

    const submitSource = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!url.trim() || submitting) return
        setSubmitting(true)
        try {
            const sid = await dispatch(
                addSource(url.trim(), null, false, category)
            )
            dispatch(switchContentView(category))
            const categorySources = Object.values(sources)
                .filter(
                    source =>
                        !source.hidden &&
                        (!privacyMode || !source.private) &&
                        (source.category || SourceCategory.Articles) ===
                            category
                )
                .map(source => source.sid)
            dispatch(
                selectSources(
                    [...categorySources, sid],
                    `category-${category}`,
                    label(category),
                    true
                )
            )
            dispatch(initFeeds())
            setAdding(false)
            setUrl("")
        } catch {
            // addSource displays the error to the user.
        } finally {
            setSubmitting(false)
        }
    }

    if (!ready) return null

    return (
        <aside
            className="modern-sidebar"
            aria-label={intl.get("menu.subscriptions")}>
            <div className="modern-sidebar-heading">
                <div className="modern-brand">
                    <img src="icons/logo.svg" alt="" />
                    <strong>Fluent Reader</strong>
                </div>
                <div className="modern-sidebar-actions">
                    <button
                        type="button"
                        className="modern-add-button"
                        aria-label={intl.get("add")}
                        title={intl.get("add")}
                        onClick={() => {
                            setCategory(
                                view === "all" ? SourceCategory.Articles : view
                            )
                            setAdding(true)
                        }}>
                        +
                    </button>
                    <button
                        type="button"
                        aria-label={intl.get("nav.settings")}
                        title={intl.get("nav.settings")}
                        onClick={() => dispatch(toggleSettings())}>
                        <Icon iconName="Settings" />
                    </button>
                </div>
            </div>
            <div className="modern-tabs" role="tablist">
                {views.map(tab => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-label={label(tab)}
                        title={label(tab)}
                        data-view={tab}
                        aria-selected={view === tab}
                        className={mergeClasses(
                            view === tab ? "active" : "",
                            dropKey === `view-${tab}` && classes.drop
                        )}
                        {...(tab === "all"
                            ? {}
                            : dropHandlers(`view-${tab}`, { view: tab }))}
                        onClick={() => selectView(tab)}
                        onKeyDown={event => {
                            if (
                                event.key !== "ArrowLeft" &&
                                event.key !== "ArrowRight"
                            )
                                return
                            event.preventDefault()
                            const direction =
                                event.key === "ArrowRight" ? 1 : -1
                            const next =
                                (views.indexOf(tab) +
                                    direction +
                                    views.length) %
                                views.length
                            selectView(views[next])
                            event.currentTarget.parentElement
                                .querySelectorAll<HTMLButtonElement>("button")
                                [next].focus()
                        }}>
                        {React.createElement(viewIcons[tab])}
                        <small>{unreadByView(tab)}</small>
                    </button>
                ))}
            </div>
            <div className="modern-sidebar-list">
                <button
                    type="button"
                    className={`modern-source-row ${
                        selected === "ALL" || selected === `category-${view}`
                            ? "active"
                            : ""
                    }`}
                    onClick={() => selectView(view)}>
                    <span className="modern-source-name">{label(view)}</span>
                    {unread > 0 && <small>{unread}</small>}
                </button>
                <div className="modern-sidebar-section">
                    {intl.get("menu.subscriptions")}
                </div>
                <button
                    type="button"
                    className={`modern-source-row ${
                        selected === `starred-${view}` ? "active" : ""
                    }`}
                    onClick={() => {
                        dispatch(selectCollection(view))
                        dispatch(initFeeds())
                    }}>
                    <Icon
                        iconName="FavoriteStarFill"
                        className={classes.star}
                    />
                    <span className="modern-source-name">
                        {intl.get("subscriptions.starred")}
                    </span>
                </button>
                {dragSid !== null && (
                    <div
                        data-drop-ungrouped
                        className={mergeClasses(
                            classes.exitDrop,
                            dropKey === "ungrouped" && classes.drop
                        )}
                        {...dropHandlers("ungrouped", { exit: true })}>
                        <ArrowExit20Regular />
                        {intl.get("subscriptions.removeFromGroup")}
                    </div>
                )}
                {folders.map(group => {
                    const expanded =
                        group.index !== undefined
                            ? group.expanded
                            : !collapsed.has(`${view}-${group.key}`)
                    return (
                        <div key={group.key}>
                            <div
                                className={mergeClasses(
                                    "modern-source-row modern-group-row",
                                    dropKey === group.key && classes.drop
                                )}
                                {...dropHandlers(group.key, {
                                    name: group.name,
                                    sids: group.domain ? group.sids : [],
                                })}>
                                <button
                                    type="button"
                                    className={classes.groupToggle}
                                    aria-label={
                                        expanded
                                            ? intl.get("subscriptions.collapse")
                                            : intl.get("subscriptions.expand")
                                    }
                                    aria-expanded={expanded}
                                    onClick={() => {
                                        if (group.index !== undefined)
                                            dispatch(
                                                toggleGroupExpansion(
                                                    group.index
                                                )
                                            )
                                        else
                                            setCollapsed(previous => {
                                                const next = new Set(previous)
                                                const key = `${view}-${group.key}`
                                                if (next.has(key))
                                                    next.delete(key)
                                                else next.add(key)
                                                return next
                                            })
                                    }}>
                                    {expanded ? (
                                        <ChevronDown16Regular />
                                    ) : (
                                        <ChevronRight16Regular />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className={
                                        selected === group.key ? "active" : ""
                                    }
                                    onClick={() => {
                                        dispatch(
                                            selectSources(
                                                group.sids,
                                                group.key,
                                                group.name
                                            )
                                        )
                                        dispatch(initFeeds())
                                    }}
                                    onContextMenu={
                                        group.index === undefined
                                            ? undefined
                                            : event =>
                                                  dispatch(
                                                      openGroupMenu(
                                                          group.sids,
                                                          event
                                                      )
                                                  )
                                    }>
                                    {group.name}
                                </button>
                            </div>
                            {expanded &&
                                group.sids.map(sid => renderSource(sid, true))}
                        </div>
                    )
                })}
                {singles.map(sid => renderSource(sid))}
                {!visible.length && (
                    <p className="modern-sidebar-empty">
                        {intl.get("article.empty")}
                    </p>
                )}
            </div>
            {notice && (
                <div className={classes.toast} role="status">
                    <span>{notice.text}</span>
                    <button type="button" onClick={notice.undo}>
                        {intl.get("subscriptions.undo")}
                    </button>
                </div>
            )}
            {adding && (
                <div
                    className="modern-dialog-backdrop"
                    onMouseDown={() => setAdding(false)}>
                    <form
                        className="modern-add-dialog"
                        onMouseDown={event => event.stopPropagation()}
                        onSubmit={submitSource}>
                        <h2>{intl.get("sources.add")}</h2>
                        <label htmlFor="modern-source-url">URL</label>
                        <input
                            id="modern-source-url"
                            type="url"
                            required
                            autoFocus
                            value={url}
                            onChange={event => setUrl(event.target.value)}
                            placeholder="http://localhost:1200/..."
                        />
                        <span
                            className="modern-add-category-label"
                            id="modern-source-category-label">
                            {intl.get("contentView.category")}
                        </span>
                        <div
                            className="modern-add-category-options"
                            role="radiogroup"
                            aria-labelledby="modern-source-category-label">
                            {(views.slice(1) as SourceCategory[]).map(
                                option => {
                                    const CategoryIcon = viewIcons[option]
                                    return (
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={category === option}
                                            key={option}
                                            className={
                                                category === option
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() => setCategory(option)}>
                                            <CategoryIcon />
                                            {label(option)}
                                        </button>
                                    )
                                }
                            )}
                        </div>
                        <div className="modern-dialog-actions">
                            <button
                                type="button"
                                onClick={() => setAdding(false)}>
                                {intl.get("cancel")}
                            </button>
                            <button type="submit" disabled={submitting}>
                                {intl.get("add")}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </aside>
    )
}

const SourceRow: React.FC<{
    source: RSSSource
    active: boolean
    nested?: boolean
    styleClass?: string
    onDragStart: (event: React.DragEvent) => void
    onDragEnd: () => void
    onClick: () => void
    onContextMenu: (event: React.MouseEvent) => void
}> = ({
    source,
    active,
    nested,
    styleClass,
    onDragStart,
    onDragEnd,
    onClick,
    onContextMenu,
}) => (
    <button
        type="button"
        className={mergeClasses(
            `modern-source-row ${active ? "active" : ""} ${
                nested ? "nested" : ""
            }`,
            styleClass
        )}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        onContextMenu={onContextMenu}>
        {source.iconurl ? (
            <img
                className="modern-source-icon"
                src={source.iconurl}
                alt=""
                draggable={false}
                onError={event => {
                    event.currentTarget.style.display = "none"
                }}
            />
        ) : (
            <Icon iconName="RssFeed" />
        )}
        <span className="modern-source-name">{source.name}</span>
        {source.unreadCount > 0 && <small>{source.unreadCount}</small>}
    </button>
)
