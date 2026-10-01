import * as React from "react"
import intl from "react-intl-universal"
import {
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItem,
    MenuItemCheckbox,
    makeStyles,
} from "@fluentui/react-components"
import { ChevronDown16Regular } from "@fluentui/react-icons"
import { FlatButton } from "./FlatButton"
import { useAppDispatch, useAppSelector } from "../../scripts/reducer"
import { RSSItem, loadCachedSourceEntries } from "../../scripts/models/item"
import { showItem } from "../../scripts/models/page"
import { FeedFilter } from "../../scripts/models/feed"

const PAGE_SIZE = 50
const useStyles = makeStyles({
    trigger: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "28px",
        height: "28px",
        flexShrink: 0,
        borderRadius: "6px",
        cursor: "pointer",
        color: "var(--neutralSecondary)",
    },
    popover: {
        width: "min(360px, calc(100vw - 32px))",
        boxSizing: "border-box",
        maxHeight: "min(60vh, 480px)",
        overflowY: "auto",
        borderRadius: "8px",
        backgroundColor: "var(--white)",
        color: "var(--neutralPrimary)",
    },
    item: { borderRadius: "5px", minHeight: "32px" },
    title: {
        display: "block",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    status: {
        padding: "10px 12px",
        color: "var(--neutralSecondary)",
        fontSize: "12px",
    },
})

export function SourceEntriesMenu({
    currentItem,
    sourceName,
    feedId,
}: {
    currentItem: RSSItem
    sourceName: string
    feedId: string
}) {
    const classes = useStyles()
    const dispatch = useAppDispatch()
    const items = useAppSelector(state => state.items)
    const filter = useAppSelector(
        state => state.feeds[feedId]?.filter || state.page.filter
    )
    const privacyMode = useAppSelector(state => state.app.privacyMode)
    const [open, setOpen] = React.useState(false)
    const [ids, setIds] = React.useState<number[]>([])
    const [loading, setLoading] = React.useState(false)
    const [allLoaded, setAllLoaded] = React.useState(false)
    const [error, setError] = React.useState(false)
    const request = React.useRef(0)
    const offset = React.useRef(0)
    const sid = currentItem.source

    const load = async (reset: boolean) => {
        const version = ++request.current
        if (reset) {
            offset.current = 0
            setIds([])
            setAllLoaded(false)
        }
        setLoading(true)
        setError(false)
        try {
            const rows = await dispatch(
                loadCachedSourceEntries(sid, filter, offset.current, PAGE_SIZE)
            )
            if (version !== request.current) return
            offset.current += rows.length
            setIds(previous => [
                ...new Set([...previous, ...rows.map(item => item._id)]),
            ])
            setAllLoaded(rows.length < PAGE_SIZE)
        } catch {
            if (version === request.current) setError(true)
        } finally {
            if (version === request.current) setLoading(false)
        }
    }
    React.useEffect(() => {
        if (open) void load(true)
        return () => {
            request.current += 1
        }
    }, [open, sid, filter, privacyMode])

    const entries = [...new Set([currentItem._id, ...ids])]
        .map(id => items[id])
        .filter(
            item =>
                item &&
                item.source === sid &&
                (item._id === currentItem._id ||
                    FeedFilter.testItem(filter, item))
        )
        .sort((a, b) => b.date.getTime() - a.date.getTime())
    const selected = { article: [String(currentItem._id)] }
    return (
        <Menu
            open={open}
            onOpenChange={(_, data) => setOpen(data.open)}
            checkedValues={selected}
            positioning={{ position: "below", align: "start" }}>
            <MenuTrigger disableButtonEnhancement>
                <FlatButton
                    styleClass={classes.trigger}
                    ariaLabel={intl.get("readerNavigation.sourceEntries", {
                        name: sourceName,
                    })}>
                    <ChevronDown16Regular />
                </FlatButton>
            </MenuTrigger>
            <MenuPopover className={classes.popover} data-source-entries-menu>
                <MenuList>
                    {entries.map(item => (
                        <MenuItemCheckbox
                            key={item._id}
                            name="article"
                            value={String(item._id)}
                            className={classes.item}
                            data-article-id={item._id}
                            onClick={() => {
                                if (item._id !== currentItem._id)
                                    dispatch(showItem(feedId, item))
                                setOpen(false)
                            }}>
                            <span className={classes.title} title={item.title}>
                                {item.title}
                            </span>
                        </MenuItemCheckbox>
                    ))}
                    {loading && (
                        <div role="status" className={classes.status}>
                            {intl.get("readerNavigation.loading")}
                        </div>
                    )}
                    {error && (
                        <>
                            <div role="alert" className={classes.status}>
                                {intl.get("readerNavigation.loadError")}
                            </div>
                            <MenuItem
                                persistOnClick
                                onClick={() => void load(false)}>
                                {intl.get("readerNavigation.retry")}
                            </MenuItem>
                        </>
                    )}
                    {!loading && !error && !allLoaded && (
                        <MenuItem
                            persistOnClick
                            onClick={() => void load(false)}>
                            {intl.get("loadMore")}
                        </MenuItem>
                    )}
                </MenuList>
            </MenuPopover>
        </Menu>
    )
}
