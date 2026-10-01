import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import intl from "react-intl-universal"
import { Feed } from "./feeds/feed"
import ModernFeed from "./feeds/modern-feed"
import FeedToolbar from "./feeds/feed-toolbar"
import { Icon, FocusTrapZone } from "@fluentui/react"
import ArticleContainer from "../containers/article-container"
import { SourceCategory, ViewType } from "../schema-types"
import ArticleSearch from "./utils/article-search"
import { useAppSelector, useAppDispatch } from "../scripts/reducer"
import {
    dismissItem,
    showOffsetItem,
    selectSources,
} from "../scripts/models/page"
import { initFeeds } from "../scripts/models/feed"
import { ContextMenuType } from "../scripts/models/app"
import { makeStyles, mergeClasses } from "@fluentui/react-components"
import { FlatButton } from "./utils/FlatButton"
import { FlatButtonGroup } from "./utils/FlatButtonGroup"
import { SourceEntriesMenu } from "./utils/source-entries-menu"
import {
    Dismiss16Regular,
    ArrowLeft16Regular,
    ArrowRight16Regular,
} from "@fluentui/react-icons"

const usePageClasses = makeStyles({
    hidden: { display: "none" },
    inlineReader: {
        display: "flex",
        flexDirection: "column",
        flex: "1 1 auto",
        minWidth: 0,
        height: "100%",
        backgroundColor: "var(--white)",
    },
    breadcrumb: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        minHeight: "48px",
        padding: "0 18px",
        paddingRight: "156px",
        borderBottom: "1px solid var(--neutralQuaternaryAlt)",
        color: "var(--neutralSecondary)",
        fontSize: "12px",
    },
    crumb: {
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    crumbButton: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "6px",
        cursor: "pointer",
        flexShrink: 0,
    },
    categoryCrumb: { width: "auto", padding: "0 6px", flexShrink: 0 },
    sourceCrumb: {
        width: "auto",
        maxWidth: "min(260px, 35%)",
        padding: "0 6px",
        cursor: "pointer",
    },
    body: {
        "flex": "1 1 auto",
        "minHeight": 0,
        "& > .article": {
            height: "100%",
            display: "flex",
            flexDirection: "column",
        },
        "& .modern-embedded-article-header": {
            height: "40px",
            flex: "0 0 40px",
            padding: "0 18px",
            alignItems: "center",
        },
        "& .modern-embedded-article-header::before": { display: "none" },
        "& webview, & .error-prompt": {
            flex: "1 1 auto",
            minHeight: 0,
            height: "calc(100% - 40px)",
        },
    },
    navigation: { display: "flex", marginLeft: "auto", flexShrink: 0 },
    articleBtn: {
        color: "#fff",
    },
    articleGroup: {
        position: "absolute",
        top: "calc(50% - 32px)",
    },
    articleGroupPrev: {
        left: "calc(50% - 486px)",
    },
    articleGroupNext: {
        right: "calc(50% - 486px)",
    },
})

const resizeLimit = (element: HTMLElement) =>
    Math.max(300, Math.min(680, element.parentElement.clientWidth - 325))

