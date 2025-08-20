// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

import { AccountInfo } from "@azure/msal-node";
import { Session } from "express-session";

export interface IDTokenClaims {
  preferred_username: string;
  name: string;
  oid: string;
  groups?: string[];
  scp?: string;
  [key: string]: any;
}

export interface CustomAccountInfo extends AccountInfo {
  accessToken?: string;
  idTokenClaims: IDTokenClaims;
}

export interface PowerBiClaims {
  username: string;
  name: string;
  oid: string;
  groups: string[];
}

