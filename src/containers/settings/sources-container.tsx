import intl from "react-intl-universal"
import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../../scripts/reducer"
import SourcesTab from "../../components/settings/sources"
import {
    addSource,
    RSSSource,
    updateSource,
    deleteSource,
    SourceOpenTarget,
    deleteSources,
    toggleSourceHidden,
} from "../../scripts/models/source"
import { importOPML, exportOPML } from "../../scripts/models/group"
import { AppDispatch, validateFavicon } from "../../scripts/utils"
import { saveSettings, toggleSettings } from "../../scripts/models/app"
import { SourceCategory, SyncService } from "../../schema-types"

const getSources = (state: RootState) => state.sources
const getServiceOn = (state: RootState) =>
    state.service.type !== SyncService.None
const getSIDs = (state: RootState) => state.app.settings.sids

const mapStateToProps = createSelector(
    [getSources, getServiceOn, getSIDs],
    (sources, serviceOn, sids) => ({
        sources: sources,
        serviceOn: serviceOn,
        sids: sids,
    })
)

const mapDispatchToProps = (dispatch: AppDispatch) => {
    return {
        acknowledgeSIDs: () => dispatch(toggleSettings(true)),
        addSource: (url: string, category: SourceCategory) =>
            dispatch(addSource(url, null, false, category)),
        updateSourceCategory: (source: RSSSource, category: SourceCategory) => {
            dispatch(updateSource({ ...source, category }))
        },
        updateSourcePrivate: (source: RSSSource, privateSource: boolean) => {
            dispatch(updateSource({ ...source, private: privateSource }))
        },
        updateSourceName: (source: RSSSource, name: string) => {
            dispatch(updateSource({ ...source, name: name } as RSSSource))
        },
        updateSourceIcon: async (source: RSSSource, iconUrl: string) => {
            dispatch(saveSettings())
            if (await validateFavicon(iconUrl)) {
                dispatch(
                    updateSource({
                        ...source,
                        iconurl: iconUrl,
                        iconOrigin: "manual",
                    })
                )
            } else {
                window.utils.showErrorBox(intl.get("sources.badIcon"), "")
            }
            dispatch(saveSettings())
        },
        updateSourceOpenTarget: (
            source: RSSSource,
            target: SourceOpenTarget
        ) => {
            dispatch(
                updateSource({ ...source, openTarget: target } as RSSSource)
            )
        },
        updateFetchFrequency: (source: RSSSource, frequency: number) => {
            dispatch(
                updateSource({
                    ...source,
                    fetchFrequency: frequency,
                } as RSSSource)
            )
        },
        deleteSource: (source: RSSSource) => dispatch(deleteSource(source)),
        deleteSources: (sources: RSSSource[]) =>
            dispatch(deleteSources(sources)),
        importOPML: () => dispatch(importOPML()),
        exportOPML: () => dispatch(exportOPML()),
        toggleSourceHidden: (source: RSSSource) =>
            dispatch(toggleSourceHidden(source)),
    }
}

const SourcesTabContainer = connect(
    mapStateToProps,
    mapDispatchToProps
)(SourcesTab)
export default SourcesTabContainer
