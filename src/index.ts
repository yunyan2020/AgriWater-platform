// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
// ----------------------------------------------------------------------------

import express from "express";
import session from "express-session";
import compression from "compression";
import methodOverride from "method-override";
import path from "path";
import MsIdExpress from "microsoft-identity-express";
import appSettings from "./login_app_config.js";
import mainRouter from "./routes/mainRoutes.js";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { get_array, get_bool, get_int, get_string } from "./env.js";
import MemoryStore from "memorystore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Enable compression middleware
app.use(compression());

if (get_array("PRODUCTION_ENVS").includes(get_string("NODE_ENV"))) {
  app.set("trust proxy", 1);
}

// Redirect all HTTP traffic to HTTPS when not in development
app.use((req, res, next) => {
  if (
    !get_array("TESTING_ENVS").includes(get_string("NODE_ENV")) &&
    !req.secure
  ) {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// Middleware to check and redirect users not on the specific domain
app.use((req, res, next) => {
  const domain = get_string("DOMAIN");
  if (req.hostname !== domain) {
    return res.redirect("https://" + domain);
  }
  next();
});

const Store = MemoryStore(session);

app.use(
  session({
    secret:
      get_string("SESSION_SECRET") ||
      "fallback-secret-at-least-32-characters-long",
    proxy: get_bool("SESSION_COOKIE_SECURE"),
    store: new Store({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: get_bool("SESSION_COOKIE_SECURE"), // set this to true on production
    },
  })
);

app.use(methodOverride("_method"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.set("views", path.join(__dirname, "./views"));
app.set("view engine", "ejs");

// Serve optimized favicon
import favicon from "serve-favicon";
app.use(favicon(path.join(__dirname, "./public/assets/images/favicon.ico")));

// Serve optimized and critical CSS
app.use(
  "/css",
  express.static(path.join(__dirname, "../node_modules/bootstrap/dist/css/"))
); // Redirect CSS bootstrap
app.use(
  "/css",
  express.static(path.join(__dirname, "./public/assets/css/"), {
    setHeaders: (res, path) => {
      if (path.endsWith(".css")) {
        res.setHeader("Cache-Control", "public, max-age=31536000");
      }
    },
  })
); // Serve custom CSS files with caching

// Preload critical CSS
app.use((req, res, next) => {
  res.setHeader(
    "Link",
    "</public/assets/css/critical.css>; rel=preload; as=style"
  );
  next();
});

// Serve JS files
app.use(
  "/js",
  express.static(path.join(__dirname, "../node_modules/bootstrap/dist/js/"))
); // Redirect bootstrap JS
app.use(
  "/js",
  express.static(path.join(__dirname, "../node_modules/jquery/dist/"))
); // Redirect JS jQuery
app.use(
  "/js",
  express.static(path.join(__dirname, "../node_modules/powerbi-client/dist/"))
); // Redirect JS PowerBI
app.use(
  "/js",
  express.static(path.join(__dirname, "./public/assets/js/"), {
    setHeaders: (res, path) => {
      if (path.endsWith(".js")) {
        res.setHeader("Cache-Control", "public, max-age=31536000");
      }
    },
  })
); // Serve custom JS files with caching

app.use("/public", express.static(path.join(__dirname, "./public/"))); // Use custom assets

// reset all sessions
if (get_bool("RESET_ALL_SESSIONS")) {
  app.use("/redirect", (req, res, next) => {
    // @ts-ignore
    if (!req.session?.is_destroyed) {
      req.session.destroy(() => {
        res.redirect("/");
        return;
      });
    }
    next();
  });
  app.use((req, res, next) => {
    // @ts-ignore
    req.session?.is_destroyed = true;
    next();
  });
}

// Microsoft identity platform
if (
  !appSettings.appCredentials.clientId ||
  !appSettings.appCredentials.tenantId ||
  !appSettings.appCredentials.clientSecret ||
  !appSettings.appCredentials.redirectUri
) {
  throw new Error("Missing required authentication configuration");
}

const msid = new MsIdExpress.WebAppAuthClientBuilder(appSettings).build();
app.use(msid.initialize());

// Preconnect to required origins
app.use((req, res, next) => {
  const origins = ["https://fonts.gstatic.com", "https://fonts.googleapis.com"]; // Add other origins as needed

  res.setHeader(
    "Link",
    origins.map((origin) => `<${origin}>; rel=preconnect`).join(", ")
  );
  next();
});

// pass the instance to your routers
app.use(mainRouter(msid));

// Ports are normally integers, but when hosting on azure ports can be strings eg "Port:  \\.\pipe\bc9d0383-b510-4f3f-a0d6-869fb0b2a2d0"
const port = get_string("PORT");

function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

process.on("unhandledRejection", (reason, p) => {
  console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
  // application specific logging, throwing an error, or other logic here
});

app.listen(port, () => {
  const nodeEnv = process.env.NODE_ENV || "development"; // Default to 'development' if undefined
  console.log(
    `${capitalizeFirstLetter(nodeEnv)} app running. Listening on port ${port}`
  );
});
