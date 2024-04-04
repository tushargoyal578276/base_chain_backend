module.exports = (sequelize, Sequelize) => {
  const Deposit = sequelize.define("deposit", {
    conAddress: {
      type: Sequelize.STRING
    },
    noteString: {
      type: Sequelize.STRING
    },
    wallet: {
      type: Sequelize.STRING
    },
    amount: {
      type: Sequelize.STRING
    },
    releaseTime: {
      type: Sequelize.STRING
    },
    sender: {
      type: Sequelize.STRING
    },
    sentYn: {
      type: Sequelize.STRING
    },
    currency: {
      type: Sequelize.STRING
    },
    tokenAddress: {
      type: Sequelize.STRING
    },
    decimals: {
      type: Sequelize.STRING
    },
    netId: {
      type: Sequelize.STRING
    }
  });

  return Deposit;
};
