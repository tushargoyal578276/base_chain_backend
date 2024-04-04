require('dotenv').config()
const fs = require('fs');
const axios = require('axios')
const Web3 = require('web3')
const config = require('./config')
const console = require('console')

const cron = require('node-cron');
const { exit } = require('process')

const assert = require('assert')
const snarkjs = require('snarkjs')
const circomlib = require('circomlib')
const bigInt = snarkjs.bigInt
const buildGroth16 = require('websnark/src/groth16')
const websnarkUtils = require('websnark/src/utils')
const { toWei, fromWei, toBN, BN } = require('web3-utils')

const merkleTree = require('./lib/MerkleTree')

const deposits = require("../controllers/depositinner.controller.js");

let web3, privateNado, privateNaoAddress, circuit, proving_key, groth16, senderAccount
let MERKLE_TREE_HEIGHT = 20;

/** Compute pedersen hash */
const pedersenHash = data => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]

/** BigNumber to hex string of specified length */
function toHex(number, length = 32) {
  const str = number instanceof Buffer ? number.toString('hex') : bigInt(number).toString(16)
  return '0x' + str.padStart(length * 2, '0')
}

function fromDecimals({ amount, decimals }) {
  amount = amount.toString()
  let ether = amount.toString()
  const base = new BN('10').pow(new BN(decimals))
  const baseLength = base.toString(10).length - 1 || 1

  const negative = ether.substring(0, 1) === '-'
  if (negative) {
    ether = ether.substring(1)
  }

  if (ether === '.') {
    throw new Error('[ethjs-unit] while converting number ' + amount + ' to wei, invalid value')
  }

  // Split it into a whole and fractional part
  const comps = ether.split('.')
  if (comps.length > 2) {
    throw new Error(
      '[ethjs-unit] while converting number ' + amount + ' to wei,  too many decimal points'
    )
  }

  let whole = comps[0]
  let fraction = comps[1]

  if (!whole) {
    whole = '0'
  }
  if (!fraction) {
    fraction = '0'
  }
  if (fraction.length > baseLength) {
    throw new Error(
      '[ethjs-unit] while converting number ' + amount + ' to wei, too many decimal places'
    )
  }

  while (fraction.length < baseLength) {
    fraction += '0'
  }

  whole = new BN(whole)
  fraction = new BN(fraction)
  let wei = whole.mul(base).add(fraction)

  if (negative) {
    wei = wei.mul(negative)
  }

  return new BN(wei.toString(10), 10)
}

/**
 * Create deposit object from secret and nullifier
 */
function createDeposit({ nullifier, secret }) {
  const deposit = { nullifier, secret }
  deposit.preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
  deposit.commitment = pedersenHash(deposit.preimage)
  deposit.commitmentHex = toHex(deposit.commitment)
  deposit.nullifierHash = pedersenHash(deposit.nullifier.leInt2Buff(31))
  deposit.nullifierHex = toHex(deposit.nullifierHash)
  return deposit
}

function getPastEventsScanUrl(_tokenaddress) {
  return process.env.scanurl + 'api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=' + _tokenaddress + '&apikey=' + process.env.scanurlapikey;
}

// function getPastEventsScanUrl(_tokenaddress) {
//   return 'https://api-testnet.bscscan.com/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=' + _tokenaddress + '&apikey=INITE2GVKFSVR9K3JERUB7RH19RFTIZAER' + '&topic0=0xa945e51eec50ab98c161376f0db4cf2aeba3ec92755fe2fcd388bdbbb80ff196'
// }

async function getPastEventsPrivatex(_tokenaddress) {
  let allLogs = []
    await  axios.get(getPastEventsScanUrl(_tokenaddress), {
          params: {
                      
          }
        })
      .then(function (response) {
        // allEvents = response.result
        if (response.data.status == 1) {
          allLogs = response.data.result;
        }
      })
      .catch(function (error) {
        console.log(error);
      })
      .then(function () {
        // always executed
      }
    );    

    allFromApi = []
    for (idx = 0; idx< allLogs.length; idx ++) {
      const blockNumber = parseInt(allLogs[idx].blockNumber, 16);
      const events = await privateNado.getPastEvents('Deposit', { fromBlock: 	blockNumber, toBlock: 	blockNumber })
      if (events.length!=0) {
        allFromApi = [...allFromApi, ...events]
      }
    }

    // // get events  for 12 hours 
    // let eventsFor1Day = [];
    // const endBlock = await web3.eth.getBlockNumber()
    // const maxBlock = endBlock - 20000
    // console.log('getting start blocks = ', maxBlock + ' ~ ' + endBlock)

    // for(let i = maxBlock; i < endBlock; i += 5000) {
    //   console.log('polling blocks')
    //   const _startBlock = i;
    //   const _endBlock = Math.min(endBlock, i + 4999);
    //   const events = await privateNado.getPastEvents('Deposit', { fromBlock: 	_startBlock, toBlock: 	_endBlock })
    //   eventsFor1Day = [...eventsFor1Day, ...events]
    // }   

    // allEvents = [...allFromApi, ...eventsFor1Day]
    allEvents = allFromApi

    // remove duplicate
    allEvents = allEvents.filter((event, index, self) =>
      index === self.findIndex((t) => (
        t.id === event.id
      ))
    )

    return allEvents
}

