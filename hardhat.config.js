require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("dotenv").config();

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL || "https://eth-goerli";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xkey";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "key";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "key";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {

  defaultNetwork: "hardhat",

  networks: {
    hardhat: {
      chainId: 31337,
      blockConfirmations: 1
    },
    goerli: {
      chainId: 5,
      url: GOERLI_RPC_URL,
      accounts: [PRIVATE_KEY],
      blockConfirmations: 6,
    },
  },

  solidity: {
    compilers: [
      { version: "0.8.17" },
      { version: "0.6.6" },
    ],
  },

  // namedAccounts 用于给当前网络下的账户配置名字，default 用于指定把当前名字给第几个账户
  namedAccounts: {
    deployer: {
      default: 0,
    },
    player: {
      default: 1,
    },
  },

  etherscan: {
    apiKey: {
      goerli: ETHERSCAN_API_KEY,
    },
    customChains: 
    [
      {
        network: "goerli",
        chainId: 5,
        urls: {
          apiURL: "http://api-goerli.etherscan.io/api", // HTTPS => HTTP
          browserURL: "https://goerli.etherscan.io"
        },
      },
    ],
  },

  // 配置 hardhat-gas-reporter，在使用 yarn hardhat test 进行测试时会自动打印 gas 报告
  // doc: https://www.npmjs.com/package/hardhat-gas-reporter
  gasReporter: {
    enabled: false,
    // 将 gas 报告输出到文件中
    outputFile: "gas-report.txt",
    // 输出到文件中不关闭颜色可能会乱七八糟
    noColors: true,
    // 获取 eth 对应的美元数
    currency: "USD",
    // 这里通过使用 coinmarketcap 的 API 来执行 eth 兑换美元
    coinmarketcap: COINMARKETCAP_API_KEY,
    // 通过指定 token 来指定获取哪个 blockchain 的 gasPrice，这里以 polygon 为例
    token: "ETH",
  },

  mocha: {
    timeout: 300000 // 300s
  }
};
