const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require('dotenv').config()

const app = express();

// app.use(cors(corsOptions));
app.use(cors({
  origin: '*'
}));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

const db = require("./app/models");
db.sequelize.sync()
  .then(() => console.log('PostgresSQL is sync'))
  .catch(err => console.log(err));

console.log('process.env -- ', process.env.dbpass);

// simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to priceai application." });
});

require("./app/routes/deposit.routes")(app);

// set port, listen for requests
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`  ===== Server is running on port ${PORT}.`);
});