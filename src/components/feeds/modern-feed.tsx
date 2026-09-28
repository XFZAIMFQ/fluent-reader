import * as React from "react"
import { openItemMenu } from "../../scripts/models/app"
import intl from "react-intl-universal"
import { ContentView, SourceCategory } from "../../schema-types"
import { loadMore } from "../../scripts/models/feed"
import { getItemMedia, markRead, RSSItem } from "../../scripts/models/item"
import { showItem } from "../../scripts/models/page"
import { useAppDispatch, useAppSelector } from "../../scripts/reducer"
import Time from "../utils/time"
import FeedToolbar from "./feed-toolbar"

const ModernFeed: React.FC<{ feedId: string; view: ContentView }> = ({
    feedId,
    view,
}) => {
    const dispatch = useAppDispatch()
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

    return (
        <div className={`modern-feed modern-feed-${view}`}>
            <header className="modern-feed-heading">
                {selectedSource?.iconurl && (
                    <img src={selectedSource.iconurl} alt="" />
                )}
                <h1>
                    {selectedSource
                        ? selectedTitle
                        : intl.get(`contentView.${view}`) || view}
                </h1>
                {!selectedSource && <span>{items.length}</span>}
                <FeedToolbar />
            </header>
            <div className="modern-feed-scroll">
                <div className="modern-feed-items">
                    {items.map(item => {
                        const source = sources[item.source]
                        if (!source) return null
                        const media = getItemMedia(item)
                        const image = item.thumb || media.images?.[0]
                        return (
                            <button
                                type="button"
                                key={item._id}
                                className={`modern-entry ${
                                    item.hasRead ? "read" : ""
                                }`}
                                onClick={() => open(item)}
                                onContextMenu={event => {
                                    event.preventDefault()
                                    dispatch(openItemMenu(item, feedId, event))
                                }}>
                                {view === SourceCategory.Pictures && image && (
                                    <div className="modern-picture-frame">
                                        <img
                                            className="modern-entry-picture"
                                            src={image}
                                            alt=""
                                        />
                                    </div>
                                )}
                                {view === SourceCategory.Videos && (
                                    <div className="modern-entry-video">
                                        {image && <img src={image} alt="" />}
                                        <span className="modern-play">▶</span>
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
                                <div className="modern-entry-body">
                                    <div className="modern-entry-meta">
                                        {source.iconurl && (
                                            <img src={source.iconurl} alt="" />
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
                                    <h2>{item.title}</h2>
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
                            </button>
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
