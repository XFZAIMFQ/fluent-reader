import * as React from "react"
import { useState } from "react"
import intl from "react-intl-universal"
import { Icon } from "@fluentui/react"
import {
    Apps24Regular,
    Chat24Regular,
    DocumentText24Regular,
    Image24Regular,
    Video24Regular,
} from "@fluentui/react-icons"
import { ContentView, SourceCategory } from "../schema-types"
import { addSource, RSSSource } from "../scripts/models/source"
import { initFeeds } from "../scripts/models/feed"
import { useAppDispatch, useAppSelector } from "../scripts/reducer"
import { openGroupMenu, toggleSettings } from "../scripts/models/app"
import { toggleGroupExpansion } from "../scripts/models/group"
import {
    selectAllArticles,
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

export const Menu: React.FC = () => {
    const dispatch = useAppDispatch()
    const ready = useAppSelector(s => s.app.sourceInit)
    const settingsOn = useAppSelector(s => s.app.settings.display)
    const sources = useAppSelector(s => s.sources)
    const groups = useAppSelector(s => s.groups)
    const selected = useAppSelector(s => s.app.menuKey)
    const view = useAppSelector(s => s.page.contentView)
    const [adding, setAdding] = useState(false)
    const [url, setUrl] = useState("")
    const [category, setCategory] = useState(SourceCategory.Articles)
    const [submitting, setSubmitting] = useState(false)

    const visible = Object.values(sources).filter(
        source =>
            !source.hidden &&
            (view === "all" ||
                (source.category || SourceCategory.Articles) === view)
    )
    const visibleIds = new Set(visible.map(source => source.sid))
    const unread = visible.reduce(
        (total, source) => total + source.unreadCount,
        0
    )
    const unreadByView = (tab: ContentView) =>
        Object.values(sources)
            .filter(
                source =>
                    !source.hidden &&
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
                        (source.category || SourceCategory.Articles) ===
                            category
                )
                .map(source => source.sid)
            dispatch(
                selectSources(
                    [...categorySources, sid],
                    `category-${category}`,
                    label(category)
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

    if (!ready || settingsOn) return null

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
                        className={view === tab ? "active" : ""}
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
                    <span className="modern-source-icon">◫</span>
                    <span className="modern-source-name">{label(view)}</span>
                    {unread > 0 && <small>{unread}</small>}
                </button>
                <div className="modern-sidebar-section">
                    {intl.get("menu.subscriptions")}
                </div>
                {groups.map((group, index) => {
                    const members = group.sids
                        .filter(sid => visibleIds.has(sid))
                        .map(sid => sources[sid])
                    if (!members.length) return null
                    if (!group.isMultiple) {
                        const source = members[0]
                        return (
                            <SourceRow
                                key={source.sid}
                                source={source}
                                active={selected === `s-${source.sid}`}
                                onClick={() => selectSource(source)}
                                onContextMenu={event =>
                                    dispatch(openGroupMenu([source.sid], event))
                                }
                            />
                        )
                    }
                    return (
                        <div key={index}>
                            <div className="modern-source-row modern-group-row">
                                <button
                                    type="button"
                                    aria-label={
                                        group.expanded ? "Collapse" : "Expand"
                                    }
                                    onClick={() =>
                                        dispatch(toggleGroupExpansion(index))
                                    }>
                                    {group.expanded ? "⌄" : "›"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        dispatch(
                                            selectSources(
                                                members.map(s => s.sid),
                                                `g-${index}`,
                                                group.name
                                            )
                                        )
                                        dispatch(initFeeds())
                                    }}
                                    onContextMenu={event =>
                                        dispatch(
                                            openGroupMenu(
                                                members.map(s => s.sid),
                                                event
                                            )
                                        )
                                    }>
                                    {group.name}
                                </button>
                            </div>
                            {group.expanded &&
                                members.map(source => (
                                    <SourceRow
                                        key={source.sid}
                                        source={source}
                                        active={selected === `s-${source.sid}`}
                                        nested
                                        onClick={() => selectSource(source)}
                                        onContextMenu={event =>
                                            dispatch(
                                                openGroupMenu(
                                                    [source.sid],
                                                    event
                                                )
                                            )
                                        }
                                    />
                                ))}
                        </div>
                    )
                })}
                {!visible.length && (
                    <p className="modern-sidebar-empty">
                        {intl.get("article.empty")}
                    </p>
                )}
            </div>
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
                        <label htmlFor="modern-source-category">
                            {intl.get("contentView.category")}
                        </label>
                        <select
                            id="modern-source-category"
                            value={category}
                            onChange={event =>
                                setCategory(
                                    event.target.value as SourceCategory
                                )
                            }>
                            {views.slice(1).map(option => (
                                <option key={option} value={option}>
                                    {label(option)}
                                </option>
                            ))}
                        </select>
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
    onClick: () => void
    onContextMenu: (event: React.MouseEvent) => void
}> = ({ source, active, nested, onClick, onContextMenu }) => (
    <button
        type="button"
        className={`modern-source-row ${active ? "active" : ""} ${
            nested ? "nested" : ""
        }`}
        onClick={onClick}
        onContextMenu={onContextMenu}>
        {source.iconurl ? (
            <img className="modern-source-icon" src={source.iconurl} alt="" />
        ) : (
            <span className="modern-source-icon">◫</span>
        )}
        <span className="modern-source-name">{source.name}</span>
        {source.unreadCount > 0 && <small>{source.unreadCount}</small>}
    </button>
)
