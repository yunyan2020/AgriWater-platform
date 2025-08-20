import express from "express";

import {
  getLoginPage,
  redirectOnStatus,
  getIdPage,
} from "../controllers/mainController.js";
import dashboardRouter from "./dashboardRoutes.js"; // let path = require('path');
import { getEmbedInfo } from "../embedConfigService.js";
// let embedToken = require(__dirname + '/embedConfigService.js');
import * as utils from "../utils.js";
import appSettings from "../login_app_config.js";

export default (msid) => {
  // initialize router
  const router = express.Router();

  // app routes
  router.get("/", (req, res, next) => res.redirect("/home"));
  router.get("/home", redirectOnStatus("/dashboard", "/login"));
  router.get("/login", getLoginPage);

  // authentication routes
  router.get("/signin", msid.signIn({ postLoginRedirect: "/dashboard" }));
  router.get("/signout", (req, res) => {
    // Custom logout logic
    res.clearCookie("connect.sid");
    msid.signOut({ postLogoutRedirect: "/" })(req, res);
  });

  // secure routes
  router.get("/id", msid.isAuthenticated(), getIdPage);

  router.use(
    "/dashboard",
    msid.isAuthenticated(),
    (req, res, next) => {
      // @ts-ignore
      if (req.session.account.idTokenClaims.groups?.length == 0) {
        res.send("You are unauthorized");
        return;
      }
      next();
    },
    dashboardRouter
  );

  router.use(
    "/getEmbedToken",
    msid.isAuthenticated(),
    async function (_req, res) {
      // Validate whether all the required configurations are provided in report_app_config.json
      let configCheckResult = utils.validateConfig();
      if (configCheckResult) {
        res.status(400).send({
          error: configCheckResult,
        });
        return;
      }
      // Get the details like Embed URL, Access token and Expiry
      // @ts-ignore
      let result = await getEmbedInfo(_req);

      // result.status specified the statusCode that will be sent along with the result object
      res.status(result.status).send(result);
    }
  );

  // unauthorized
  router.get("/unauthorized", (req, res) => res.redirect("/signin"));

  // 404
  router.get("*", (req, res) => {
    console.log(`404 client requested from route ${req.originalUrl}`);
    res.status(404).send(`404 route not found ${req.originalUrl}`);
  });

  return router;
};
