import * as React from "react"
import { useEffect, useState } from "react"
import intl from "react-intl-universal"
import { DefaultButton, TextField, Toggle } from "@fluentui/react"
import { makeStyles, tokens } from "@fluentui/react-components"
import { LOCAL_API_PORT, LocalApiStatus } from "../../schema-types"

const useClasses = makeStyles({
    details: {
        display: "flex",
        flexDirection: "column",
        rowGap: "12px",
        paddingTop: "12px",
    },
    address: {
        color: tokens.colorNeutralForeground2,
        fontFamily: "monospace",
        overflowWrap: "anywhere",
    },
    tokenRow: {
        display: "flex",
        alignItems: "end",
        flexWrap: "wrap",
        gap: "8px",
    },
    tokenField: {
        flexGrow: 1,
        minWidth: "220px",
    },
    error: {
        color: tokens.colorPaletteRedForeground1,
        overflowWrap: "anywhere",
    },
})

const LocalApiSettings: React.FC = () => {
    const classes = useClasses()
    const [status, setStatus] = useState<LocalApiStatus | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [revealed, setRevealed] = useState(false)
    const [busy, setBusy] = useState(false)
    const [failure, setFailure] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        globalThis.utils
            .getLocalApiStatus()
            .then(result => {
                if (active) setStatus(result)
            })
            .catch(error => {
                if (active) setFailure(String(error))
            })
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        if (!status?.enabled || status.running || status.error) return
        const timer = setTimeout(() => {
            globalThis.utils
                .getLocalApiStatus()
                .then(setStatus)
                .catch(() => {})
        }, 1000)
        return () => clearTimeout(timer)
    }, [status])

    const toggle = async (
        _: React.MouseEvent<HTMLElement>,
        enabled: boolean
    ) => {
        setBusy(true)
        setFailure(null)
        try {
            setStatus(await globalThis.utils.setLocalApiEnabled(enabled))
        } catch (error) {
            setFailure(String(error))
        } finally {
            setBusy(false)
        }
    }

    const reveal = async () => {
        if (revealed) {
            setToken(null)
            setRevealed(false)
            return
        }
        try {
            setToken(await globalThis.utils.getLocalApiToken())
            setRevealed(true)
        } catch (error) {
            setFailure(String(error))
        }
    }

    const copy = async () => {
        try {
            globalThis.utils.writeClipboard(
                token || (await globalThis.utils.getLocalApiToken())
            )
        } catch (error) {
            setFailure(String(error))
        }
    }

    const regenerate = async () => {
        setBusy(true)
        setFailure(null)
        try {
            await globalThis.utils.regenerateLocalApiToken()
            setToken(null)
            setRevealed(false)
        } catch (error) {
            setFailure(String(error))
        } finally {
            setBusy(false)
        }
    }

    const stateText = !status
        ? intl.get("app.localApiLoading")
        : !status.enabled
        ? intl.get("app.localApiStopped")
        : status.running
        ? intl.get("app.localApiRunning")
        : status.error
        ? intl.get("app.localApiFailed")
        : intl.get("app.localApiStarting")

    return (
        <>
            <h2 className="modern-settings-section-title">
                {intl.get("app.localApiSection")}
            </h2>
            <div className="modern-setting-row">
                <div className="modern-setting-copy">
                    <strong>{intl.get("app.localApiEnable")}</strong>
                    <p>{intl.get("app.localApiDescription")}</p>
                </div>
                <Toggle
                    checked={status?.enabled || false}
                    disabled={!status || busy}
                    onChange={toggle}
                />
            </div>
            <div className={classes.details}>
                <div>
                    {intl.get("app.localApiStatus")}: {stateText}
                    {(status?.error || failure) && (
                        <div className={classes.error} role="alert">
                            {status?.error || failure}
                        </div>
                    )}
                </div>
                <div>
                    {intl.get("app.localApiAddress")}:{" "}
                    <code className={classes.address}>
                        http://127.0.0.1:{status?.port || LOCAL_API_PORT}
                    </code>
                </div>
                <div className={classes.tokenRow}>
                    <TextField
                        className={classes.tokenField}
                        label={intl.get("app.localApiToken")}
                        value={revealed ? token || "" : "••••••••••••••••"}
                        readOnly
                        type={revealed ? "text" : "password"}
                    />
                    <DefaultButton
                        disabled={busy}
                        onClick={reveal}
                        text={intl.get(
                            revealed ? "app.localApiHide" : "app.localApiReveal"
                        )}
                    />
                    <DefaultButton
                        disabled={busy}
                        onClick={copy}
                        text={intl.get("app.localApiCopy")}
                    />
                    <DefaultButton
                        disabled={busy}
                        onClick={regenerate}
                        text={intl.get("app.localApiRegenerate")}
                    />
                </div>
                <span className="settings-hint">
                    {intl.get("app.localApiHint")}
                </span>
            </div>
        </>
    )
}

export default LocalApiSettings
