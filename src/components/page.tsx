import * as React from "react"
import { useCallback, useState } from "react"
import intl from "react-intl-universal"
import { Feed } from "./feeds/feed"
import ModernFeed from "./feeds/modern-feed"
import { Icon, FocusTrapZone } from "@fluentui/react"
import ArticleContainer from "../containers/article-container"
import { SourceCategory, ViewType } from "../schema-types"
import ArticleSearch from "./utils/article-search"
import { useAppSelector, useAppDispatch } from "../scripts/reducer"
import { dismissItem, showOffsetItem } from "../scripts/models/page"
import { ContextMenuType } from "../scripts/models/app"
import { makeStyles, mergeClasses } from "@fluentui/react-components"
import { FlatButton } from "./utils/FlatButton"
import { FlatButtonGroup } from "./utils/FlatButtonGroup"

const usePageClasses = makeStyles({
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

const Page: React.FC = () => {
    const dispatch = useAppDispatch()
    const pageClasses = usePageClasses()

    const feedId = useAppSelector(s => s.page.feedId)
    const pageTitle = useAppSelector(s => s.app.title)
    const menuKey = useAppSelector(s => s.app.menuKey)
    const settingsOn = useAppSelector(s => s.app.settings.display)
    const contextOn = useAppSelector(
        s => s.app.contextMenu.type !== ContextMenuType.Hidden
    )
    const itemId = useAppSelector(s => s.page.itemId)
    const itemFromFeed = useAppSelector(s => s.page.itemFromFeed)
    const contentView = useAppSelector(s => s.page.contentView)
    const [listWidth, setListWidth] = useState(() => {
        const saved = Number(localStorage.getItem("modernListWidth"))
        return saved >= 300 && saved <= 680 ? saved : 390
    })
    const [dragging, setDragging] = useState(false)

    const resizeLimit = (element: Element) =>
        Math.max(300, Math.min(680, element.parentElement.clientWidth - 325))

    const startResize = (event: React.MouseEvent) => {
        event.preventDefault()
        setDragging(true)
        const startX = event.clientX
        const initialWidth = listWidth
        const maxWidth = resizeLimit(event.currentTarget)
        let nextWidth = initialWidth
        const onMove = (moveEvent: MouseEvent) => {
            nextWidth = Math.max(
                300,
                Math.min(maxWidth, initialWidth + moveEvent.clientX - startX)
            )
            setListWidth(nextWidth)
        }
        const onUp = () => {
            setDragging(false)
            localStorage.setItem("modernListWidth", String(nextWidth))
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
        }
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
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
            {settingsOn ? null : (
                <div key="list" className="list-main modern-reader">
                    <ArticleSearch />
                    <div
                        className="list-feed-container"
                        style={{ width: listWidth }}>
                        <div className="modern-list-heading">
                            <strong>
                                {menuKey.startsWith("s-")
                                    ? pageTitle
                                    : contentView === "all"
                                    ? intl.get("allArticles")
                                    : intl.get("contentView.articles")}
                            </strong>
                        </div>
                        <Feed
                            viewType={ViewType.List}
                            feedId={feedId}
                            key={feedId}
                        />
                    </div>
                    <div
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
                        onMouseDown={startResize}
                        onKeyDown={event => {
                            if (
                                event.key !== "ArrowLeft" &&
                                event.key !== "ArrowRight"
                            )
                                return
                            event.preventDefault()
                            const direction =
                                event.key === "ArrowRight" ? 20 : -20
                            const width = Math.max(
                                300,
                                Math.min(
                                    resizeLimit(event.currentTarget),
                                    listWidth + direction
                                )
                            )
                            setListWidth(width)
                            localStorage.setItem(
                                "modernListWidth",
                                String(width)
                            )
                        }}
                    />
                    {itemId ? (
                        <div className="side-article-wrapper">
                            <ArticleContainer itemId={itemId} />
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
            )}
        </>
    ) : (
        <>
            {settingsOn ? null : (
                <div key="card" className="main modern-collection">
                    <ArticleSearch />
                    <ModernFeed feedId={feedId} view={contentView} />
                </div>
            )}
            {!!itemId && (
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