/**
 * Generate merkle tree for a deposit.
 * Download deposit events from the privateNado, reconstructs merkle tree, finds our deposit leaf
 * in it and generates merkle proof
 * @param deposit Deposit object
 */
async function generateMerkleProof(deposit) {
  // Get all deposit events from smart contract and assemble merkle tree from them
  console.log('Getting current state from PrivateX contract')

  let allEvents = await getPastEventsPrivatex(privateNaoAddress);
  const leaves = allEvents
    .sort((a, b) => a.returnValues.leafIndex - b.returnValues.leafIndex) // Sort events in chronological order
    .map(e => e.returnValues.commitment) 

  const tree = new merkleTree(MERKLE_TREE_HEIGHT, leaves)
  // Find current commitment in the tree
  const depositEvent = allEvents.find(e => e.returnValues.commitment === toHex(deposit.commitment))
  const leafIndex = depositEvent ? depositEvent.returnValues.leafIndex : -1
  // Validate that our data is correct
  const root = await tree.root()
  const isValidRoot = await privateNado.methods.isKnownRoot(toHex(root)).call()
  const isSpent = await privateNado.methods.isSpent(toHex(deposit.nullifierHash)).call()

  // assert(isValidRoot === true, 'Merkle tree is corrupted')
  // assert(isSpent === false, 'The secret key is already spent')
  // assert(leafIndex >= 0, 'The deposit is not found in the tree')

  console.log('isValidRoot -- ', isValidRoot);
  console.log('isSpent -- ', isSpent);
  console.log('leafIndex -- ', leafIndex);

  if (isValidRoot !== true) return 'corrupted';
  if (isSpent === true) return 'spent';
  if (leafIndex < 0) return 'notfound';

  // Compute merkle proof of our commitment
  return tree.path(leafIndex)
}

/**
 * Generate SNARK proof for withdrawal
 * @param deposit Deposit object
 * @param recipient Funds recipient
 * @param relayer Relayer address
 * @param fee Relayer fee
 * @param refund Receive ether for exchanged tokens
 */
async function generateProof({ deposit, recipient, relayerAddress = 0, fee = 0, refund = 0, amount, tokenAddress }) {
  // Compute merkle proof of our commitment
  const generateResult = await generateMerkleProof(deposit);  

  if (generateResult === 'corrupted' || generateResult === 'spent' || generateResult === 'notfound') {
    console.log('generateResult -- ', generateResult);
    return { proof:null, args:[] }
  }

  const { root, path_elements, path_index } = generateResult;
  // Prepare circuit input
  const input = {
    // Public snark inputs
    root: root,
    nullifierHash: deposit.nullifierHash,
    recipient: bigInt(recipient),
    relayer: bigInt(relayerAddress),
    fee: bigInt(fee),
    refund: bigInt(refund),
    
    // Private snark inputs
    nullifier: deposit.nullifier,
    secret: deposit.secret,
    pathElements: path_elements,
    pathIndices: path_index,
  }

  if (groth16 === undefined) {
    // groth16 initialises a lot of Promises that will never be resolved, that's why we need to use process.exit to terminate the CLI
    groth16 = await buildGroth16()
  }

  const proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, proving_key)
  const { proof } = websnarkUtils.toSolidityInput(proofData)
  const args = [
    toHex(input.root),
    toHex(input.nullifierHash),
    toHex(input.recipient, 20),
    toHex(input.relayer, 20),
    toHex(tokenAddress, 20),
    toHex(input.fee),
    toHex(input.refund),
    toHex(bigInt(amount))
  ]

  return { proof, args }
}

/**
 * Do an ETH withdrawal
 * @param noteString Note to withdraw
 * @param recipient Recipient address
 */
