# Hardhat Lottery

## Basic Setup

Install dependencies

```shell
yarn add --dev @nomiclabs/hardhat-ethers@npm:hardhat-deploy-ethers ethers @nomiclabs/hardhat-etherscan @nomiclabs/hardhat-waffle chai ethereum-waffle hardhat hardhat-contract-sizer hardhat-deploy hardhat-gas-reporter prettier prettier-plugin-solidity solhint solidity-coverage dotenv
```

Install hardhat-shorthand

```shell
yarn global add hardhat-shorthand
```

## Testing

- Get our SubId for Chainlink VRF (<https://vrf.chain.link/>)
  - recommend to put 2 link in subscription contract
- Deploy our contract using the SubId
- Register the contract with Chainlink VRF & it's subId
- Register the contract with Chainlink Automation (<https://automation.chain.link/>)
  - recommend to put 8 link in automation contract
- Run staging tests
