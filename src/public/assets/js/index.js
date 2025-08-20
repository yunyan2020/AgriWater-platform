// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

let models = window["powerbi-client"].models;
let reportContainer = $("#report-container").get(0);

// Initialize iframe for embedding report
powerbi.bootstrap(reportContainer, { type: "report" });

let report;

let expiry = "";

// Embred urls with report id as keys
let embed_urls = {};

let report_lists = [];
// A list of only the reports used
let report_list = [];

let reports_structures = [];
// A list of group ordering, titles and so on
let reports_structure = {};

let current_report_id = "";
let current_page_idx = 0;

async function switch_to_page(report_id, page_idx, reportList) {
  console.log("Switching to report_id:", report_id, "page_idx:", page_idx);

  // Check if embed_urls has the required report data
  if (!embed_urls[report_id]) {
    console.error("No embed URL found for report ID:", report_id);
    console.log("Available embed_urls keys:", Object.keys(embed_urls));
    alert("Error: Report configuration not found. Please refresh the page.");
    return;
  }

  // Check if reportList has the required report data
  if (!reportList[report_id] || !reportList[report_id].pages || !reportList[report_id].pages[page_idx]) {
    console.error("Invalid report structure for report ID:", report_id);
    console.log("Available reportList keys:", Object.keys(reportList));
    alert("Error: Report page not found.");
    return;
  }

  if (current_report_id !== report_id) {
    const pageId = reportList[report_id].pages[page_idx].id;
    const accessToken = embed_urls[report_id].accessToken;
    const embedUrl = embed_urls[report_id].embedUrl;

    console.log("Loading new report:", {
      pageId,
      embedUrl,
      hasAccessToken: !!accessToken
    });

    load_report(pageId, accessToken, embedUrl);
    current_report_id = report_id;
    current_page_idx = page_idx;
    return;
  }

  if (current_page_idx !== page_idx) {
    try {
      const pages = await report.getPages();
      await pages[page_idx].setActive();
      current_page_idx = page_idx;
    } catch (errors) {
      console.error("Error switching pages:", errors);
    }
  }
}

// Function to set the iframe size
function setIframeSize(height) {
  const iframe = reportContainer.querySelector("iframe");
  if (iframe) {
    iframe.style.height = height + "%";
  }
}

function load_report(page_id, accessToken, embedUrl) {
  // Create a config object with type of the object, Embed details and Token Type
  //console.log(page_id, embedUrl);
  let reportLoadConfig = {
    type: "report",
    tokenType: models.TokenType.Embed,
    accessToken: accessToken,
    embedUrl: embedUrl,
    pageName: page_id,

    settings: {
      // Comment filterPaneEnabled(we want to show filter pane at platform now)
      //filterPaneEnabled: false,
      panes: {
        pageNavigation: { visible: false },
      },
      visualsLayout: {
        width: 400,
        height: 250,
        displayState: {
          mode: models.VisualContainerDisplayMode.Hidden,
        },
      },
      pagesize: {
        width: 400,
        height: 250,
        displayState: {
          mode: models.VisualContainerDisplayMode.Hidden,
        },
      },
      pageLayout: {
        visualsLayout: {
          VisualContainer1: {
            x: 70,
            y: 100,
            displayState: {
              mode: models.VisualContainerDisplayMode.Visible,
            },
          },
          VisualContainer3: {
            x: 540,
            y: 100,
            displayState: {
              mode: models.VisualContainerDisplayMode.Visible,
            },
          },
        },
      },
    },
  };
  // Use the token expiry to regenerate Embed token for seamless end user experience
  // Refer https://aka.ms/RefreshEmbedToken
  tokenExpiry = expiry;

  // Embed Power BI report when Access token and Embed URL are available
  report = powerbi.embed(reportContainer, reportLoadConfig);
  // Clear any other error handler events
  report.off("error");

  // Wait for the report to load and then set the iframe size
  report.on("loaded", function () {
    setIframeSize(100); // Adjust height as needed
  });
  report.on("error", function (event) {
    let errorMsg = event.detail;
    console.error(errorMsg);
    return;
  });
}

function getEmbedToken() {
  return new Promise((res, err) => {
    // AJAX request to get the report details from the API and pass it to the UI
    $.ajax({
      type: "GET",
      url: "/getEmbedToken",
      dataType: "json",
      success: function (embed_data) {
        res(embed_data);
      },
      error: function (err_callback) {
        console.error("Full error response:", err_callback);

        // Show error container
        let errorContainer = $(".error-container");
        $(".embed-container").hide();
        errorContainer.show();

        // Check if responseText exists and is valid JSON
        let errMsg = "Unknown error occurred";
        if (err_callback.responseText) {
          try {
            const errorResponse = JSON.parse(err_callback.responseText);
            errMsg = errorResponse.error || errorResponse.message || "API Error";
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError);
            errMsg = `Server returned: ${err_callback.responseText}`;
          }
        } else if (err_callback.statusText) {
          errMsg = err_callback.statusText;
        }

        // Split the message with \r\n delimiter to get the errors from the error message
        let errorLines = errMsg.split("\r\n");

        // Create error header
        let errHeader = document.createElement("p");
        let strong = document.createElement("strong");
        let node = document.createTextNode("Error Details:");

        // Get the error container
        let errContainer = errorContainer.get(0);

        // Clear previous errors
        errContainer.innerHTML = "";

        // Add the error header in the container
        strong.appendChild(node);
        errHeader.appendChild(strong);
        errContainer.appendChild(errHeader);

        // Create <p> as per the length of the array and append them to the container
        errorLines.forEach((element) => {
          let errorContent = document.createElement("p");
          let node = document.createTextNode(element);
          errorContent.appendChild(node);
          errContainer.appendChild(errorContent);
        });

        err(new Error(errMsg));
      },
    });
  });
}