const Page: React.FC = () => {
    const dispatch = useAppDispatch()
    const pageClasses = usePageClasses()

    const feedId = useAppSelector(s => s.page.feedId)
    const pageTitle = useAppSelector(s => s.app.title)
    const menuKey = useAppSelector(s => s.app.menuKey)
    const contextOn = useAppSelector(
        s => s.app.contextMenu.type !== ContextMenuType.Hidden
    )
    const itemId = useAppSelector(s => s.page.itemId)
    const readingMode = useAppSelector(
        s => s.page.readerPreferences.readingMode
    )
    const currentItem = useAppSelector(s => s.items[itemId])
    const currentSource = useAppSelector(s =>
        currentItem ? s.sources[currentItem.source] : null
    )
    const itemFromFeed = useAppSelector(s => s.page.itemFromFeed)
    const contentView = useAppSelector(s => s.page.contentView)
    const [listWidth, setListWidth] = useState(() => {
        const saved = Number(localStorage.getItem("modernListWidth"))
        return saved >= 300 && saved <= 680 ? saved : 390
    })
    const [dragging, setDragging] = useState(false)
    const dividerRef = useRef<HTMLDivElement>(null)
    const widthRef = useRef(listWidth)
    const preferredWidthRef = useRef(listWidth)
    const stopResizeRef = useRef<() => void>()

    useEffect(() => {
        const divider = dividerRef.current
        if (!divider?.parentElement) return
        const observer = new ResizeObserver(() => {
            const width = Math.min(
                preferredWidthRef.current,
                resizeLimit(divider)
            )
            if (width !== widthRef.current) {
                widthRef.current = width
                setListWidth(width)
            }
        })
        observer.observe(divider.parentElement)
        return () => {
            observer.disconnect()
            stopResizeRef.current?.()
        }
    }, [contentView])

    useEffect(() => () => stopResizeRef.current?.(), [])

    const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return
        event.preventDefault()
        stopResizeRef.current?.()
        const divider = event.currentTarget
        const pointerId = event.pointerId
        setDragging(true)
        const startX = event.clientX
        const initialWidth = widthRef.current
        const onMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== pointerId) return
            const nextWidth = Math.max(
                300,
                Math.min(
                    resizeLimit(divider),
                    initialWidth + moveEvent.clientX - startX
                )
            )
            widthRef.current = nextWidth
            preferredWidthRef.current = nextWidth
            setListWidth(nextWidth)
        }
        const stop = () => {
            if (stopResizeRef.current !== stop) return
            stopResizeRef.current = undefined
            setDragging(false)
            localStorage.setItem(
                "modernListWidth",
                String(preferredWidthRef.current)
            )
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            window.removeEventListener("blur", stop)
            divider.removeEventListener("lostpointercapture", stop)
            if (divider.hasPointerCapture(pointerId))
                divider.releasePointerCapture(pointerId)
        }
        const onUp = (upEvent: PointerEvent) => {
            if (upEvent.pointerId === pointerId) stop()
        }
        stopResizeRef.current = stop
        divider.setPointerCapture(pointerId)
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)
        window.addEventListener("blur", stop)
        divider.addEventListener("lostpointercapture", stop)
    }

    const handleDismissItem = useCallback(() => dispatch(dismissItem()), [])
    const handleOffsetItem = useCallback(
        (event: React.MouseEvent, offset: number) => {
            event.stopPropagation()
            dispatch(showOffsetItem(offset))
        },
        []
    )
    const prevItem = useCallback(
        (event: React.MouseEvent) => handleOffsetItem(event, -1),
        [handleOffsetItem]
    )
    const nextItem = useCallback(
        (event: React.MouseEvent) => handleOffsetItem(event, 1),
        [handleOffsetItem]
    )

    return contentView === "all" || contentView === SourceCategory.Articles ? (
        <>
            <div key="list" className="list-main modern-reader">
                <ArticleSearch />
                <div
                    className="list-feed-container"
                    style={{ width: listWidth }}>
                    <div className="modern-list-heading">
                        <strong>
                            {pageTitle ||
                                (contentView === "all"
                                    ? intl.get("allArticles")
                                    : intl.get("contentView.articles"))}
                        </strong>
                        <FeedToolbar />
                    </div>
                    <Feed
                        viewType={ViewType.List}
                        feedId={feedId}
                        key={feedId}
                    />
                </div>
                <div
                    ref={dividerRef}
                    className={`modern-reader-divider ${
                        dragging ? "dragging" : ""
                    }`}
                    role="separator"
                    tabIndex={0}
                    aria-orientation="vertical"
                    aria-label="Resize article list"
                    aria-valuemin={300}
                    aria-valuemax={680}
                    aria-valuenow={listWidth}
                    onPointerDown={startResize}
                    onKeyDown={event => {
                        if (
                            event.key !== "ArrowLeft" &&
                            event.key !== "ArrowRight"
                        )
                            return
                        event.preventDefault()
                        const direction = event.key === "ArrowRight" ? 20 : -20
                        const width = Math.max(
                            300,
                            Math.min(
                                resizeLimit(event.currentTarget),
                                listWidth + direction
                            )
                        )
                        widthRef.current = width
                        preferredWidthRef.current = width
                        setListWidth(width)
                        localStorage.setItem("modernListWidth", String(width))
                    }}
                />
                {dragging && <div className="modern-reader-resize-overlay" />}
                {itemId ? (
                    <div className="side-article-wrapper">
                        <ArticleContainer itemId={itemId} embedded />
                    </div>
                ) : (
                    <div className="side-logo-wrapper">
                        <div className="modern-empty-reader">
                            <Icon iconName="TextDocument" />
                            <p>
                                {intl.get("articleSelectToRead") ||
                                    "Select an article to read"}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </>
    ) : (
        <>
            <div
                key="card"
                className={mergeClasses(
                    "main modern-collection",
                    readingMode === "inline" &&
                        itemId !== null &&
                        pageClasses.hidden
                )}>
                <ArticleSearch />
                <ModernFeed
                    feedId={feedId}
                    view={contentView}
                    visible={readingMode !== "inline" || itemId === null}
                />
            </div>
            {itemId !== null &&
                readingMode === "inline" &&
                currentItem &&
                currentSource && (
                    <section
                        className={pageClasses.inlineReader}
                        data-inline-reader>
                        <nav
                            className={pageClasses.breadcrumb}
                            aria-label={intl.get("policy.breadcrumb")}>
                            <FlatButton
                                styleClass={pageClasses.crumbButton}
                                ariaLabel={intl.get("policy.backToList")}
                                onClick={() => dispatch(dismissItem())}>
                                <Dismiss16Regular />
                            </FlatButton>
                            <FlatButton
                                styleClass={mergeClasses(
                                    pageClasses.crumbButton,
                                    pageClasses.categoryCrumb
                                )}
                                onClick={() => dispatch(dismissItem())}>
                                {intl.get(`contentView.${contentView}`)}
                            </FlatButton>
                            <span>/</span>
                            <FlatButton
                                title={currentSource.name}
                                styleClass={mergeClasses(
                                    pageClasses.crumb,
                                    pageClasses.crumbButton,
                                    pageClasses.sourceCrumb
                                )}
                                onClick={() => {
                                    dispatch(dismissItem())
                                    if (menuKey !== `s-${currentSource.sid}`) {
                                        dispatch(
                                            selectSources(
                                                [currentSource.sid],
                                                `s-${currentSource.sid}`,
                                                currentSource.name
                                            )
                                        )
                                        dispatch(initFeeds())
                                    }
                                }}>
                                {currentSource.name}
                            </FlatButton>
                            <SourceEntriesMenu
                                key={currentSource.sid}
                                currentItem={currentItem}
                                sourceName={currentSource.name}
                                feedId={feedId}
                            />
                            <span>/</span>
                            <span
                                className={pageClasses.crumb}
                                title={currentItem.title}>
                                {currentItem.title}
                            </span>
                            {itemFromFeed && (
                                <div className={pageClasses.navigation}>
                                    <FlatButton
                                        styleClass={pageClasses.crumbButton}
                                        ariaLabel={intl.get("policy.previous")}
                                        onClick={prevItem}>
                                        <ArrowLeft16Regular />
                                    </FlatButton>
                                    <FlatButton
                                        styleClass={pageClasses.crumbButton}
                                        ariaLabel={intl.get("policy.next")}
                                        onClick={nextItem}>
                                        <ArrowRight16Regular />
                                    </FlatButton>
                                </div>
                            )}
                        </nav>
                        <div className={pageClasses.body}>
                            <ArticleContainer itemId={itemId} embedded />
                        </div>
                    </section>
                )}
            {itemId !== null && readingMode === "overlay" && (
                <FocusTrapZone
                    disabled={contextOn}
                    ignoreExternalFocusing={true}
                    isClickableOutsideFocusTrap={true}
                    className="article-container"
                    onClick={handleDismissItem}>
                    <div
                        className="article-wrapper"
                        onClick={e => e.stopPropagation()}>
                        <ArticleContainer itemId={itemId} />
                    </div>
                    {itemFromFeed && (
                        <>
                            <FlatButtonGroup
                                styleClass={mergeClasses(
                                    pageClasses.articleGroup,
                                    pageClasses.articleGroupPrev
                                )}>
                                <FlatButton
                                    styleClass={pageClasses.articleBtn}
                                    ariaLabel="Previous article"
                                    onClick={prevItem}>
                                    <Icon iconName="Back" />
                                </FlatButton>
                            </FlatButtonGroup>
                            <FlatButtonGroup
                                styleClass={mergeClasses(
                                    pageClasses.articleGroup,
                                    pageClasses.articleGroupNext
                                )}>
                                <FlatButton
                                    styleClass={pageClasses.articleBtn}
                                    ariaLabel="Next article"
                                    onClick={nextItem}>
                                    <Icon iconName="Forward" />
                                </FlatButton>
                            </FlatButtonGroup>
                        </>
                    )}
                </FocusTrapZone>
            )}
        </>
    )
}

export default Page
