import { get_claims } from "./dashboardController.js";

export function getLoginPage(req, res, next) {
    const isAuthenticated = req.session.isAuthenticated;
    res.render('login', { isAuthenticated: isAuthenticated, claims: get_claims(req) });
}

export function redirectOnStatus(isLoggedIn, notLoggedIn) {
    return (req, res, next) => {
        // if session is invalid, assume user isnt logged in
        const url = req.session?.isAuthenticated ? isLoggedIn : notLoggedIn;
        res.redirect(url)
    }
}

export function getIdPage(req, res, next) {
    res.render('id', { isAuthenticated: req.session.isAuthenticated, claims: get_claims(req) });
}