async function get_report_list() {
  let stream = await fetch("/dashboard/list");
  let mainMenuLists = await stream.json();
  const sidebar = document.getElementById("sidebar-nav");

  // console.log("reports", reports);
  // const mainMenuList = Object.entries(reports);
  mainMenuLists.forEach((mainMenuList) => {
    const [key] = Object.keys(mainMenuList);
    const [value] = Object.values(mainMenuList);
    const heading = document.createElement("li");

    heading.innerHTML = `<i class="bi bi-menu-button-wide"></i> <span>${key}</span>`;
    heading.classList = "nav-heading";

    sidebar.append(heading);
    const subMenu = value;

    const subMenus = Object.keys(subMenu);

    subMenus.forEach((subMenuKey, subMenuIndex) => {
      const menu = document.createElement("li");
      menu.classList = "nav-item";

      menu.innerHTML = `<a class="nav-link collapsed report-category" href="#"
          aria-expanded="">
          <span class="sub-menu">${subMenuKey}</span>
        </a>`;

      const reportData = subMenu[subMenuKey];
      const reportDataKeys = Object.keys(reportData);
      reportDataKeys.forEach((reportDataKey, reportIndex) => {
        const reportList = document.createElement("li");
        reportList.classList = "dropdown";

        reportList.innerHTML = `<a class="nav-link collapsed" data-bs-target="#child-${
          subMenuIndex + "" + reportIndex
        }" data-bs-toggle="collapse" href="#"
          aria-expanded="">
          <span class="sub-menu">${
            reportData[reportDataKey].name
          }</span> <i class="bi bi-chevron-down ms-auto"></i>
        </a>`;

        const submenu = document.createElement("ul");
        submenu.id = `child-${subMenuIndex + "" + reportIndex}`;
        submenu.classList = `nav-content collapse`;

        // console.log("reportData[reportDataKey]", reportData);

        if (reportData[reportDataKey].pages.length == 1) {
          reportList.onclick = () =>
            switch_to_page(reportDataKey, 0, reportData);
        } else {
          reportData[reportDataKey].pages.forEach(({ name }, index) => {
            const list = document.createElement("li");
            list.onclick = () =>
              switch_to_page(reportDataKey, index, reportData);

            list.innerHTML = `<a href="#">
              <i class="bi bi-file-earmark-bar-graph"></i><span class="report-link">${name}</span>
            </a>`;
            submenu.append(list);
          });

          reportList.append(submenu);
        }

        menu.append(reportList);
      });

      sidebar.append(menu);
    });
  });

  return mainMenuLists;
}

async function main() {
  [embed_data, reports_structures] = await Promise.all([
    getEmbedToken(),
    get_report_list(),
  ]);

  embed_data.data?.forEach((workspace) => {
    if (Array.isArray(workspace.embedUrl)) {
      workspace.embedUrl?.forEach((embed) => {
        embed_urls[embed.reportId] = {
          ...embed,
          accessToken: workspace.accessToken,
        };
      });
    }
  });

  reports_structures.forEach((reports_structure) => {
    report_lists.push(
      Object.values(reports_structure)
        .map((azure_group_data) => Object.values(azure_group_data))
        .flat()
        .reduce((accumulator, currentObject) => {
          return Object.assign(accumulator, currentObject);
        }, {})
    );
  });

  let default_report_id = "";
  report_lists.forEach((reportList) => {
    if (!default_report_id) {
      default_report_id = Object.keys(reportList)[0];
    }
    for (const [reportId, reportData] of Object.entries(reportList)) {
      reportData.embed_url = embed_urls[reportId].embedUrl;
    }
  });

  // Object.values(report_list).forEach((report_data, idx) => report_data.embed_url = embed_urls[idx].embedUrl)
  switch_to_page(default_report_id, 0, report_lists[0]);
}
main();

$(document).ready(function () {
  $("#search").on("keyup", function () {
    if (this.value.length > 0) {
      $(".sidebar-nav > li")
        .hide()
        .filter(function () {
          return (
            $(this)
              .text()
              .toLowerCase()
              .indexOf($("#search").val().toLowerCase()) != -1
          );
        })
        .show();
    } else {
      $(".sidebar-nav > li").show();
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  document
    .getElementById("sidebarCollapse")
    .addEventListener("click", function () {
      document.getElementById("sidebar").classList.toggle("active");
      document.getElementById("main").classList.toggle("active");
      document.getElementById("footer").classList.toggle("active");
    });
});
