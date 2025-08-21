import { getRequestHeader } from "../embedConfigService.js";
import { get_string } from "../env.js";
import { read_JSON } from "../utils.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

export function get_claims(req) {
  return {
    name: req.session.account?.idTokenClaims?.name,
    preferred_username: req.session.account?.idTokenClaims?.preferred_username,
    oid: req.session.account?.idTokenClaims?.oid,
    sub: req.session.account?.idTokenClaims?.sub,
    roles: req.session.account?.idTokenClaims?.roles
      ? req.session.account.idTokenClaims.roles.join(" ")
      : null,
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function is_matching_groups(req, groupId) {
  const groups: string[] = req.session.account.idTokenClaims.groups;
  //todo: need groupdata in the response
  //console.log("groups--->", groups);
  if (!groups) return false;

  // const full_filenames = fs.readdirSync(
  //   path.resolve(__dirname, "../config/reports/")
  // );
  // const filenames = full_filenames.map((full_filename) =>
  //   path.basename(full_filename, path.extname(full_filename))
  // );
  //console.log("groups",groups)
  return groups.includes(groupId);
}

export function getDashboard(req, res) {
  const isAuthenticated = req.session.isAuthenticated;

  res.render("dashboard", {
    isAuthenticated: isAuthenticated,
    claims: get_claims(req),
  });
}

export type ReportFormat = {
  id: string;
  workspace: string;
  name: string;
  reports: {
    [reportGroupName: string]: {
      [reportName: string]: string;
    };
  };
};

function isValidUUID(uuid) {
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(uuid);
}

function isReportFormat(data: any): data is ReportFormat {
  if (typeof data !== "object") {
    return false;
  }
  if (
    !data.workspace ||
    typeof data.workspace !== "string" ||
    !isValidUUID(data.workspace)
  ) {
    return false;
  }
  if (!data.reports || typeof data.reports !== "object") {
    return false;
  }

  const { reports } = data;

  for (const reportGroupName in reports) {
    const reportGroup = reports[reportGroupName];
    if (typeof reportGroup !== "object") {
      return false;
    }
    for (const reportName in reportGroup) {
      if (
        typeof reportName !== "string" ||
        typeof reportGroup[reportName] !== "string" ||
        !isValidUUID(reportGroup[reportName])
      ) {
        return false;
      }
    }
  }
  return true;
}

export function zip(keys: any[], values: any[]) {
  return keys.reduce((acc, k, i) => ((acc[k] = values[i]), acc), {});
}

export async function loadReportData(req) {
  if (!req.session.isAuthenticated) {
    throw new Error(`Cannot load report of a user that isn't signed in`);
  }
  let group_reports: ReportFormat[] = [];

  //todo: get the base url of server
  const reportConfigurationsApi = get_string("CONFIG_API_URL"); //"http://localhost:7261/api/GetConfigurations";
  const result = await fetch(reportConfigurationsApi, {
    method: "GET",
  });

  if (!result.ok) {
    throw new Error(`Failed to fetch configurations: ${result.statusText}`);
  }

  //todo: remove once we have the response from json
  const jsonResult = await result.json();

  // Process and filter the configurations based on Azure group memberships
  group_reports = jsonResult
    .map((azure_element) => {
      try {
        //const jsonElement = JSON.parse(azure_element);
        const jsonElement =
          typeof azure_element === "string"
            ? JSON.parse(azure_element)
            : azure_element;

        if (!isReportFormat(jsonElement)) {
          throw new Error(
            `Invalid JSON format for configuration: ${JSON.stringify(
              jsonElement
            )}`
          );
        }

        // Match the group against the user's session groups
        if (is_matching_groups(req, jsonElement.id)) {
          return jsonElement;
        }

        return null; // Omit non-matching configurations
      } catch (error) {
        console.warn(
          `Error processing configuration element: ${error.message}`
        );
        return null;
      }
    })
    .filter((report) => report !== null); // Remove null entries

  return group_reports;
}

export const invalid_reports = new Set();

export async function getList(req, res) {
  if (!req.session.isAuthenticated) {
    return res.status(401).send({ error: "Unauthorized" });
  }

  const group_reports = await loadReportData(req);

  let reports_by_group = await Promise.all(
    group_reports.map(async (azure_group_data) => {
      if (!azure_group_data.reports) return;

      const azure_group_name = azure_group_data.name;
      const report_group_names = Object.keys(azure_group_data.reports);
      const report_group_data = Object.values(azure_group_data.reports);

      let reports_by_group_data = await Promise.all(
        report_group_data.map(async (reports) => {
          const report_names = Object.keys(reports);
          const report_ids = Object.values(reports);

          // Collect all report pages and tag with report_id
          let allPagesWithReportId = [];

          for (let i = 0; i < report_ids.length; i++) {
            const report_id = report_ids[i];
            const pages = await getReports(
              azure_group_data.workspace,
              report_id
            ); // assumed to return an array of page objects
            pages.forEach((page) => {
              allPagesWithReportId.push({ ...page, report_id });
            });
          }

          // Sort globally by 'order'
          allPagesWithReportId.sort((a, b) => a.order - b.order);

          // Regroup pages by report_id
          const groupedByReportId = report_ids.map((report_id) =>
            allPagesWithReportId
              .filter((page) => page.report_id === report_id)
              .map((pageInfo) => ({
                name: pageInfo.displayName,
                id: pageInfo.name,
              }))
              .filter((pageInfo) => !/^Hide-/.test(pageInfo.name))
          );

          // Combine report name with grouped pages
          const report_data = report_names.map((report_name, idx) => {
            return {
              name: report_name,
              pages: groupedByReportId[idx],
            };
          });

          // Zip with report_ids for further mapping
          return zip(report_ids, report_data);
        })
      );

      // Map report groups with their names
      const reportData = zip(report_group_names, reports_by_group_data);

      // Return the object for this Azure group
      return {
        [azure_group_name]: reportData,
      };
    })
  );

  res.json(reports_by_group);
}

async function getReports(workspace: string, report_id: string) {
  const headers = await getRequestHeader();
  // console.log("Debug getReports headers", headers);
  const reportInGroupApi = `https://api.powerbi.com/v1.0/myorg/groups/${workspace}/reports/${report_id}/pages`;
  const result = await fetch(reportInGroupApi, {
    method: "GET",
    headers: headers,
  });

  if (!result.ok) {
    console.warn(`Report with id ${report_id} does not exist.`);
    invalid_reports.add(report_id);
    return [
      {
        displayName: `${report_id} does not exist.`,
        name: `${report_id}_not_found`,
      },
    ];
  }
  return (await result.json()).value;
}
