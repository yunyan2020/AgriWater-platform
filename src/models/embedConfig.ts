// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

// Properties for embedding the report 
export default class EmbedConfig {
    type: any
    reportsDetail: any
    embedToken: any

    constructor(type, reportsDetail, embedToken) {
        this.type = type;
        this.reportsDetail = reportsDetail;
        this.embedToken = embedToken;
    }
}