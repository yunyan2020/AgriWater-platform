// src/types/session.d.ts
import "express-session";
import { AccountInfo } from "@azure/msal-node";

// Your custom extensions
interface IDTokenClaims {
  oid?: string;
  groups?: string[];
  preferred_username?: string;
  name?: string;
  scp?: string;
  [key: string]: unknown;
}

interface CustomAccountInfo extends AccountInfo {
  accessToken?: string;
  idTokenClaims?: IDTokenClaims;
}

// Only ONE module augmentation
declare module "express-session" {
  interface SessionData {
    account?: CustomAccountInfo;
    isAuthenticated?: boolean;
    powerBiClaims?: {
      username?: string;
      name?: string;
      oid?: string;
      groups?: string[];
    };
    // PowerBI specific
    powerBiAccessToken?: string;
    powerBiTokenExpiry?: Date;
  }
}
