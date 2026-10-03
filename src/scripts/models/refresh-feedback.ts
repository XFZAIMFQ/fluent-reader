import { FeedFailureReason } from "../../schema-types"
import { FeedBlock, FeedJob } from "../feed-scheduler"
import { Dispatch } from "redux"
import { AppThunk } from "../utils"

export interface RefreshFeedbackEntry extends FeedBlock {
    url: string
    site: string
    name: string
    failed?: boolean
    stopped?: boolean
}

interface RefreshFeedbackState {
    visible: boolean
    active: boolean
    entries: RefreshFeedbackEntry[]
}

type FeedbackAction =
    | { type: "REFRESH_FEEDBACK_START" }
    | { type: "REFRESH_FEEDBACK_ENTRY"; entry: RefreshFeedbackEntry }
    | { type: "REFRESH_FEEDBACK_REMOVE"; url: string }
    | { type: "REFRESH_FEEDBACK_FINISH" }
    | { type: "REFRESH_FEEDBACK_DISMISS" }

export function refreshFeedbackReducer(
    state: RefreshFeedbackState = {
        visible: false,
        active: false,
        entries: [],
    },
    action: FeedbackAction
): RefreshFeedbackState {
    switch (action.type) {
        case "REFRESH_FEEDBACK_START":
            return { visible: false, active: true, entries: [] }
        case "REFRESH_FEEDBACK_ENTRY":
            return {
                ...state,
                visible: true,
                entries: [
                    ...state.entries.filter(e => e.url !== action.entry.url),
                    action.entry,
                ],
            }
        case "REFRESH_FEEDBACK_REMOVE":
            return {
                ...state,
                entries: state.entries.filter(e => e.url !== action.url),
            }
        case "REFRESH_FEEDBACK_FINISH":
            return {
                ...state,
                active: false,
                visible: state.entries.length > 0,
            }
        case "REFRESH_FEEDBACK_DISMISS":
            return { ...state, visible: false, entries: [] }
        default:
            return state
    }
}

type Decision = "force" | "resume" | "cancel"
let session: ReturnType<typeof createRefreshFeedback> | undefined

// Pending decisions stay outside Redux; the notification state is serializable.
export function createRefreshFeedback(
    dispatch: Dispatch<FeedbackAction>,
    name: (job: FeedJob) => string
) {
    const pending = new Set<(decision: Decision) => void>()
    let cancelled = false
    dispatch({ type: "REFRESH_FEEDBACK_START" })
    const current = {
        cancelled: () => cancelled,
        blocked: (job: FeedJob, block: FeedBlock) =>
            new Promise<Decision>(resolve => {
                if (cancelled) {
                    resolve("cancel")
                    return
                }
                dispatch({
                    type: "REFRESH_FEEDBACK_ENTRY",
                    entry: {
                        ...block,
                        url: job.url,
                        site: job.site,
                        name: name(job),
                    },
                })
                const settle = (decision: Decision) => {
                    clearInterval(timer)
                    pending.delete(settle)
                    dispatch({ type: "REFRESH_FEEDBACK_REMOVE", url: job.url })
                    resolve(decision)
                }
                const timer = setInterval(() => {
                    if (Date.now() >= block.until) settle("resume")
                }, 250)
                pending.add(settle)
            }),
        failed: (job: FeedJob, reason: FeedFailureReason, stopped: boolean) => {
            if (cancelled) return
            dispatch({
                type: "REFRESH_FEEDBACK_ENTRY",
                entry: {
                    url: job.url,
                    site: job.site,
                    name: name(job),
                    kind: "cooldown",
                    until: 0,
                    reason,
                    failed: true,
                    stopped,
                },
            })
        },
        decide: (decision: "force" | "cancel") => {
            if (decision === "cancel") cancelled = true
            for (const resolve of [...pending]) resolve(decision)
            if (cancelled) dispatch({ type: "REFRESH_FEEDBACK_DISMISS" })
        },
        finish: () => {
            for (const resolve of [...pending]) resolve("cancel")
            if (session === current) session = undefined
            dispatch({ type: "REFRESH_FEEDBACK_FINISH" })
        },
    }
    session = current
    return current
}

export const decideRefresh =
    (decision: "force" | "cancel"): AppThunk =>
    dispatch => {
        if (session) session.decide(decision)
        else dispatch({ type: "REFRESH_FEEDBACK_DISMISS" })
    }
