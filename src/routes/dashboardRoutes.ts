import express from "express";
import { getDashboard, getList } from "../controllers/dashboardController.js";
import { getAccessToken } from "../authentication.js";

const router = express.Router();

// Enhanced authentication middleware
const requireAuth = async (req, res, next) => {
  if (!req.session.isAuthenticated) {
    return res.redirect("/signin");
  }

  try {
    // Verify we can get an access token
    await getAccessToken();
    next();
  } catch (error) {
    console.error("Authentication verification failed:", error);

    if (
      error.message === "Authentication required" &&
      req.session.authCodeUrl
    ) {
      // Redirect to auth if we have a URL
      return res.redirect(req.session.authCodeUrl);
    }

    // Handle API vs page requests differently
    if (req.path.startsWith("/api")) {
      return res
        .status(401)
        .json({ error: "Session expired. Please reauthenticate." });
    } else {
      return res.redirect("/signin");
    }
  }
};

// Group membership check middleware
const checkGroupMembership = (req, res, next) => {
  const groups = req.session.account?.idTokenClaims?.groups || [];

  if (groups.length === 0) {
    console.warn("User has no group memberships");
    return res.status(403).render("unauthorized", {
      message: "You don't have permissions to access any reports",
    });
  }
  next();
};

// Dashboard routes
router.get("/", requireAuth, checkGroupMembership, getDashboard);

router.get("/list", requireAuth, checkGroupMembership, getList);

export default router;
