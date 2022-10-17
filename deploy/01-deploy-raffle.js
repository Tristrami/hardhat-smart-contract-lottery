const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");
require("dotenv").config();

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("10");

module.exports = async function ({ getNamedAccounts, deployments }) {

  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  let vrfCoordinatorV2Address, subscriptionId;
  
  // 如果是本地网络，就使用 vrfCoordinatorV2Mock 来获取随机数，如果不是，那就使用链上的 vrfCoordinatorV2
  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
    const transactionReceipt = await transactionResponse.wait(1);
    // 从事件中获取 subscriptionId 
    subscriptionId = transactionReceipt.events[0].args.subId;
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }

  const entranceFee = networkConfig[chainId]["entranceFee"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  const interval = networkConfig[chainId]["interval"];

  const args = [
    vrfCoordinatorV2Address, 
    entranceFee, 
    gasLane, 
    subscriptionId, 
    callbackGasLimit, 
    interval
  ];

  // 部署 Raffle.sol
  const raffle = await deploy("Raffle", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: 6,
  });
  log("-----------------------------------------------");

  // 如果不是在本地网络，verify Raffle.sol
  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    await verify(raffle.address, args);
  }
}

module.exports.tags = ["all", "raffle"];