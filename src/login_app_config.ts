// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

import { LogLevel } from "@azure/msal-node";
import { get_array, get_string } from "./env.js";


export default {
  appCredentials: {
    clientId: get_string("LOGIN_APP_CLIENT_ID"),
    tenantId: get_string("PBI_APP_TENANT_ID"),
    clientSecret: get_string("LOGIN_APP_CLIENT_SECRET"),
    redirectUri: get_string("REDIRECT_URI"),
  },
  authRoutes: {
    redirect: get_string("REDIRECT_URI").replace("{PORT}", get_string("PORT")),
    unauthorized: get_string("UNAUTHORIZED_URI").replace(
      "{PORT}",
      get_string("PORT")
    ),
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string) => {
        if (level <= LogLevel.Warning) {
          console.log(`[MSAL] ${LogLevel[level]}: ${message}`);
        }
      },
      piiLoggingEnabled: false,
    },
  },
  // Add the missing property
  requireGroupMembership:
    process.env.REQUIRE_GROUP_MEMBERSHIP === "true" || false,
};
