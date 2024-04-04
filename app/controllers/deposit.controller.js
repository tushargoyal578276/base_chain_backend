const Decimal = require('decimal.js');
const keythereum = require("keythereum");
const db = require("../models");
const Deposit = db.deposits;
const sequelize = db.Sequelize;
const Op = db.Sequelize.Op;

function generateWallets() {
  let dk = keythereum.create();
  let readableAddress = keythereum.privateKeyToAddress(dk.privateKey);

  return { wallet: readableAddress, privateKey: dk.privateKey.toString('hex') }
}

function getPrecisionNumber(_inNumber, precision) {
  const ret = _inNumber;
  // return (Math.ceil(ret * 10 ** precision) / 10 ** precision).toFixed(precision);
  return Math.ceil(ret * 10 ** precision) / 10 ** precision;
}

function getRandomAmt(_amt, _numWallet) {
  var parcelas = [];
  var sum = 0;
  var testSum = 0;
  for (var i = 0; i < _numWallet; i++) {
    var val = Math.random();
    sum += val;
    parcelas.push(val);
  }

  _amt = Number(_amt);

  for (var i = 0; i < _numWallet - 1; i++) {
    // parcelas[i] = Math.floor(parcelas[i] * _amt / sum);
    parcelas[i] = getPrecisionNumber(parcelas[i] * _amt / sum, 5);
    let tempSum = new Decimal(testSum);
    let tempNewItem = new Decimal(parcelas[i]);
    testSum = tempSum.plus(tempNewItem).toNumber();
    console.log(tempNewItem.toNumber());
  }

  let decimalAmt = new Decimal(_amt);
  let decimalSum = new Decimal(testSum);
  parcelas[_numWallet - 1] = decimalAmt.minus(decimalSum).toNumber();
  console.log(parcelas[_numWallet - 1]);

  return parcelas;
}

// get random wallets and privatekey
exports.wallets = (req, res) => {
  // Validate request

  if (!req.body.amount) {
    res.status(400).send({
      message: "Content can not be empty!"
    });
    return;
  }

  console.log('amt === ', req.body);

  let numWallets = Math.ceil(6 * Math.random());
  if (numWallets == 0)
    numWallets = 1;

  let randomAmts = getRandomAmt(req.body.amount, numWallets);

  let data = [];
  for (let i = 0; i < numWallets; i++) {
    let timeFrame = Math.ceil((60 - 5) * Math.random() + 5);
    // let timeFrame = Math.ceil( (3-1) * Math.random() + 1) ;

    let walletData = generateWallets();
    data.push({ wallet: walletData.wallet, privateKey: walletData.privateKey, amount: randomAmts[i], timeFrame });
  }
  res.send(data);
};

// Create and Save a new Tutorial
exports.create = (req, res) => {
  // Validate request

  if (!req.body.noteString) {
    res.status(400).send({
      message: "Content can not be empty!"
    });
    return;
  }

  console.log(req.body.noteString);

  let responseData = "";

  for (let index = 0; index < req.body.noteString.length; index++) {

    const noteRegex = /price-(?<currency>[\w\s]+)-(?<amount>[\d.]+)-(?<netId>\d+)-0x(?<note>[0-9a-fA-F]{124})/g
    const match = noteRegex.exec(req.body.noteString);
    const netId = Number(match.groups.netId);

    // Create a deposit
    const deposit = {
      conAddress: req.body.conAddress,
      amount: req.body.amount[index],
      noteString: req.body.noteString[index],
      wallet: req.body.wallet[index],
      releaseTime: req.body.releaseTime[index],
      sentYn: false,
      currency: req.body.currency,
      tokenAddress: req.body.tokenAddress,
      decimals: req.body.decimals,
      netId,
      sender: ""
    };

    // Save deposit in the database
    Deposit.create(deposit)
      .then(data => {
        responseData += data;
      })
      .catch(err => {
        res.status(500).send({
          message:
            err.message || "Some error occurred while creating the deposit."
        });
      });
  }

  res.send(responseData);
};

// Update a deposit by the id in the request
exports.update = (req, res) => {
  const id = req.params.id;

  Deposit.update(req.body, {
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.send({
          message: "deposit was updated successfully."
        });
      } else {
        res.send({
          message: `Cannot update deposit with id=${id}. Maybe deposit was not found or req.body is empty!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error updating deposit with id=" + id
      });
    });
};

// Delete a deposit with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  Deposit.destroy({
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.send({
          message: "deposit was deleted successfully!"
        });
      } else {
        res.send({
          message: `Cannot delete deposit with id=${id}. Maybe deposit was not found!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Could not delete deposit with id=" + id
      });
    });
};

// find all sent deposit
exports.findAllSent = (req, res) => {
  Deposit.findAll({ where: { sentYn: true } })
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving deposits."
      });
    });
};
