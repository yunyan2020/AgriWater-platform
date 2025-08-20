import { ConfidentialClientApplication } from "@azure/msal-node";

const cca = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.LOGIN_APP_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.LOGIN_APP_TENANT_ID}`,
    clientSecret: process.env.LOGIN_APP_CLIENT_SECRET!,
  },
});

// 🔹 For user login redirect
export async function getAuthCodeUrl() {
  return cca.getAuthCodeUrl({
    scopes: [
      "https://analysis.windows.net/powerbi/api/.default",
      "openid",
      "profile",
      "email",
    ],
    redirectUri: "http://localhost:4300/redirect",
  });
}

export async function acquireTokenByCode(authCode: string) {
  return cca.acquireTokenByCode({
    code: authCode,
    scopes: ["https://analysis.windows.net/powerbi/api/.default"],
    redirectUri: "http://localhost:4300/redirect",
  });
}

// 🔹 For backend calls (MasterUser flow)
export async function getAccessToken() {
  try {
    const result = await cca.acquireTokenByClientCredential({
      scopes: ["https://analysis.windows.net/powerbi/api/.default"],
    });

    if (!result?.accessToken) {
      throw new Error("Failed to acquire access token");
    }

    return result.accessToken;
  } catch (err: any) {
    console.error("getAccessToken failed:", err.message);
    throw err;
  }
}
