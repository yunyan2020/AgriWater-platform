// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

import guid from "guid";
import { get_string } from "./env.js";

export function getAuthHeader(accessToken) {

    // Function to append Bearer against the Access Token
    return "Bearer ".concat(accessToken);
}

export function validateConfig() {

    // Validation function to check whether the Configurations are available in the config.json file or not

    if (!get_string('PBI_APP_AUTHENTICATION_MODE')) {
        return "AuthenticationMode is empty. Please choose MasterUser or ServicePrincipal in config.json.";
    }

    if (get_string('PBI_APP_AUTHENTICATION_MODE').toLowerCase() !== "masteruser" && get_string('PBI_APP_AUTHENTICATION_MODE').toLowerCase() !== "serviceprincipal") {
        return "AuthenticationMode is wrong. Please choose MasterUser or ServicePrincipal in config.json";
    }   

    if (!get_string('PBI_APP_AUTHORITY_URL')) {
        return "AuthorityUrl is empty. Please fill valid AuthorityUrl in config.json.";
    }

    if (get_string('PBI_APP_AUTHENTICATION_MODE').toLowerCase() === "masteruser") {
        if (!get_string('PBI_APP_PBI_USERNAME') || !get_string('PBI_APP_PBI_USERNAME').trim()) {
            return "PbiUsername is empty. Please fill Power BI username in config.json.";
        }

        if (!get_string('PBI_APP_PBI_PASSWORD') || !get_string('PBI_APP_PBI_PASSWORD').trim()) {
            return "PbiPassword is empty. Please fill password of Power BI username in config.json.";
        }
    } else if (get_string('PBI_APP_AUTHENTICATION_MODE').toLowerCase() === "serviceprincipal") {
        if (!get_string('PBI_APP_CLIENT_SECRET') || !get_string('PBI_APP_CLIENT_SECRET').trim()) {
            return "ClientSecret is empty. Please fill Power BI ServicePrincipal ClientSecret in config.json.";
        }

        if (!get_string('PBI_APP_TENANT_ID')) {
            return "TenantId is empty. Please fill the TenantId in config.json.";
        }

        if (!guid.isGuid(get_string('PBI_APP_TENANT_ID'))) {
            return "TenantId must be a Guid object. Please select a workspace you own and fill its Id in config.json.";
        }
    }
}

import path from 'path';
import fs from 'fs'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON modules paths are evaluted realtive to the utils file
export async function read_JSON(file_path) {
    return JSON.parse(await fs.promises.readFile(path.resolve(__dirname, file_path), 'utf8'));
}