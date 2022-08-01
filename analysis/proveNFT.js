const dotenv = require('dotenv');
dotenv.config();
const { ethers } = require('ethers');
const { toBuffer, bufferToHex, keccak256, rlp } = require('ethereumjs-util');
const { SecureTrie } = require('merkle-patricia-tree');
const { GetProof } = require('eth-proof');

const Web3 = require("web3");
const { rlpEncodeProof } = require('./libRlp');

//const db = new Level('./root/.ethereum/sepolia/geth/chaindata')
//const web3 = new Web3("http://127.0.0.1:6545");
const web3 = new Web3(`https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`);

async function validateStorage(proof, slot, proofIdx) {
  const proofBufs = proof.storageProof[proofIdx].proof.map(toBuffer);
  const pTrie = await SecureTrie.fromProof(proofBufs);
  const valid = pTrie.checkRoot(toBuffer(proof.storageHash));

  const rlpNode = await pTrie.get(toBuffer(web3.utils.keccak256(slot)));
  console.log("content at slot", slot, bufferToHex(rlp.decode(rlpNode)));
  return valid;
}

const getNFTProof = async (blockNumber, contract, slots) => {
  const proof = await web3.eth.getProof(
    contract,
    slots,
    blockNumber
  );

  const proofBufs = proof.storageProof[0].proof.map(toBuffer);
  const proofTrie = await SecureTrie.fromProof(proofBufs);
  //const valid = await pTrie.checkRoot(toBuffer(proof.storageHash));
  const valid = bufferToHex(proofTrie.root) == proof.storageHash;
  console.log(valid)

  return { proof }
}


(async () => {
  //mainnet
  //prove Jimmy Fallon owns BAYC#599 at block height 13572667
  //Jimmy Fallon's address is 0x0394451c1238CEC1E825229E692AA9E428C107D8
  //transfer transaction https://etherscan.io/tx/0x25d594eab6dd5ea7c2189d2cf30b702f64ff3c75590d7c41638c9d9a55cf0f76

  const baycAddress = "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d"; //bored apes
  const blockNumber = 13572667;

  const indexSlot = web3.utils.soliditySha3(
    599, 3
  );
  const indexValue = await web3.eth.getStorageAt(baycAddress, indexSlot, blockNumber)
  console.log("index value", indexValue);

  const bnIndex = ethers.BigNumber.from(indexValue);
  const valueSlot = ethers.BigNumber.from(web3.utils.soliditySha3(
    2
  )).add(bnIndex.mul(2)).sub(2).add(1);

  console.log(indexSlot, valueSlot.toHexString());

  const ownerValue = await web3.eth.getStorageAt(baycAddress, valueSlot.toHexString(), blockNumber);
  console.log("owner value", ownerValue);

  const { proof } = await getNFTProof(blockNumber, baycAddress, [indexSlot, valueSlot]);
  //console.log(proof, proof.storageProof);

  console.log(proof);

  const accountProof = rlpEncodeProof(proof.accountProof);
  const indexStorageProof = rlpEncodeProof(proof.storageProof[0].proof);
  const valueStorageProof = rlpEncodeProof(proof.storageProof[1].proof);
  console.log("account: ", bufferToHex(accountProof))
  console.log("index:", bufferToHex(indexStorageProof));
  console.log("value:", bufferToHex(valueStorageProof));

  console.log(await validateStorage(proof, indexSlot, 0));
  console.log(await validateStorage(proof, valueSlot.toHexString(), 1));

})();
