const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const vhost = require("vhost");
const vhttps = require("vhttps");
const serveIndex = require("serve-index");
const primaryService = express();
require("dotenv").config();
primaryService.disable("x-powered-by");
primaryService.use((req, res, next) => {
  res.setHeader("x-powered-by", process.env.NODEJS_WEBHOST_NETWORK_NAME);
  next();
});

const PORT = process.env.NODEJS_WEBHOST_PORT || 80; //80 & 443 are the common ports for Web Protocols.
const corsWhitelist = [
  process.env.NODEJS_WEBHOST_FQDN,
  process.env.NODEJS_WEBHOST_ENABLE_WWW
    ? "www." + process.env.NODEJS_WEBHOST_FQDN
    : undefined
];

const defaultCredential = {
  cert: undefined,
  ca: undefined,
  key: undefined
};

const sslCredentials = [
  {
    hostname: undefined,
    cert: undefined,
    ca: undefined,
    key: undefined
  }
];

function handleCorsDelegation(overrideCallback = null) {
  if (overrideCallback) {
    return overrideCallback;
  }
  return function(req, callback) {
    let corsOptions;
    if (corsWhitelist.indexOf(req.header("Origin")) !== -1) {
      corsOptions = { origin: true }; // reflect (enable) the requested origin in the CORS response
    } else {
      corsOptions = { origin: false }; // disable CORS for this request
    }
    callback(null, corsOptions); // callback expects two parameters: error and options
  };
}

let httpsServer;
let httpServer;
console.log("SSL ENABLED : ", process.env.NODEJS_WEBHOST_ENABLE_SSL);
if (process.env.NODEJS_WEBHOST_ENABLE_SSL === true) {
  console.log("SSL Sever Initiated");
  httpsServer = vhttps.createServer(
    defaultCredential,
    sslCredentials,
    primaryService
  );
  httpServer = require("http").createServer(primaryService);
} else {
  httpServer = require("http").createServer(primaryService);
}

const vhostApp = express();
vhostApp.disable("x-powered-by");
vhostApp.set("X-Powered-By", process.env.NODEJS_WEBHOST_NETWORK_NAME);

primaryService.options(
  "*",
  cors(function(req, callback) {
    callback(null, { origin: true });
  })
);

vhostApp.use(
  cors(handleCorsDelegation()),
  express.json(),
  express.urlencoded({
    extended: true
  }),
  express.static("public", {
    dotfiles: "allow",
    redirect: false,
    index: "index.html"
  }),
  serveIndex("public/*", { icons: true })
);

vhostApp.get("/*",  (req, res, next) => {
      //try base static files first
      const baseFilePath = req.path
      return res.sendFile(
        path.resolve(
          path.join(
            __dirname, 'public', baseFilePath
          ) //req.path
        )
      );
    console.log(baseFilePath);
});
console.log("Loading Virtual Host");
primaryService.use(vhost(process.env.NODEJS_WEBHOST_FQDN, vhostApp));
console.log("Loading Virtual Host Subdomain");
primaryService.use(vhost(`www.${process.env.NODEJS_WEBHOST_FQDN}`, vhostApp));




if (process.env.NODEJS_WEBHOST_ENABLE_SSL === true) {
  httpsServer.listen(443, process.env.NODEJS_WEBHOST_BIND_TO_IP, () => {});
}
httpServer.listen(80, process.env.NODEJS_WEBHOST_BIND_TO_IP, () => {});

// primaryService.close();
