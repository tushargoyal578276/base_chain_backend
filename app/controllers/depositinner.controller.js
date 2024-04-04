const db = require("../models");
const Deposit = db.deposits;
const sequelize = db.Sequelize;
const Op = db.Sequelize.Op;

exports.create = async (req) => {
  // Create a Deposit
  const deposit = req
  try {
    const maxblocks = await Deposit.create(deposit) 
    return maxblocks;  
  } catch (error) {
    console.log(" -- Inner ---  Some error occurred while creating the Deposit.")
    return null;
  }
};

// Get max last block ID
exports.findPastDeposits = async (req) =>  {
  const conAddress = req.conAddress;
  const currency = req.currency;
  const tokenAddress = req.tokenAddress;
  const netId = req.netId;

  try {
    // const allDeposits = await Deposit.findAll({
    //   attributes: ['id', 'conAddress', 'noteString', 'wallet', 'amount', 'releaseTime', 'sentYn', 'currency', 'tokenAddress','createdAt'],
    //   where: sequelize.literal('"conAddress" = \'' + conAddress + '\'' 
    //                            + ' AND "sentYn" = \'false\''
    //                            + ' AND "currency" =\'' + currency + '\'' 
    //                            + ' AND "tokenAddress" =\'' + tokenAddress + '\'' 
    //                            + ' AND CURRENT_TIMESTAMP - "createdAt" >= make_interval(0,0,0,0,0,CAST("releaseTime" as INTEGER), 0)'
    //                            ),
    //   raw: true
    // })  
    const allDeposits = await Deposit.findAll({
      attributes: ['id', 'conAddress', 'noteString', 'wallet', 'amount', 'releaseTime', 'sentYn', 'currency', 'tokenAddress', 'decimals', 'createdAt'],
      where: sequelize.literal('"conAddress" = \'' + conAddress + '\'' 
                               + ' AND "sentYn" = \'false\''
                               + ' AND "netId" = \'' + netId + '\'' 
                               + ' AND CURRENT_TIMESTAMP - "createdAt" >= make_interval(0,0,0,0,0,CAST("releaseTime" as INTEGER), 0)'
                               ),
      raw: true
    })  
    return allDeposits;
  } catch (error) {
    console.log(error);
    return null;
  }
};

// Update a deposit by the id in the request
exports.update = async (req) => {
  const id = req.id;

  try {
    const num = await Deposit.update(req, {
      where: { id: id }
    })
  
    if (num == 1) {
      return {
        message: "deposit was updated successfully."
      }
    } else {
      return {
        message: `Cannot update deposit with id=${id}. Maybe deposit was not found or req.body is empty!`
      }
    }
  } catch (error) {
    return {
      message: "Error updating deposit with id=" + id
    }
  }  
};

// Delete a deposit by the id in the request
exports.delete = async (req) => {
  const id = req.id;

  try {
    const num = await Deposit.destroy({
      where: { id: id }
    })
  
    if (num == 1) {
      return {
        message: "deposit was deleted successfully!"
      }
    } else {
      return {
        message: `Cannot delete deposit with id=${id}. Maybe deposit was not found!`
      }
    }
  } catch (error) {
    console.log('delete error -- ', error);
    return {
      message: "Could not delete deposit with id=" + id
    }
  }  
};