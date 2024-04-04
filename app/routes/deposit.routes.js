module.exports = app => {
  const deposits = require("../controllers/deposit.controller.js");

  var router = require("express").Router();

  // Create a new deposit
  router.post("/wallets", deposits.wallets);

  // Create a new deposit
  router.post("/create", deposits.create);

  app.use("/api/deposits", router);
};
