// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

// Configurations of the embedded reports
export default class PowerBiReportDetails {
    reportId: any
    reportName: any
    embedUrl: any

    constructor(reportId, reportName, embedUrl) {
        this.reportId = reportId;
        this.reportName = reportName;
        this.embedUrl = embedUrl;
    }
}