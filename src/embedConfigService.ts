// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

import PowerBiReportDetails from "./models/embedReportConfig.js";
import EmbedConfig from "./models/embedConfig.js";
import fetch from "node-fetch";
import { get_string, get_array } from "./env.js";
import {
  ReportFormat,
  invalid_reports,
  loadReportData,
  zip,
} from "./controllers/dashboardController.js";

async function getWorkspaces(req) {
  const reportInGroupApi = `https://api.powerbi.com/v1.0/myorg/groups`;
  const headers = await getRequestHeader(req);

  const result = await fetch(reportInGroupApi, {
    method: "GET",
    headers: headers,
  });

  if (!result.ok) {
    throw result;
  }

  const resultJson = await result.json();
  return resultJson.value.map((w) => w.id);
}

/**
 * Generate embed token and embed urls for reports
 * @return Details like Embed URL, Access token and Expiry
 */
export async function getEmbedInfo(req) {
  // Loads all of the reports uuid accessible by the logged-in user and order them by workspaces
  let data = await loadReportData(req);

  const report_uuids = Object.values(data).map((item) =>
    Object.values(item.reports).reduce((acc, reportGroup) => {
      return acc.concat(Object.values(reportGroup));
    }, [])
  );
  const worspaces = Object.values(data).map((item) => item.workspace);
  const report_data = zip(worspaces, report_uuids);

  // Get the Report Embed details
  const embedParams = await Promise.all(
    Object.entries(report_data).map(async ([workspace, uuid]) => {
      try {
        return await getEmbedParamsForMultipleReports(
          workspace,
          uuid,
          undefined,
          req
        );
      } catch (err) {
        console.log({
          status: err.status,
          error: `Error while retrieving report embed details status:${
            err.statusText
          }\nRequestId: ${err.headers.get(
            "requestid"
          )}\nWorkspace: ${workspace}\nuuid: ${uuid}`,
        });
        return {
          embedToken: {
            token: "None",
            expiration: -1,
          },
          reportsDetail: "",
        };
      }
    })
  );

  return {
    status: 200,
    data: embedParams.map((data) => {
      return {
        accessToken: data.embedToken.token,
        embedUrl: data.reportsDetail,
        expiry: data.embedToken.expiration,
        status: 200,
      };
    }),
  };
}

/**
 * Get embed params for a single report for a single workspace
 * @param {string} workspaceId
 * @param {string} reportId
 * @param {string} additionalDatasetId - Optional Parameter
 * @param {object} req - Express request object
 * @return EmbedConfig object
 */
async function getEmbedParamsForSingleReport(
  workspaceId,
  reportId,
  additionalDatasetId,
  req
) {
  const reportInGroupApi = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}`;
  const headers = await getRequestHeader(req);

  const result = await fetch(reportInGroupApi, {
    method: "GET",
    headers: headers,
  });

  if (!result.ok) {
    throw result;
  }

  const resultJson = await result.json();
  const reportDetails = new PowerBiReportDetails(
    resultJson.id,
    resultJson.name,
    resultJson.embedUrl
  );
  let datasetIds = [resultJson.datasetId];

  if (additionalDatasetId) {
    datasetIds.push(additionalDatasetId);
  }

  let embedToken = await getEmbedTokenForSingleReportSingleWorkspace(
    reportId,
    datasetIds,
    workspaceId,
    req
  );
  const reportEmbedConfig = new EmbedConfig(
    undefined,
    [reportDetails],
    embedToken
  );
  return reportEmbedConfig;
}

/**
 * Get embed params for multiple reports for a single workspace
 * @param {string} workspaceId
 * @param {Array<string>} reportIds
 * @param {Array<string>} additionalDatasetIds - Optional Parameter
 * @param {object} req - Express request object
 * @return EmbedConfig object
 */
async function getEmbedParamsForMultipleReports(
  workspaceId,
  reportIds,
  additionalDatasetIds,
  req
) {
  let reportsDetail = [];
  let datasetIds = [];

  await Promise.allSettled(
    reportIds.map(async (reportId) => {
      const reportInGroupApi = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}`;
      const headers = await getRequestHeader(req);

      const result = await fetch(reportInGroupApi, {
        method: "GET",
        headers: headers,
      });

      if (!result.ok) {
        console.error(
          `Could not embed report workspaceId ${workspaceId} or reportId ${reportId} is invalid`
        );
        return;
      }

      const resultJson = await result.json();
      const reportDetails = new PowerBiReportDetails(
        resultJson.id,
        resultJson.name,
        resultJson.embedUrl
      );
      reportsDetail.push(reportDetails);
      datasetIds.push(resultJson.datasetId);
    })
  );

  if (additionalDatasetIds) {
    datasetIds.push(...additionalDatasetIds);
  }

  let embedToken = await getEmbedTokenForMultipleReportsSingleWorkspace(
    reportIds,
    datasetIds,
    workspaceId,
    req
  );
  const reportEmbedConfig = new EmbedConfig(
    undefined,
    reportsDetail,
    embedToken
  );
  return reportEmbedConfig;
}

