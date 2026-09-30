import * as React from "react"
import { Icon } from "@fluentui/react"
import { openItemMenu } from "../../scripts/models/app"
import { useEffect, useRef, useState } from "react"
import { makeStyles, mergeClasses } from "@griffel/react"
import intl from "react-intl-universal"
import { ContentView, SourceCategory } from "../../schema-types"
import { loadMore } from "../../scripts/models/feed"
import {
    getItemMedia,
    markRead,
    markUnread,
    RSSItem,
    toggleStarred,
} from "../../scripts/models/item"
import { showItem } from "../../scripts/models/page"
import { useAppDispatch, useAppSelector } from "../../scripts/reducer"
import Time from "../utils/time"
import FeedToolbar from "./feed-toolbar"
import { Star16Filled } from "@fluentui/react-icons"

const useStyles = makeStyles({
    pictures: {
        "& .modern-feed-items": { columnGap: "8px", rowGap: "12px" },
    },
    videos: {
        "& .modern-feed-items": { columnGap: "12px", rowGap: "16px" },
    },
    media: {
        "& .modern-entry": {
            maxWidth: "none",
            padding: "3px",
            borderRadius: "8px",
        },
        "& .modern-entry-body": {
            padding: "5px 2px 0",
            display: "flex",
            flexDirection: "column",
        },
        "& .modern-entry h2": { fontSize: "12px", order: 1, marginTop: 0 },
        "& .modern-entry-meta": {
            order: 2,
            fontSize: "11px",
            gap: "4px",
            marginTop: "3px",
        },
        "& .modern-entry-meta .time": { marginLeft: "0", flexShrink: 0 },
        "& .modern-entry-meta > span": {
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
        },
    },
    imageOnly: {
        "& .modern-entry-body": { display: "none" },
    },
    missingImage: {
        display: "grid",
        placeItems: "center",
        height: "100%",
        color: "var(--neutralSecondary)",
    },
    body: { position: "relative" },
    starredBody: { "& h2": { paddingRight: "24px" } },
    star: {
        position: "absolute",
        right: "4px",
        top: "5px",
        display: "inline-flex",
        color: "#fb923c",
        pointerEvents: "none",
    },
    starOverlay: {
        top: "auto",
        bottom: "10px",
        right: "10px",
        padding: "4px",
        borderRadius: "6px",
        backgroundColor: "var(--white)",
        boxShadow: "0 1px 6px #0003",
    },
})