async function withdraw({ deposit, currency, amount, recipient, relayerURL, refund = '0', tokenAddress }) { 

  if (currency === 'BNB' && refund !== '0') {
    throw new Error('The BNB purchase is supposed to be 0 for BNB withdrawals')
  }

  refund = toWei(refund)
  const { proof, args } = await generateProof({ deposit, recipient, refund, amount, tokenAddress });
  
  if (proof == null) return 'delete';
  
  // No 0x prefix
  const testPrivateKeyHex = process.env.privatekey;
  senderAccount = web3.eth.accounts.privateKeyToAccount('0x' + testPrivateKeyHex);
  web3.eth.accounts.wallet.add(senderAccount);
  web3.eth.defaultAccount = senderAccount.address;
  console.log('senderAccount -- ', senderAccount.address);

  await privateNado.methods.withdraw(proof, ...args).send({ from: senderAccount.address, value: refund.toString(), gas: 1e7, gasPrice: 2e10 })
    .on('transactionHash', function (txHash) {
      console.log(txHash);
    }).on('error', function (e) {
      console.error('on transactionHash error', e.message);
      return false;
    })

  return true
}

/**
 * Parses privateNado.cash note
 * @param noteString the note
 */
function parseNote(noteString) {
  const noteRegex = /price-(?<currency>\w+)-(?<amount>[\d.]+)-(?<netId>\d+)-0x(?<note>[0-9a-fA-F]{124})/g
  const match = noteRegex.exec(noteString)
  if (!match) {
    throw new Error('The note has invalid format')
  }

  const buf = Buffer.from(match.groups.note, 'hex')
  const nullifier = bigInt.leBuff2int(buf.slice(0, 31))
  const secret = bigInt.leBuff2int(buf.slice(31, 62))
  const deposit = createDeposit({ nullifier, secret })
  const netId = Number(match.groups.netId)

  return { currency: match.groups.currency, amount: match.groups.amount, netId, deposit }
}

async function scanDBexecuteWithdraw({ currency = 'bnb'}) {  
  let conAddress, contractJson, netId

  netId = 97 
  
  // TODO do we need this? should it work in browser really?
  if (web3 === undefined) {    
    // Initialize from local node
    try {
      web3 = new Web3(new Web3.providers.HttpProvider(process.env.httpprovider));
    } catch (error) {
      console.log(error)
    }    
  }  

  contractJson = require('./ZephNado.json')
  try {   
    console.log(netId); 
    console.log(currency); 
    privateNaoAddress = config.deployments[`netId${netId}`].instanceAddress['any']
    if (!privateNaoAddress) {
      throw new Error('Create address error')
    }
  } catch (e) {    
    console.error('There is no such privatex instance, check the currency and amount you provide')
    return;
  }

  privateNado = new web3.eth.Contract(contractJson.abi, privateNaoAddress)
  conAddress = privateNaoAddress

  // withdraw by notestring
  
  try {
    data = {
      conAddress : conAddress,
      // currency : currency,
      netId: netId
    }

    const allPastDeposits = await deposits.findPastDeposits( data );

    for (let index = 0; index < allPastDeposits.length; index++) {
      const element = allPastDeposits[index];
      const _noteStr = element.noteString;
      const _wallet = element.wallet;
      const _tokenAddress = element.tokenAddress;
      const _currency = element.currency;
      const _decimals = element.decimals;
      // const _amt = element.amount;

      console.log("_wallet -- - ", _wallet);
      const _amt = fromDecimals({ amount: element.amount, decimals: Number(_decimals) });      

      const { currency, amount, netId, deposit } = parseNote(_noteStr, _currency);

      // // check valid merkle
      const generateResult = await generateMerkleProof(deposit); 
      if (generateResult === 'corrupted' || generateResult === 'spent' || generateResult === 'notfound') {
        console.log('generateResult -- ', generateResult);
        let depositResult = await deposits.delete( {id: element.id} );
        console.log('deleteResult - ', depositResult);
        return;
      }

      const withdrawResult = await withdraw({ deposit, currency, amount: _amt, recipient: _wallet, tokenAddress: _tokenAddress});      

      if (withdrawResult) {
        //await deposits.update( {id: element.id, sentYn: true} );
        let withdrawResult = await deposits.delete( {id: element.id} );
        console.log('deleteResult - ', withdrawResult);
      }
    }

    console.log('scanned all past deposit')
  } catch (error) {
    console.log(error)
  }
  
}
  
// Schedule tasks to be run on the server.
cron.schedule('*/1 * * * *', async function() {
  
  console.log('running withdraw task per 1 minute');
  console.log(' ===== scanning BNB ====== ');
  circuit = require('./build/withdraw.json')
  proving_key = fs.readFileSync('app/cron/build/withdraw_proving_key.bin').buffer;
  scanDBexecuteWithdraw({currency: 'bnb', amount: '0.1'})

});
