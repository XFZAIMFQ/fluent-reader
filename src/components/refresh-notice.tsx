import * as React from "react"
import { useEffect, useState } from "react"
import intl from "react-intl-universal"
import { DefaultButton, PrimaryButton } from "@fluentui/react"
import { makeStyles } from "@griffel/react"
import { useAppDispatch, useAppSelector } from "../scripts/reducer"
import { decideRefresh } from "../scripts/models/refresh-feedback"
import { FlatButton } from "./utils/FlatButton"

const useStyles = makeStyles({
    notice: {
        position: "fixed",
        right: "20px",
        bottom: "44px",
        width: "400px",
        maxWidth: "calc(100vw - 32px)",
        boxSizing: "border-box",
        padding: "16px",
        borderRadius: "12px",
        border: "1px solid var(--neutralQuaternaryAlt)",
        backgroundColor: "var(--neutralLighterAlt)",
        color: "var(--neutralPrimary)",
        boxShadow: "0 8px 32px #0003",
        zIndex: 100000,
        fontSize: "13px",
        WebkitAppRegion: "no-drag",
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        fontWeight: 600,
    },
    close: {
        width: "28px",
        height: "28px",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        borderRadius: "6px",
        cursor: "pointer",
    },
    entries: {
        maxHeight: "220px",
        overflowY: "auto",
        marginTop: "8px",
    },
    entry: {
        paddingTop: "8px",
        paddingBottom: "8px",
        lineHeight: "1.6",
    },
    name: {
        display: "block",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontWeight: 600,
    },
    details: { color: "var(--neutralSecondary)" },
    actions: {
        display: "flex",
        justifyContent: "flex-end",
        flexWrap: "wrap",
        gap: "8px",
        marginTop: "12px",
    },
})

const RefreshNotice: React.FC = () => {
    const feedback = useAppSelector(s => s.refreshFeedback)
    const progress = useAppSelector(s => s.app.fetchingProgress)
    const total = useAppSelector(s => s.app.fetchingTotal)
    const dispatch = useAppDispatch()
    const classes = useStyles()
    const [now, setNow] = useState(Date.now)
    useEffect(() => {
        if (!feedback.visible) return
        setNow(Date.now())
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [feedback.visible])
    if (!feedback.visible) return null
    const waiting = feedback.entries.filter(entry => !entry.failed)
    const cooldown = waiting.some(entry => entry.kind === "cooldown")
    const dismiss = () => dispatch(decideRefresh("cancel"))
    return (
        <section
            className={classes.notice}
            data-refresh-notice
            aria-label={intl.get("refreshNotice.title")}>
            <div className={classes.header}>
                <span role="status" aria-live="polite">
                    {intl.get(
                        waiting.length
                            ? "refreshNotice.waiting"
                            : feedback.active
                            ? "refreshNotice.working"
                            : "refreshNotice.finished",
                        { count: waiting.length }
                    )}
                </span>
                <FlatButton
                    styleClass={classes.close}
                    ariaLabel={intl.get(
                        feedback.active ? "refreshNotice.dismiss" : "close"
                    )}
                    title={intl.get(
                        feedback.active ? "refreshNotice.dismiss" : "close"
                    )}
                    onClick={dismiss}>
                    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                        <path
                            d="m4 4 8 8M12 4l-8 8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                    </svg>
                </FlatButton>
            </div>
            <div className={classes.entries}>
                {feedback.entries.map(entry => {
                    const seconds = Math.max(
                        0,
                        Math.ceil((entry.until - now) / 1000)
                    )
                    const time =
                        seconds >= 60
                            ? intl.get("refreshNotice.minutes", {
                                  n: Math.ceil(seconds / 60),
                              })
                            : intl.get("refreshNotice.seconds", { n: seconds })
                    return (
                        <div key={entry.url} className={classes.entry}>
                            <span
                                className={classes.name}
                                title={`${entry.name} · ${entry.site}`}>
                                {entry.name}
                            </span>
                            <span className={classes.details}>
                                {entry.failed
                                    ? intl.get(
                                          entry.stopped
                                              ? "refreshNotice.stopped"
                                              : "refreshNotice.failed",
                                          {
                                              reason: intl.get(
                                                  `refreshNotice.${
                                                      entry.reason || "error"
                                                  }`
                                              ),
                                          }
                                      )
                                    : intl.get(
                                          entry.kind === "spacing"
                                              ? "refreshNotice.spacing"
                                              : "refreshNotice.cooldown",
                                          {
                                              time,
                                              reason: intl.get(
                                                  `refreshNotice.${
                                                      entry.reason || "error"
                                                  }`
                                              ),
                                          }
                                      )}
                            </span>
                        </div>
                    )
                })}
                {feedback.active && (
                    <div className={classes.details}>
                        {intl.get("refreshNotice.progress", {
                            done: progress,
                            total,
                        })}
                    </div>
                )}
            </div>
            <div className={classes.actions}>
                <DefaultButton onClick={dismiss}>
                    {intl.get(
                        feedback.active ? "refreshNotice.cancel" : "close"
                    )}
                </DefaultButton>
                {waiting.length > 0 && (
                    <PrimaryButton
                        onClick={() => dispatch(decideRefresh("force"))}>
                        {intl.get(
                            cooldown
                                ? "refreshNotice.tryNow"
                                : "refreshNotice.refreshNow"
                        )}
                    </PrimaryButton>
                )}
            </div>
        </section>
    )
}

export default RefreshNotice