const ModernFeed: React.FC<{ feedId: string; view: ContentView }> = ({
    feedId,
    view,
}) => {
    const dispatch = useAppDispatch()
    const classes = useStyles()
    const layout = useAppSelector(s => s.page.mediaLayouts[view])
    const scrollRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(0)
    const isMediaView =
        view === SourceCategory.Pictures || view === SourceCategory.Videos
    useEffect(() => {
        const element = scrollRef.current
        if (!element || !isMediaView) return
        const observer = new ResizeObserver(() => {
            const styles = getComputedStyle(element)
            setWidth(
                element.clientWidth -
                    parseFloat(styles.paddingLeft) -
                    parseFloat(styles.paddingRight)
            )
        })
        observer.observe(element)
        return () => observer.disconnect()
    }, [view])
    const gap = view === SourceCategory.Pictures ? 8 : 12
    const maximumColumns = Math.max(1, Math.floor((width + gap) / (180 + gap)))
    const automaticColumns = Math.min(
        6,
        Math.max(1, Math.floor((width + gap) / (280 + gap)))
    )
    const columns = Math.min(
        layout?.columns || automaticColumns,
        maximumColumns
    )
    const feed = useAppSelector(s => s.feeds[feedId])
    const items = useAppSelector(s =>
        s.feeds[feedId]
            ? s.feeds[feedId].iids
                  .map(iid => s.items[iid])
                  .filter(
                      item =>
                          item &&
                          (!s.app.privacyMode ||
                              !s.sources[item.source]?.private)
                  )
            : []
    )
    const sources = useAppSelector(s => s.sources)
    const selectedKey = useAppSelector(s => s.app.menuKey)
    const selectedTitle = useAppSelector(s => s.app.title)
    const selectedSource = selectedKey.startsWith("s-")
        ? sources[Number(selectedKey.slice(2))]
        : null

    const open = (item: RSSItem) => {
        dispatch(markRead(item))
        dispatch(showItem(feedId, item))
    }

    const scrollTitle = (event: React.MouseEvent<HTMLHeadingElement>) => {
        const heading = event.currentTarget
        const text = heading.firstElementChild as HTMLElement
        const distance = text.scrollWidth - heading.clientWidth
        if (distance <= 1) return
        heading.style.setProperty("--title-scroll-distance", `${distance}px`)
        heading.style.setProperty(
            "--title-scroll-duration",
            `${Math.max(4, distance / 28 + 3)}s`
        )
        heading.classList.add("scrolling")
    }

    return (
        <div
            className={mergeClasses(
                `modern-feed modern-feed-${view}`,
                isMediaView && classes.media,
                view === SourceCategory.Pictures && classes.pictures,
                view === SourceCategory.Videos && classes.videos,
                view === SourceCategory.Pictures &&
                    layout.imageOnly &&
                    classes.imageOnly
            )}>
            <header className="modern-feed-heading">
                {selectedSource?.iconurl && (
                    <img src={selectedSource.iconurl} alt="" />
                )}
                <h1>
                    {selectedTitle || intl.get(`contentView.${view}`) || view}
                </h1>
                {!selectedSource && <span>{items.length}</span>}
                <FeedToolbar />
            </header>
            <div className="modern-feed-scroll" ref={scrollRef}>
                <div
                    className="modern-feed-items"
                    style={
                        isMediaView
                            ? {
                                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                              }
                            : undefined
                    }>
                    {items.map(item => {
                        const source = sources[item.source]
                        if (!source) return null
                        const media = getItemMedia(item)
                        const image = item.thumb || media.images?.[0]
                        const isMedia =
                            view === SourceCategory.Pictures ||
                            view === SourceCategory.Videos
                        return (
                            <article
                                key={item._id}
                                className={`modern-entry ${
                                    item.hasRead ? "read" : ""
                                }`}
                                onContextMenu={event => {
                                    event.preventDefault()
                                    dispatch(openItemMenu(item, feedId, event))
                                }}>
                                {isMedia && (
                                    <div className="modern-entry-quick-actions">
                                        <button
                                            type="button"
                                            aria-label={
                                                item.starred
                                                    ? intl.get("article.unstar")
                                                    : intl.get("article.star")
                                            }
                                            title={
                                                item.starred
                                                    ? intl.get("article.unstar")
                                                    : intl.get("article.star")
                                            }
                                            onClick={() =>
                                                dispatch(toggleStarred(item))
                                            }>
                                            <Icon
                                                iconName={
                                                    item.starred
                                                        ? "FavoriteStarFill"
                                                        : "FavoriteStar"
                                                }
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={
                                                item.hasRead
                                                    ? intl.get(
                                                          "article.markUnread"
                                                      )
                                                    : intl.get(
                                                          "article.markRead"
                                                      )
                                            }
                                            title={
                                                item.hasRead
                                                    ? intl.get(
                                                          "article.markUnread"
                                                      )
                                                    : intl.get(
                                                          "article.markRead"
                                                      )
                                            }
                                            onClick={() =>
                                                dispatch(
                                                    item.hasRead
                                                        ? markUnread(item)
                                                        : markRead(item)
                                                )
                                            }>
                                            <Icon
                                                iconName={
                                                    item.hasRead
                                                        ? "RadioBtnOn"
                                                        : "StatusCircleRing"
                                                }
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={
                                                intl.get("context.more") ||
                                                "More"
                                            }
                                            title={
                                                intl.get("context.more") ||
                                                "More"
                                            }
                                            onClick={event =>
                                                dispatch(
                                                    openItemMenu(
                                                        item,
                                                        feedId,
                                                        event
                                                    )
                                                )
                                            }>
                                            <Icon iconName="More" />
                                        </button>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className="modern-entry-main"
                                    onDragStart={event =>
                                        event.preventDefault()
                                    }
                                    onClick={() => open(item)}>
                                    {view === SourceCategory.Pictures && (
                                        <div className="modern-picture-frame">
                                            {image ? (
                                                <img
                                                    className="modern-entry-picture"
                                                    src={image}
                                                    alt=""
                                                    draggable={false}
                                                />
                                            ) : (
                                                <span
                                                    className={
                                                        classes.missingImage
                                                    }>
                                                    <Icon iconName="Photo2" />
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {view === SourceCategory.Videos && (
                                        <div className="modern-entry-video">
                                            {image && (
                                                <img
                                                    src={image}
                                                    alt=""
                                                    draggable={false}
                                                />
                                            )}
                                            <span className="modern-play">
                                                ▶
                                            </span>
                                            {media.duration && (
                                                <small>
                                                    {Math.floor(
                                                        media.duration / 60
                                                    )}
                                                    :
                                                    {String(
                                                        media.duration % 60
                                                    ).padStart(2, "0")}
                                                </small>
                                            )}
                                        </div>
                                    )}
                                    <div
                                        className={mergeClasses(
                                            "modern-entry-body",
                                            classes.body,
                                            item.starred && classes.starredBody
                                        )}>
                                        {item.starred &&
                                            !(
                                                view ===
                                                    SourceCategory.Pictures &&
                                                layout.imageOnly
                                            ) && (
                                                <span
                                                    className={classes.star}
                                                    role="img"
                                                    aria-label={intl.get(
                                                        "subscriptions.starred"
                                                    )}
                                                    title={intl.get(
                                                        "subscriptions.starred"
                                                    )}>
                                                    <Star16Filled />
                                                </span>
                                            )}
                                        <div className="modern-entry-meta">
                                            {source.iconurl && (
                                                <img
                                                    src={source.iconurl}
                                                    alt=""
                                                />
                                            )}
                                            <span>{source.name}</span>
                                            <Time date={item.date} />
                                        </div>
                                        {view === SourceCategory.Social &&
                                            item.creator && (
                                                <strong className="modern-entry-creator">
                                                    {item.creator}
                                                </strong>
                                            )}
                                        <h2
                                            title={item.title}
                                            onMouseEnter={scrollTitle}
                                            onMouseLeave={event =>
                                                event.currentTarget.classList.remove(
                                                    "scrolling"
                                                )
                                            }>
                                            <span>{item.title}</span>
                                        </h2>
                                        {view === SourceCategory.Social &&
                                            item.snippet !== item.title && (
                                                <p>{item.snippet}</p>
                                            )}
                                        {view === SourceCategory.Social &&
                                            image && (
                                                <img
                                                    className="modern-entry-social-image"
                                                    src={image}
                                                    alt=""
                                                />
                                            )}
                                    </div>
                                    {item.starred &&
                                        view === SourceCategory.Pictures &&
                                        layout.imageOnly && (
                                            <span
                                                className={mergeClasses(
                                                    classes.star,
                                                    classes.starOverlay
                                                )}
                                                role="img"
                                                aria-label={intl.get(
                                                    "subscriptions.starred"
                                                )}
                                                title={intl.get(
                                                    "subscriptions.starred"
                                                )}>
                                                <Star16Filled />
                                            </span>
                                        )}
                                </button>
                            </article>
                        )
                    })}
                </div>
                {feed?.loaded && !feed.allLoaded && (
                    <button
                        type="button"
                        className="modern-load-more"
                        disabled={feed.loading}
                        onClick={() => dispatch(loadMore(feed))}>
                        {intl.get("loadMore")}
                    </button>
                )}
                {feed?.loaded && !items.length && (
                    <div className="modern-feed-empty">
                        {intl.get("article.empty")}
                    </div>
                )}
            </div>
        </div>
    )
}

export default ModernFeed
