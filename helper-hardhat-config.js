const { ethers } = require("hardhat");

// chainId => config
const networkConfig = {
  5: {
    name: "goerli",
    // https://docs.chain.link/docs/vrf/v2/subscription/supported-networks/ -- Goerli Testnet -- VRF Coordinator
    vrfCoordinatorV2: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
    entranceFee: ethers.utils.parseEther("0.01"),
    // https://docs.chain.link/docs/vrf/v2/subscription/supported-networks/ -- Goerli Testnet -- 30 gwei Key Hash
    gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
    subscriptionId: "4668",
    callbackGasLimit: "500000",
    interval: "20",
  },
  31337: {
    name: "hardhat",
    entranceFee: ethers.utils.parseEther("0.01"),
    gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
    callbackGasLimit: "500000",
    interval: "30",
  },
};

const developmentChains = [
  "hardhat",
  "localhost"
];

module.exports = {
  networkConfig,
  developmentChains,
}