// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

import * as auth from "./authentication.js";
import * as utils from "./utils.js";
import PowerBiReportDetails from "./models/embedReportConfig.js";
import EmbedConfig from "./models/embedConfig.js";
import fetch from "node-fetch";
import { get_string } from "./env.js";
import {
  ReportFormat,
  invalid_reports,
  loadReportData,
  zip,
} from "./controllers/dashboardController.js";

async function getWorkspaces() {
  const reportInGroupApi = `https://api.powerbi.com/v1.0/myorg/groups`;
  const headers = await getRequestHeader();

  // Get report info by calling the PowerBI REST API
  const result = await fetch(reportInGroupApi, {
    method: "GET",
    headers: headers,
  });

  if (!result.ok) {
    throw result;
  }

  // Convert result in json to retrieve values
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
  // TODO remove report ids that do not exist

  // Get the Report Embed details
  const embedParams = await Promise.all(
    Object.entries(report_data).map(async ([workspace, uuid]) => {
      try {
        return await getEmbedParamsForMultipleReports(
          workspace,
          uuid,
          undefined
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
 * @return EmbedConfig object
 */
async function getEmbedParamsForSingleReport(
  workspaceId,
  reportId,
  additionalDatasetId
) {
  const reportInGroupApi = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}`;
  const headers = await getRequestHeader();

  // Get report info by calling the PowerBI REST API
  const result = await fetch(reportInGroupApi, {
    method: "GET",
    headers: headers,
  });

  if (!result.ok) {
    throw result;
  }

  // Convert result in json to retrieve values
  const resultJson = await result.json();

  // Add report data for embedding
  const reportDetails = new PowerBiReportDetails(
    resultJson.id,
    resultJson.name,
    resultJson.embedUrl
  );

  // Create list of datasets
  let datasetIds = [resultJson.datasetId];

  // Append additional dataset to the list to achieve dynamic binding later
  if (additionalDatasetId) {
    datasetIds.push(additionalDatasetId);
  }
  // Get Embed token multiple resources
  let embedToken = await getEmbedTokenForSingleReportSingleWorkspace(
    reportId,
    datasetIds,
    workspaceId
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
 * @return EmbedConfig object
 */
async function getEmbedParamsForMultipleReports(
  workspaceId,
  reportIds,
  additionalDatasetIds
) {
  // Create array of embedReports for mapping
  let reportsDetail = [];
  let datasetIds = [];

  console.log(`🔍 Attempting to access workspace: ${workspaceId}`);
  console.log(`🔍 Report IDs: ${reportIds.join(", ")}`);

  await Promise.allSettled(
    reportIds.map(async (reportId) => {
      const reportInGroupApi = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}`;
      const headers = await getRequestHeader();

      console.log(`🔍 Fetching report: ${reportId}`);
      console.log(`🔍 API URL: ${reportInGroupApi}`);

      try {
        // Get report info by calling the PowerBI REST API
        const result = await fetch(reportInGroupApi, {
          method: "GET",
          headers: headers,
        });

        if (!result.ok) {
          const errorText = await result.text();
          console.error(`❌ Report API Error:`, {
            status: result.status,
            statusText: result.statusText,
            workspaceId,
            reportId,
            errorBody: errorText,
            headers: Object.fromEntries(result.headers),
          });

          // Check specific error codes
          if (result.status === 401) {
            throw new Error(
              `Access denied to report ${reportId} in workspace ${workspaceId}. User may not have permissions.`
            );
          } else if (result.status === 404) {
            throw new Error(
              `Report ${reportId} not found in workspace ${workspaceId}`
            );
          } else if (result.status === 403) {
            throw new Error(
              `Forbidden access to report ${reportId}. Check Power BI permissions.`
            );
          }

          throw result;
        }

        // Convert result in json to retrieve values
        const resultJson = await result.json();
        console.log(`📊 Report: ${resultJson.name}`);
        console.log(`📁 Dataset ID: ${resultJson.datasetId}`);

        // Store result into PowerBiReportDetails object
        const reportDetails = new PowerBiReportDetails(
          resultJson.id,
          resultJson.name,
          resultJson.embedUrl
        );

        // Create mapping for reports and Embed URLs
        reportsDetail.push(reportDetails);

        // Push datasetId of the report into datasetIds array
        datasetIds.push(resultJson.datasetId);
      } catch (error) {
        console.error(`❌ Error processing report ${reportId}:`, error.message);
        throw error;
      }
    })
  );

  console.log("📋 All collected dataset IDs:", datasetIds);
  console.log(
    "📋 All report details:",
    reportsDetail.map((r) => ({ id: r.reportId, name: r.reportName }))
  );

  // Append to existing list of datasets to achieve dynamic binding later
  if (additionalDatasetIds) {
    datasetIds.push(...additionalDatasetIds);
    console.log("📋 Dataset IDs after adding additional:", datasetIds);
  }

  // Check for duplicate dataset IDs (this can cause issues)
  const uniqueDatasetIds = [...new Set(datasetIds)];
  if (uniqueDatasetIds.length !== datasetIds.length) {
    console.log("⚠️  Found duplicate dataset IDs, removing duplicates");
    console.log("Original:", datasetIds);
    console.log("Unique:", uniqueDatasetIds);
  }

  // Get Embed token multiple resources
  let embedToken = await getEmbedTokenForMultipleReportsSingleWorkspace(
    reportIds,
    datasetIds,
    workspaceId
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
 * @return EmbedToken
 */
async function getEmbedTokenForSingleReportSingleWorkspace(
  reportId,
  datasetIds,
  targetWorkspaceId
) {
  // Add report id in the request
  let formData = {
    reports: [
      {
        id: reportId,
      },
    ],
    accessLevel: "Create",
  };

  // Add dataset ids in the request
  formData["datasets"] = [];
  for (const datasetId of datasetIds) {
    formData["datasets"].push({
      id: datasetId,
    });
  }

  // Add targetWorkspace id in the request
  if (targetWorkspaceId) {
    formData["targetWorkspaces"] = [];
    formData["targetWorkspaces"].push({
      id: targetWorkspaceId,
    });
  }

  const embedTokenApi = "https://api.powerbi.com/v1.0/myorg/GenerateToken";
  const headers = await getRequestHeader();

  // Generate Embed token for single report, workspace, and multiple datasets. Refer https://aka.ms/MultiResourceEmbedToken
  const result = await fetch(embedTokenApi, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(formData),
  });

  if (!result.ok) throw result;
  return result.json();
}

/**
 * Get Embed token for multiple reports, multiple datasets, and an optional target workspace
 * @param {Array<string>} reportIds
 * @param {Array<string>} datasetIds
 * @param {String} targetWorkspaceId - Optional Parameter
 * @return EmbedToken
 */
async function getEmbedTokenForMultipleReportsSingleWorkspace(
  reportIds,
  datasetIds,
  targetWorkspaceId
) {

  console.log("🔍 Starting embed token generation...");
  console.log("📊 Report IDs:", reportIds);
  console.log("📁 Dataset IDs:", datasetIds);
  console.log("🏢 Target Workspace ID:", targetWorkspaceId);

  // Add dataset ids in the request
  let formData = { accessLevel: "Create", datasets: [], reports: [] };
  for (const datasetId of datasetIds) {
    formData["datasets"].push({
      id: datasetId,
    });
  }

  // Add report ids in the request
  formData["reports"] = [];
  for (const reportId of reportIds) {
    formData["reports"].push({
      id: reportId,
    });
  }

  // Add targetWorkspace id in the request
  if (targetWorkspaceId) {
    formData["targetWorkspaces"] = [];
    formData["targetWorkspaces"].push({
      id: targetWorkspaceId,
    });
  }
  console.log("📋 Form data being sent:", JSON.stringify(formData, null, 2));

  const embedTokenApi = "https://api.powerbi.com/v1.0/myorg/GenerateToken";
  const headers = await getRequestHeader();
  console.log("🔑 Headers being sent:", JSON.stringify(headers, null, 2));



  try {
    // Generate Embed token for multiple datasets, reports and single workspace
    const result = await fetch(embedTokenApi, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(formData),
    });

    console.log('📡 Response status:', result.status);
    console.log('📡 Response status text:', result.statusText);

    if (!result.ok) {
      const errorBody = await result.text();
      console.error('❌ Embed token generation failed:');
      console.error('Status:', result.status);
      console.error('Status Text:', result.statusText);
      console.error('Error Body:', errorBody);
      console.error('Request Headers:', headers);
      console.error('Request Body:', JSON.stringify(formData, null, 2));
      
      // Log response headers for more debugging info
      console.error('Response Headers:', Object.fromEntries(result.headers));
      
      throw result;
    }

    const tokenResponse = await result.json();
    console.log('✅ Embed token generated successfully');
    console.log('⏰ Token expires at:', new Date(tokenResponse.expiration));
    
    return tokenResponse;
    
  } catch (error) {
    console.error('❌ Error in embed token generation:', error);
    throw error;
  }
}

/**
 * Get Embed token for multiple reports, multiple datasets, and optional target workspaces
 * @param {Array<string>} reportIds
 * @param {Array<string>} datasetIds
 * @param {Array<string>} targetWorkspaceIds - Optional Parameter
 * @return EmbedToken
 */
async function getEmbedTokenForMultipleReportsMultipleWorkspaces(
  reportIds,
  datasetIds,
  targetWorkspaceIds
) {
  // Note: This method is an example and is not consumed in this sample app

  // Add dataset ids in the request
  let formData = {
    accessLevel: "Create", 
    datasets: [],
    reports: [],
  };
  for (const datasetId of datasetIds) {
    formData["datasets"].push({
      id: datasetId,
    });
  }

  // Add report ids in the request
  formData["reports"] = [];
  for (const reportId of reportIds) {
    formData["reports"].push({
      id: reportId,
    });
  }

  // Add targetWorkspace ids in the request
  if (targetWorkspaceIds) {
    formData["targetWorkspaces"] = [];
    for (const targetWorkspaceId of targetWorkspaceIds) {
      formData["targetWorkspaces"].push({
        id: targetWorkspaceId,
      });
    }
  }

  const embedTokenApi = "https://api.powerbi.com/v1.0/myorg/GenerateToken";
  const headers = await getRequestHeader();

  // Generate Embed token for multiple datasets, reports and workspaces. Refer https://aka.ms/MultiResourceEmbedToken
  const result = await fetch(embedTokenApi, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(formData),
  });

  if (!result.ok) {
    // ADD WARNING TODO
    console.log(result);
    throw result;
  }
  return result.json();
}

/**
 * Get Request header
 * @return Request header with Bearer token
 */
export async function getRequestHeader() {
  // Store authentication token
  let tokenResponse;

  // Store the error thrown while getting authentication token
  let errorResponse;

  // Get the response from the authentication request
  try {
    tokenResponse = await auth.getAccessToken();
  } catch (err) {
    if (
      err.hasOwnProperty("error_description") &&
      err.hasOwnProperty("error")
    ) {
      errorResponse = err.error_description;
    } else {
      // Invalid PowerBI Username provided
      errorResponse = err.toString();
    }
    return {
      status: 401,
      error: errorResponse,
    };
  }

  // Extract AccessToken from the response
  const token = tokenResponse.accessToken;
  return {
    "Content-Type": "application/json",
    Authorization: utils.getAuthHeader(token),
  };
}


// Also add this helper function to check workspace permissions
async function checkWorkspacePermissions(workspaceId) {
  console.log('🔍 Checking workspace permissions...');
  
  const workspaceApi = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}`;
  const headers = await getRequestHeader();

  try {
    const result = await fetch(workspaceApi, {
      method: "GET",
      headers: headers,
    });

    if (result.ok) {
      const workspace = await result.json();
      console.log('✅ Workspace access confirmed:', workspace.name);
      console.log('🔐 User role in workspace:', workspace.isReadOnly ? 'Read-only' : 'Full access');
      return workspace;
    } else {
      console.error('❌ Cannot access workspace:', result.status, result.statusText);
      return null;
    }
  } catch (error) {
    console.error('❌ Error checking workspace:', error);
    return null;
  }
}