/**
 * Get Embed token for single report, multiple datasets, and an optional target workspace
 * @param {string} reportId
 * @param {Array<string>} datasetIds
 * @param {string} targetWorkspaceId - Optional Parameter
 * @param {object} req - Express request object
 * @return EmbedToken
 */
async function getEmbedTokenForSingleReportSingleWorkspace(
  reportId,
  datasetIds,
  targetWorkspaceId,
  req
) {
  let formData: any = {
    reports: [{ id: reportId }],
    datasets: datasetIds.map((id) => ({ id })),
    identities: [
      {
        username: req.session.account.username,
        roles: ["Viewer"], // Adjust roles as needed
        datasets: datasetIds,
      },
    ],
  };

  if (targetWorkspaceId) {
    formData.targetWorkspaces = [{ id: targetWorkspaceId }];
  }

  const embedTokenApi = "https://api.powerbi.com/v1.0/myorg/GenerateToken";
  const headers = await getRequestHeader(req);

  const result = await fetch(embedTokenApi, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(formData),
  });

  if (!result.ok) {
    throw result;
  }
  return result.json();
}

/**
 * Get Embed token for multiple reports, multiple datasets, and an optional target workspace
 * @param {Array<string>} reportIds
 * @param {Array<string>} datasetIds
 * @param {String} targetWorkspaceId - Optional Parameter
 * @param {object} req - Express request object
 * @return EmbedToken
 */
async function getEmbedTokenForMultipleReportsSingleWorkspace(
  reportIds,
  datasetIds,
  targetWorkspaceId,
  req
) {
  let formData: any = {
    datasets: datasetIds.map((id) => ({ id })),
    reports: reportIds.map((id) => ({ id })),
    identities: [
      {
        username: req.session.account.username,
        roles: ["Viewer"], // Adjust roles as needed
        datasets: datasetIds,
      },
    ],
  };

  if (targetWorkspaceId) {
    formData.targetWorkspaces = [{ id: targetWorkspaceId }];
  }

  const embedTokenApi = "https://api.powerbi.com/v1.0/myorg/GenerateToken";
  const headers = await getRequestHeader(req);

  const result = await fetch(embedTokenApi, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(formData),
  });

  if (!result.ok) {
    throw result;
  }
  return result.json();
}

/**
 * Get Embed token for multiple reports, multiple datasets, and optional target workspaces
 * @param {Array<string>} reportIds
 * @param {Array<string>} datasetIds
 * @param {Array<string>} targetWorkspaceIds - Optional Parameter
 * @param {object} req - Express request object
 * @return EmbedToken
 */
async function getEmbedTokenForMultipleReportsMultipleWorkspaces(
  reportIds,
  datasetIds,
  targetWorkspaceIds,
  req
) {
  let formData: any = {
    datasets: datasetIds.map((id) => ({ id })),
    reports: reportIds.map((id) => ({ id })),
    identities: [
      {
        username: req.session.account.username,
        roles: ["Viewer"], // Adjust roles as needed
        datasets: datasetIds,
      },
    ],
  };

  if (targetWorkspaceIds) {
    formData.targetWorkspaces = targetWorkspaceIds.map((id) => ({ id }));
  }

  const embedTokenApi = "https://api.powerbi.com/v1.0/myorg/GenerateToken";
  const headers = await getRequestHeader(req);

  const result = await fetch(embedTokenApi, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(formData),
  });

  if (!result.ok) {
    console.log(result);
    throw result;
  }
  return result.json();
}

/**
 * Get Request header
 * @param {object} req - Express request object
 * @return Request header with Bearer token
 */
/**
 * Get Request header
 * @param {object} req - Express request object
 * @return Request header with Bearer token
 */
export async function getRequestHeader(req?: any) {
  try {
    // Use the main getAccessToken function
    const { getAccessToken } = await import("./authentication.js");
    const accessToken = await getAccessToken();

    // Validate we got a proper token
    if (!accessToken) {
      throw new Error("Invalid access token");
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      // For service-to-service mode, there is no user
      "X-User-Id": req?.session?.account?.username || "service-principal",
    };
  } catch (error: any) {
    console.error("Failed to get access token:", error);

    // Throw instead of returning error object
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

