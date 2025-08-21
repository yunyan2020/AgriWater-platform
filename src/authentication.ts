// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

import * as msal from "@azure/msal-node";
import { get_string } from "./env.js";

export async function getAccessToken() {
  const msalConfig: {
    auth: {
      clientId: string;
      authority: string;
      clientSecret: string | undefined; // Allow clientSecret to be a string or undefined
    };
  } = {
    auth: {
      clientId: get_string("PBI_APP_CLIENT_ID"),
      authority: `${get_string("PBI_APP_AUTHORITY_URL")}${get_string(
        "PBI_APP_TENANT_ID"
      )}`,
      clientSecret: get_string("PBI_APP_CLIENT_SECRET"), 
    },
  };

  // Check for the MasterUser Authentication
  if (
    get_string("PBI_APP_AUTHENTICATION_MODE").toLowerCase() === "masteruser"
  ) {
    const clientApplication = new msal.PublicClientApplication(msalConfig);

    const usernamePasswordRequest = {
      scopes: [get_string("PBI_APP_SCOPE_BASE")],
      username: get_string("PBI_APP_PBI_USERNAME"),
      password: get_string("PBI_APP_PBI_PASSWORD"),
    };

    return clientApplication.acquireTokenByUsernamePassword(
      usernamePasswordRequest
    );
  }

  // Service Principal auth is the recommended by Microsoft to achieve App Owns Data Power BI embedding
  if (
    get_string("PBI_APP_AUTHENTICATION_MODE").toLowerCase() ===
    "serviceprincipal"
  ) {
    msalConfig.auth.clientSecret = get_string("PBI_APP_CLIENT_SECRET");
    const clientApplication = new msal.ConfidentialClientApplication(
      msalConfig
    );

    const clientCredentialRequest = {
      scopes: [get_string("PBI_APP_SCOPE_BASE")],
    };

    return clientApplication.acquireTokenByClientCredential(
      clientCredentialRequest
    );
  }
}
